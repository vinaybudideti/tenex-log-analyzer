import type { LogEntry } from '../lib/prisma';
import { detectBeaconing } from './beaconing';
import { detectExfil } from './exfil';
import { detectCredStuffing } from './credStuffing';
import { detectHighRiskAllowed } from './highRisk';
import type { FindingInput } from './types';

export function runAllDetections(logs: LogEntry[], uploadId: string): FindingInput[] {
  return [
    ...detectBeaconing(logs, uploadId),
    ...detectExfil(logs, uploadId),
    ...detectCredStuffing(logs, uploadId),
    ...detectHighRiskAllowed(logs, uploadId),
  ];
}
