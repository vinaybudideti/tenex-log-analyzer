import { describe, it, expect } from 'vitest';
import { makeLog } from './helpers';
import { detectHighRiskAllowed } from '../src/detection/highRisk';

describe('detectHighRiskAllowed', () => {
  it('detects riskScore 85 allowed traffic as high severity', () => {
    const logs = Array.from({ length: 5 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '10.0.1.15',
      destHost: 'malware.example.com',
      epochTime: 1700000000 + i * 60,
      action: 'Allowed',
      riskScore: 85,
      threatSeverity: 'High',
    }));

    const findings = detectHighRiskAllowed(logs, 'test-upload');
    expect(findings).toHaveLength(1);
    expect(findings[0].techniqueId).toBe('T1071');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].confidence).toBe(85);
  });

  it('detects riskScore 95 allowed traffic as critical severity', () => {
    const logs = Array.from({ length: 5 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '10.0.1.15',
      destHost: 'malware.example.com',
      epochTime: 1700000000 + i * 60,
      action: 'Allowed',
      riskScore: 95,
      threatSeverity: 'Critical',
    }));

    const findings = detectHighRiskAllowed(logs, 'test-upload');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].confidence).toBe(95);
  });

  it('produces no finding for riskScore 60 (below RISK_THRESHOLD=75)', () => {
    const logs = Array.from({ length: 5 }, (_, i) => makeLog({
      id: `log-${i}`,
      sourceIp: '10.0.1.15',
      destHost: 'suspicious.example.com',
      epochTime: 1700000000 + i * 60,
      action: 'Allowed',
      riskScore: 60,
      threatSeverity: 'None (0)',
    }));

    const findings = detectHighRiskAllowed(logs, 'test-upload');
    expect(findings).toHaveLength(0);
  });
});
