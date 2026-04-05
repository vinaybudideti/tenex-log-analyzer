export type FindingInput = {
  uploadId: string;
  techniqueId: string;
  techniqueName: string;
  severity: string;
  confidence: number;
  sourceIp: string | null;
  destHost: string | null;
  reason: string;
  evidenceLogIds: string[];
  startTime: Date;
  endTime: Date;
};
