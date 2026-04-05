import type { LogEntrySample } from '@/lib/types';
import { formatTime } from '@/lib/ui-helpers';

export function FindingEvidence({ evidence }: { evidence: LogEntrySample[] }) {
  if (evidence.length === 0) return null;

  return (
    <details className="mt-2">
      <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-300">
        Evidence ({evidence.length} log entries)
      </summary>
      <div className="mt-2 space-y-1">
        {evidence.map(log => (
          <div
            key={log.id}
            className="border-l-2 border-orange-500 pl-3 py-1 bg-zinc-900 rounded-r text-xs font-mono text-zinc-300"
          >
            <span className="text-zinc-500">{formatTime(log.normalizedTime)}</span>
            {' · '}
            <span className="text-zinc-200">{log.sourceIp}</span>
            {' · '}
            <span>{log.method}</span>
            {' · '}
            <span className="text-zinc-400 break-all">{log.url}</span>
            {' -> '}
            <span className={log.respCode >= 400 ? 'text-red-400' : 'text-green-400'}>
              {log.respCode}
            </span>
          </div>
        ))}
      </div>
    </details>
  );
}
