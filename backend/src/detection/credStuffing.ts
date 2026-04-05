import type { LogEntry } from '../lib/prisma';
import type { FindingInput } from './types';

const AUTH_URL_REGEX = /login|signin|auth|oauth|sso/i;

export function detectCredStuffing(logs: LogEntry[], uploadId: string): FindingInput[] {
  const authFailures = logs.filter(l =>
    l.method === 'POST' &&
    AUTH_URL_REGEX.test(l.url) &&
    (l.respCode === 401 || l.respCode === 403)
  );

  const bySourceIp = new Map<string, { paths: Set<string>; logs: LogEntry[] }>();
  for (const log of authFailures) {
    if (!bySourceIp.has(log.sourceIp)) {
      bySourceIp.set(log.sourceIp, { paths: new Set(), logs: [] });
    }
    const entry = bySourceIp.get(log.sourceIp)!;
    entry.paths.add(log.url);
    entry.logs.push(log);
  }

  const findings: FindingInput[] = [];

  for (const [sourceIp, data] of bySourceIp.entries()) {
    const distinctPaths = data.paths.size;
    const totalAttempts = data.logs.length;

    if (distinctPaths < 3 && totalAttempts < 10) continue;

    const confidence = Math.min(95, 40 + distinctPaths * 10 + totalAttempts * 2);
    const severity = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';
    const techniqueId = distinctPaths >= 3 ? 'T1110.003' : 'T1110.004';
    const techniqueName = distinctPaths >= 3
      ? 'Brute Force: Password Spraying'
      : 'Brute Force: Credential Stuffing';

    data.logs.sort((a, b) => a.epochTime - b.epochTime);

    findings.push({
      uploadId,
      techniqueId,
      techniqueName,
      severity,
      confidence,
      sourceIp,
      destHost: data.logs[0].destHost,
      reason: `${totalAttempts} failed auth attempts from ${sourceIp} across ${distinctPaths} distinct paths. Pattern suggests automated credential attack.`,
      evidenceLogIds: data.logs.slice(0, 10).map(l => l.id),
      startTime: new Date(data.logs[0].epochTime * 1000),
      endTime: new Date(data.logs[data.logs.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
