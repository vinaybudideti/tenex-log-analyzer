import { describe, it, expect } from 'vitest';
import { makeLog } from './helpers';
import { detectExfil } from '../src/detection/exfil';

const MB = 1024 * 1024;

describe('detectExfil', () => {
  it('detects 100 MB pair when median is ~1 MB', () => {
    const logs = [
      // Exfil pair: 10 logs * 10 MB each = 100 MB total
      ...Array.from({ length: 10 }, (_, i) => makeLog({
        id: `exfil-${i}`,
        sourceIp: '10.0.1.15',
        destHost: 'transfer.sh',
        epochTime: 1700000000 + i * 60,
        totalSize: 10 * MB,
        action: 'Allowed',
      })),
      // 5 benign pairs with ~1 MB each to set median low
      ...Array.from({ length: 5 }, (_, i) => makeLog({
        id: `benign-${i}`,
        sourceIp: `10.0.1.${20 + i}`,
        destHost: `site-${i}.com`,
        epochTime: 1700000000 + i * 60,
        totalSize: 1 * MB,
        action: 'Allowed',
      })),
    ];

    const findings = detectExfil(logs, 'test-upload');
    expect(findings).toHaveLength(1);
    expect(findings[0].techniqueId).toBe('T1041');
    expect(findings[0].sourceIp).toBe('10.0.1.15');
    expect(findings[0].destHost).toBe('transfer.sh');
  });

  it('produces no finding for 10 MB pair (below 50 MB minimum)', () => {
    const logs = [
      // 10 MB pair
      ...Array.from({ length: 10 }, (_, i) => makeLog({
        id: `small-${i}`,
        sourceIp: '10.0.1.15',
        destHost: 'transfer.sh',
        epochTime: 1700000000 + i * 60,
        totalSize: 1 * MB,
        action: 'Allowed',
      })),
      // Benign pairs to set median low
      ...Array.from({ length: 5 }, (_, i) => makeLog({
        id: `benign-${i}`,
        sourceIp: `10.0.1.${20 + i}`,
        destHost: `site-${i}.com`,
        epochTime: 1700000000 + i * 60,
        totalSize: 100_000,
        action: 'Allowed',
      })),
    ];

    const findings = detectExfil(logs, 'test-upload');
    expect(findings).toHaveLength(0);
  });

  it('produces no finding for 80 MB pair when median is 20 MB (below 10x multiplier)', () => {
    const logs = [
      // 80 MB pair: 8 logs * 10 MB = 80 MB
      ...Array.from({ length: 8 }, (_, i) => makeLog({
        id: `exfil-${i}`,
        sourceIp: '10.0.1.15',
        destHost: 'transfer.sh',
        epochTime: 1700000000 + i * 60,
        totalSize: 10 * MB,
        action: 'Allowed',
      })),
      // 5 other pairs each with ~20 MB to push median up
      ...Array.from({ length: 5 }, (_, i) => makeLog({
        id: `heavy-${i}`,
        sourceIp: `10.0.1.${20 + i}`,
        destHost: `cdn-${i}.com`,
        epochTime: 1700000000 + i * 60,
        totalSize: 20 * MB,
        action: 'Allowed',
      })),
    ];

    // Pairs: transfer.sh=80MB, cdn-0=20MB, cdn-1=20MB, cdn-2=20MB, cdn-3=20MB, cdn-4=20MB
    // Sorted bytes: [20MB, 20MB, 20MB, 20MB, 20MB, 80MB] -> median at index 3 = 20MB
    // 80MB > 50MB (passes MIN_BYTES) but 80MB < 20MB*10=200MB (fails MULTIPLIER)
    const findings = detectExfil(logs, 'test-upload');
    expect(findings).toHaveLength(0);
  });
});
