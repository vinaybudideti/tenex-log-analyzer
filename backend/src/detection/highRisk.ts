import type { LogEntry } from '../lib/prisma';
import type { FindingInput } from './types';

const RISK_THRESHOLD = 75;

export function detectHighRiskAllowed(logs: LogEntry[], uploadId: string): FindingInput[] {
  const risky = logs.filter(l =>
    l.action === 'Allowed' &&
    (l.riskScore >= RISK_THRESHOLD || /High|Critical/i.test(l.threatSeverity))
  );

  if (risky.length === 0) return [];

  const byPair = new Map<string, LogEntry[]>();
  for (const log of risky) {
    const key = `${log.sourceIp}:${log.destHost}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(log);
  }

  const findings: FindingInput[] = [];

  for (const [key, entries] of byPair.entries()) {
    const [sourceIp, destHost] = key.split(':');
    const maxRisk = Math.max(...entries.map(e => e.riskScore));
    const confidence = Math.min(95, maxRisk);
    const severity = maxRisk >= 90 ? 'critical' : maxRisk >= 80 ? 'high' : 'medium';

    entries.sort((a, b) => a.epochTime - b.epochTime);

    findings.push({
      uploadId,
      techniqueId: 'T1071',
      techniqueName: 'Application Layer Protocol',
      severity,
      confidence,
      sourceIp,
      destHost,
      reason: `${entries.length} high-risk connections allowed through to ${destHost} from ${sourceIp}. Max risk score ${maxRisk}. Possible policy gap.`,
      evidenceLogIds: entries.slice(0, 10).map(e => e.id),
      startTime: new Date(entries[0].epochTime * 1000),
      endTime: new Date(entries[entries.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
