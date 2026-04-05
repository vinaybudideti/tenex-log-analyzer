import type { FindingInput } from '../detection/types';

type FallbackIncident = {
  title: string;
  severity: string;
  findingIndexes: number[];
  whatHappened: string;
  whyItMatters: string;
  investigateNext: string[];
  suggestedContain: string | null;
  startTime: Date;
  endTime: Date;
  aiGenerated: false;
};

export function buildFallbackIncidents(findings: FindingInput[]): FallbackIncident[] {
  // Group by source IP
  const bySource = new Map<string, number[]>();
  findings.forEach((f, idx) => {
    const key = f.sourceIp || 'unknown';
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key)!.push(idx);
  });

  const incidents: FallbackIncident[] = [];
  for (const [sourceIp, indexes] of bySource.entries()) {
    const group = indexes.map(i => findings[i]);
    const severities = group.map(f => f.severity);
    const highest = severities.includes('critical') ? 'critical' :
                   severities.includes('high') ? 'high' :
                   severities.includes('medium') ? 'medium' : 'low';
    const techniques = Array.from(new Set(group.map(f => f.techniqueName)));
    const startTime = new Date(Math.min(...group.map(f => f.startTime.getTime())));
    const endTime = new Date(Math.max(...group.map(f => f.endTime.getTime())));

    incidents.push({
      title: `${techniques[0]} from ${sourceIp}`,
      severity: highest,
      findingIndexes: indexes,
      whatHappened: `Source ${sourceIp} exhibited ${group.length} finding(s) across ${techniques.length} technique(s): ${techniques.join(', ')}.`,
      whyItMatters: `${highest.toUpperCase()} severity activity from a single source indicates coordinated behavior requiring analyst review.`,
      investigateNext: [
        `Pull full traffic history for source IP ${sourceIp}`,
        `Correlate with endpoint telemetry and authentication logs`,
        `Review all destination hosts contacted by ${sourceIp}`,
      ],
      suggestedContain: highest === 'critical' || highest === 'high'
        ? `Consider isolating source ${sourceIp} pending investigation`
        : null,
      startTime,
      endTime,
      aiGenerated: false,
    });
  }

  return incidents;
}
