import type { LogEntry } from '../lib/prisma';
import type { FindingInput } from './types';

const MIN_CONNECTIONS = 15;
const CV_THRESHOLD = 0.35;

export function detectBeaconing(logs: LogEntry[], uploadId: string): FindingInput[] {
  const pairs = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = `${log.sourceIp}:${log.destHost}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key)!.push(log);
  }

  const findings: FindingInput[] = [];

  for (const [key, entries] of pairs.entries()) {
    if (entries.length < MIN_CONNECTIONS) continue;

    entries.sort((a, b) => a.epochTime - b.epochTime);
    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      intervals.push(entries[i].epochTime - entries[i - 1].epochTime);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (mean === 0) continue;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    const stddev = Math.sqrt(variance);
    const cv = stddev / mean;

    if (cv > CV_THRESHOLD) continue;

    const confidence = Math.min(95, Math.round((1 - cv / CV_THRESHOLD) * 100));
    const [sourceIp, destHost] = key.split(':');
    const severity = confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low';

    findings.push({
      uploadId,
      techniqueId: 'T1071.001',
      techniqueName: 'Application Layer Protocol: Web Protocols',
      severity,
      confidence,
      sourceIp,
      destHost,
      reason: `Regular connection pattern detected. ${entries.length} connections with CV=${cv.toFixed(3)} (mean interval ${Math.round(mean)}s). Indicates automated beacon traffic.`,
      evidenceLogIds: entries.slice(0, 10).map(e => e.id),
      startTime: new Date(entries[0].epochTime * 1000),
      endTime: new Date(entries[entries.length - 1].epochTime * 1000),
    });
  }

  return findings;
}
