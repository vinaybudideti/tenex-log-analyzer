import { describe, it, expect } from 'vitest';
import { makeLog } from './helpers';
import { detectCredStuffing } from '../src/detection/credStuffing';

describe('detectCredStuffing', () => {
  it('detects password spraying with 5 distinct auth paths (T1110.003)', () => {
    const logs = Array.from({ length: 5 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '198.51.100.77',
      destHost: 'okta.example.com',
      epochTime: 1700000000 + i * 10,
      method: 'POST',
      url: `https://okta.example.com/oauth/user${i}`,
      respCode: 401,
    }));

    const findings = detectCredStuffing(logs, 'test-upload');
    expect(findings).toHaveLength(1);
    expect(findings[0].techniqueId).toBe('T1110.003');
    expect(findings[0].techniqueName).toBe('Brute Force: Password Spraying');
    expect(findings[0].sourceIp).toBe('198.51.100.77');
  });

  it('detects credential stuffing with 15 attempts to same path (T1110.004)', () => {
    const logs = Array.from({ length: 15 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '198.51.100.77',
      destHost: 'okta.example.com',
      epochTime: 1700000000 + i * 5,
      method: 'POST',
      url: 'https://okta.example.com/login',
      respCode: 401,
    }));

    const findings = detectCredStuffing(logs, 'test-upload');
    expect(findings).toHaveLength(1);
    expect(findings[0].techniqueId).toBe('T1110.004');
    expect(findings[0].techniqueName).toBe('Brute Force: Credential Stuffing');
  });

  it('produces no finding for 2 attempts (below both thresholds)', () => {
    const logs = Array.from({ length: 2 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '198.51.100.77',
      destHost: 'okta.example.com',
      epochTime: 1700000000 + i * 10,
      method: 'POST',
      url: `https://okta.example.com/login/user${i}`,
      respCode: 401,
    }));

    const findings = detectCredStuffing(logs, 'test-upload');
    expect(findings).toHaveLength(0);
  });
});
