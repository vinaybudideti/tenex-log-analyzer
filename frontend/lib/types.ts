export type Upload = {
  id: string;
  filename: string;
  logCount: number;
  parseErrors: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
};

export type Counts = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
};

export type Summary = {
  upload: Upload;
  counts: Counts;
};

export type LogEntrySample = {
  id: string;
  uploadId: string;
  epochTime: number;
  normalizedTime: string;
  sourceIp: string;
  destHost: string;
  url: string;
  method: string;
  respCode: number;
  reqSize: number;
  respSize: number;
  totalSize: number;
  action: string;
  riskScore: number;
  threatSeverity: string;
  threatName: string;
  appClass: string;
  urlClass: string;
  login: string | null;
  rawJson: unknown;
};

export type Finding = {
  id: string;
  techniqueId: string;
  techniqueName: string;
  severity: string;
  confidence: number;
  sourceIp: string | null;
  destHost: string | null;
  reason: string;
  evidence: LogEntrySample[];
};

export type Incident = {
  id: string;
  title: string;
  severity: string;
  whatHappened: string;
  whyItMatters: string;
  investigateNext: string[];
  suggestedContain: string | null;
  startTime: string;
  endTime: string;
  aiGenerated: boolean;
  findings: Finding[];
};

export type TimelineEvent = {
  id: string;
  time: string;
  type: 'finding';
  severity: string;
  title: string;
  incidentId: string | null;
};

export type TimelineResponse = {
  events: TimelineEvent[];
  startTime: string | null;
  endTime: string | null;
};
