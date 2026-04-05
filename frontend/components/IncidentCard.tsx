import type { Incident } from '@/lib/types';
import { SeverityBadge } from './SeverityBadge';
import { FindingEvidence } from './FindingEvidence';
import { severityBorder, severityColor, formatDuration } from '@/lib/ui-helpers';

export function IncidentCard({ incident }: { incident: Incident }) {
  const sortedFindings = [...incident.findings].sort((a, b) => b.confidence - a.confidence);

  // Collect unique source IPs from findings
  const sourceIps = Array.from(new Set(
    incident.findings.map(f => f.sourceIp).filter(Boolean)
  ));

  return (
    <div className={`bg-zinc-900 rounded-lg border-l-4 ${severityBorder(incident.severity)} overflow-hidden`}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="text-lg font-semibold text-zinc-100">{incident.title}</h4>
          <SeverityBadge severity={incident.severity} />
        </div>

        {/* Meta line */}
        <div className="flex items-center gap-3 text-xs text-zinc-500 mb-4">
          {sourceIps.length > 0 && <span>Source: {sourceIps.join(', ')}</span>}
          <span>{formatDuration(incident.startTime, incident.endTime)}</span>
          <span className={incident.aiGenerated ? 'text-blue-400' : 'text-zinc-500'}>
            {incident.aiGenerated ? 'AI analysis' : 'Rule-based analysis'}
          </span>
        </div>

        {/* What happened */}
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">What Happened</h5>
          <p className="text-sm text-zinc-300 leading-relaxed">{incident.whatHappened}</p>
        </div>

        {/* Why it matters */}
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Why It Matters</h5>
          <p className="text-sm text-zinc-300 leading-relaxed">{incident.whyItMatters}</p>
        </div>

        {/* Investigate next */}
        <div className="mb-3">
          <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Investigate Next</h5>
          <ul className="list-disc list-inside space-y-1">
            {(incident.investigateNext as string[]).map((step, i) => (
              <li key={i} className="text-sm text-zinc-300">{step}</li>
            ))}
          </ul>
        </div>

        {/* Containment */}
        {incident.suggestedContain && (
          <div className="mb-4">
            <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Suggested Containment</h5>
            <p className="text-sm text-amber-400">{incident.suggestedContain}</p>
          </div>
        )}

        {/* Findings */}
        <div className="border-t border-zinc-800 pt-4 mt-4">
          <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Findings ({sortedFindings.length})
          </h5>
          <div className="space-y-3">
            {sortedFindings.map(finding => (
              <div key={finding.id} className="bg-zinc-950 rounded p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${severityColor(finding.severity)}`}>
                    {finding.techniqueId}
                  </span>
                  <span className="text-sm text-zinc-200">{finding.techniqueName}</span>
                  <span className="text-xs text-zinc-500">({finding.confidence}% confidence)</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">{finding.reason}</p>
                <FindingEvidence evidence={finding.evidence} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
