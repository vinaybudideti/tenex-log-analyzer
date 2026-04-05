import { severityColor } from '@/lib/ui-helpers';

export function SeverityBadge({ severity, confidence }: { severity: string; confidence?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase ${severityColor(severity)}`}>
      {severity}
      {confidence !== undefined && (
        <span className="opacity-75">({confidence}%)</span>
      )}
    </span>
  );
}
