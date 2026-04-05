import { describe, it, expect } from 'vitest';
import { makeLog } from './helpers';
import { detectBeaconing } from '../src/detection/beaconing';

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
