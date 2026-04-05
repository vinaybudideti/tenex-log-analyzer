import type { LogEntry } from '../lib/prisma';
import type { FindingInput } from './types';

const MIN_BYTES = 50 * 1024 * 1024; // 50 MB
const MULTIPLIER = 10;

export function detectExfil(logs: LogEntry[], uploadId: string): FindingInput[] {
  const pairTotals = new Map<string, { bytes: number; logs: LogEntry[] }>();

  for (const log of logs) {
    if (log.action !== 'Allowed') continue;
    const key = `${log.sourceIp}:${log.destHost}`;
    if (!pairTotals.has(key)) pairTotals.set(key, { bytes: 0, logs: [] });
    const entry = pairTotals.get(key)!;
    entry.bytes += log.totalSize;
    entry.logs.push(log);
  }

  if (pairTotals.size === 0) return [];

  const byteValues = Array.from(pairTotals.values()).map(v => v.bytes).sort((a, b) => a - b);
  const median = byteValues[Math.floor(byteValues.length / 2)] || 1;

  const findings: FindingInput[] = [];

  for (const [key, data] of pairTotals.entries()) {
    if (data.bytes < MIN_BYTES) continue;
    if (data.bytes < median * MULTIPLIER) continue;

    const mb = Math.round(data.bytes / 1024 / 1024);
    const confidence = Math.min(95, 50 + Math.round(mb / 10));
    const [sourceIp, destHost] = key.split(':');
    const severity = mb >= 500 ? 'critical' : mb >= 200 ? 'high' : 'medium';

    data.logs.sort((a, b) => a.epochTime - b.epochTime);

    findings.push({
      uploadId,
      techniqueId: 'T1041',
      techniqueName: 'Exfiltration Over C2 Channel',
      severity,
      confidence,
      sourceIp,
      destHost,
      reason: `${mb} MB transferred from ${sourceIp} to ${destHost} (${Math.round(data.bytes / median)}x upload median). Possible data exfiltration.`,
      evidenceLogIds: data.logs.slice(0, 10).map(l => l.id),
      startTime: new Date(data.logs[0].epochTime * 1000),
      endTime: new Date(data.logs[data.logs.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
