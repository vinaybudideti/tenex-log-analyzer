import { prisma, type Finding } from '../lib/prisma';
import { runAllDetections } from '../detection';
import { callClaude, extractJson } from './claude';
import { groupingPrompt, handoffPrompt, GroupingOutputSchema, HandoffOutputSchema } from './prompts';
import { buildFallbackIncidents } from './fallback';
import type { FindingInput } from '../detection/types';

export async function runAnalysisPipeline(uploadId: string): Promise<void> {
  const logs = await prisma.logEntry.findMany({ where: { uploadId } });
  const findings = runAllDetections(logs, uploadId);

  if (findings.length === 0) {
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'completed', completedAt: new Date() },
    });
    return;
  }

  // Insert findings to get real IDs
  const insertedFindings: Finding[] = [];
  for (const f of findings) {
    const inserted = await prisma.finding.create({ data: f });
    insertedFindings.push(inserted);
  }

  // Try Claude grouping + handoff
  try {
    const findingSummaries = insertedFindings.map(f => ({
      id: f.id,
      techniqueId: f.techniqueId,
      techniqueName: f.techniqueName,
      severity: f.severity,
      sourceIp: f.sourceIp,
      destHost: f.destHost,
      reason: f.reason,
      startTime: f.startTime.toISOString(),
      endTime: f.endTime.toISOString(),
    }));

    const groupingRaw = await callClaude(groupingPrompt(findingSummaries));
    const groupingParsed = GroupingOutputSchema.parse(JSON.parse(extractJson(groupingRaw)));
    const knownIds = new Set(insertedFindings.map(f => f.id));

    for (const inc of groupingParsed.incidents) {
      const validFindingIds = inc.finding_ids.filter(id => knownIds.has(id));
      if (validFindingIds.length === 0) continue;

      const incidentFindings = insertedFindings.filter(f => validFindingIds.includes(f.id));
      const evidenceLogIds = incidentFindings.flatMap(f => f.evidenceLogIds as string[]).slice(0, 10);
      const logSamples = await prisma.logEntry.findMany({
        where: { id: { in: evidenceLogIds } },
        take: 10,
      });

      const handoffRaw = await callClaude(handoffPrompt({
        title: inc.title,
        severity: inc.severity,
        findings: incidentFindings.map(f => ({ ...f, startTime: f.startTime.toISOString(), endTime: f.endTime.toISOString(), id: f.id } as any)),
        logSamples: logSamples.map(l => ({
          time: l.normalizedTime.toISOString(),
          sourceIp: l.sourceIp,
          destHost: l.destHost,
          method: l.method,
          url: l.url,
          respCode: l.respCode,
          totalSize: l.totalSize,
        })),
      }));

      const handoffParsed = HandoffOutputSchema.parse(JSON.parse(extractJson(handoffRaw)));
      const startTime = new Date(Math.min(...incidentFindings.map(f => f.startTime.getTime())));
      const endTime = new Date(Math.max(...incidentFindings.map(f => f.endTime.getTime())));

      const incident = await prisma.incident.create({
        data: {
          uploadId,
          title: inc.title,
          severity: inc.severity,
          whatHappened: handoffParsed.what_happened,
          whyItMatters: handoffParsed.why_it_matters,
          investigateNext: handoffParsed.investigate_next,
          suggestedContain: handoffParsed.suggested_containment,
          startTime,
          endTime,
          aiGenerated: true,
        },
      });

      await prisma.finding.updateMany({
        where: { id: { in: validFindingIds } },
        data: { incidentId: incident.id },
      });
    }
    // Orphan sweep: link any unlinked findings to an incident
    // with the same source IP, if one exists
    const orphanFindings = await prisma.finding.findMany({
      where: { uploadId, incidentId: null },
    });

    for (const orphan of orphanFindings) {
      if (!orphan.sourceIp) continue;

      // Find an existing incident where any linked finding shares
      // this source IP
      const matchingIncident = await prisma.incident.findFirst({
        where: {
          uploadId,
          findings: {
            some: { sourceIp: orphan.sourceIp },
          },
        },
      });

      if (matchingIncident) {
        await prisma.finding.update({
          where: { id: orphan.id },
          data: { incidentId: matchingIncident.id },
        });
        console.log(`[orphan-sweep] Linked finding ${orphan.id} to incident ${matchingIncident.id} via sourceIp ${orphan.sourceIp}`);
      }
    }
  } catch (err) {
    console.error('Claude pipeline failed, using fallback', err);
    const fallbackIncidents = buildFallbackIncidents(findings);
    for (const fb of fallbackIncidents) {
      const incident = await prisma.incident.create({
        data: {
          uploadId,
          title: fb.title,
          severity: fb.severity,
          whatHappened: fb.whatHappened,
          whyItMatters: fb.whyItMatters,
          investigateNext: fb.investigateNext,
          suggestedContain: fb.suggestedContain,
          startTime: fb.startTime,
          endTime: fb.endTime,
          aiGenerated: false,
        },
      });
      const findingIds = fb.findingIndexes.map(i => insertedFindings[i].id);
      await prisma.finding.updateMany({
        where: { id: { in: findingIds } },
        data: { incidentId: incident.id },
      });
    }
  }

  await prisma.upload.update({
    where: { id: uploadId },
    data: { status: 'completed', completedAt: new Date() },
  });
}
