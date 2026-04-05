import type { LogEntry } from '../src/lib/prisma';
export type { LogEntry };

export function makeLog(overrides: Partial<LogEntry> & {
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
