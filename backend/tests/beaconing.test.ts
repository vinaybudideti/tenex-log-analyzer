import { describe, it, expect } from 'vitest';
import type { LogEntry } from '../src/lib/prisma';
import { detectBeaconing } from '../src/detection/beaconing';

function makeLog(overrides: Partial<LogEntry> & {
  id: string;
  sourceIp: string;
  destHost: string;
  epochTime: number;
}): LogEntry {
  return {
    id: overrides.id,
    uploadId: 'test-upload',
    epochTime: overrides.epochTime,
    normalizedTime: new Date(overrides.epochTime * 1000),
    sourceIp: overrides.sourceIp,
    destHost: overrides.destHost,
    url: 'test.com/path',
    method: 'GET',
    respCode: 200,
    reqSize: 100,
    respSize: 500,
    totalSize: 600,
    action: 'Allowed',
    riskScore: 0,
    threatSeverity: 'None',
    threatName: 'None',
    appClass: 'Web',
    urlClass: 'Business',
    login: null,
    rawJson: {},
    ...overrides,
  } as LogEntry;
}

describe('detectBeaconing', () => {
  it('detects 15 entries at exactly 60s intervals (CV ≈ 0)', () => {
    const logs = Array.from({ length: 15 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '10.0.1.15',
      destHost: 'c2.example.com',
      epochTime: 1700000000 + i * 60,
    }));

    const findings = detectBeaconing(logs, 'test-upload');
    expect(findings).toHaveLength(1);
    expect(findings[0].techniqueId).toBe('T1071.001');
    expect(findings[0].confidence).toBeGreaterThanOrEqual(80);
    expect(findings[0].severity).toBe('high');
    expect(findings[0].sourceIp).toBe('10.0.1.15');
    expect(findings[0].destHost).toBe('c2.example.com');
  });

  it('produces no finding for 10 entries (below MIN_CONNECTIONS=15)', () => {
    const logs = Array.from({ length: 10 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '10.0.1.15',
      destHost: 'c2.example.com',
      epochTime: 1700000000 + i * 60,
    }));

    const findings = detectBeaconing(logs, 'test-upload');
    expect(findings).toHaveLength(0);
  });

  it('produces no finding for highly random intervals (CV > 0.35)', () => {
    const randomIntervals = [5, 300, 12, 800, 2, 450, 90, 1200, 7, 600, 35, 900, 3, 150, 60];
    let time = 1700000000;
    const logs = randomIntervals.map((interval, i) => {
      time += interval;
      return makeLog({
        id: `log-${i}`,
        sourceIp: '10.0.1.15',
        destHost: 'c2.example.com',
        epochTime: time,
      });
    });

    const findings = detectBeaconing(logs, 'test-upload');
    expect(findings).toHaveLength(0);
  });
});
