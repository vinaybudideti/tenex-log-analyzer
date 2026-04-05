import { z } from 'zod';

export type FindingSummary = {
  id: string;
  techniqueId: string;
  techniqueName: string;
  severity: string;
  sourceIp: string | null;
  destHost: string | null;
  reason: string;
  startTime: string;
  endTime: string;
};

export const groupingPrompt = (findings: FindingSummary[]) => `
You are a SOC analyst triaging security findings from Zscaler web proxy logs.

Below are detected findings. Group findings that belong to the same security
incident. Two findings belong to the same incident if EITHER:
  (a) they share a source IP AND occur within 30 minutes of each other, OR
  (b) they represent a logical attack chain (credential stuffing then
      data exfiltration from the same source).

FINDINGS:
${JSON.stringify(findings, null, 2)}

Respond with JSON only. No markdown fences. No commentary.
Schema:
{
  "incidents": [
    {
      "finding_ids": ["<exact finding id from input>"],
      "title": "<6 to 10 word incident title>",
      "severity": "low" | "medium" | "high" | "critical"
    }
  ]
}

If findings do not cluster, return each as its own incident.
`.trim();

export type IncidentContext = {
  title: string;
  severity: string;
  findings: FindingSummary[];
  logSamples: Array<{
    time: string;
    sourceIp: string;
    destHost: string;
    method: string;
    url: string;
    respCode: number;
    totalSize: number;
  }>;
};

export const handoffPrompt = (incident: IncidentContext) => `
You are an L2 SOC analyst writing an escalation ticket for L3.

INCIDENT: ${incident.title}
SEVERITY: ${incident.severity}

FINDINGS IN THIS INCIDENT:
${JSON.stringify(incident.findings, null, 2)}

SAMPLE LOG EVIDENCE (first 10 entries):
${JSON.stringify(incident.logSamples, null, 2)}

Write the handoff in JSON only. No markdown. No commentary.
Schema:
{
  "what_happened": "<2 sentences. SOC terminology. Cite specific IPs and hostnames from the evidence. What did the attacker do?>",
  "why_it_matters": "<1 to 2 sentences on business impact. Concrete, not generic.>",
  "investigate_next": [
    "<specific action citing IPs, hosts, or users>",
    "<specific action>",
    "<specific action>"
  ],
  "suggested_containment": "<1 sentence, or null if incident is informational only>"
}

Rules:
- Be specific. Always cite IPs and hostnames from the evidence.
- Do not use generic advice like "review logs" or "check for malware".
- investigate_next must have exactly 3 items.
`.trim();

export const GroupingOutputSchema = z.object({
  incidents: z.array(z.object({
    finding_ids: z.array(z.string()).min(1),
    title: z.string().min(1).max(200),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
});

export const HandoffOutputSchema = z.object({
  what_happened: z.string().min(1),
  why_it_matters: z.string().min(1),
  investigate_next: z.array(z.string()).length(3),
  suggested_containment: z.string().nullable(),
});

export type GroupingOutput = z.infer<typeof GroupingOutputSchema>;
export type HandoffOutput = z.infer<typeof HandoffOutputSchema>;
