import type { TimelineEvent } from '@/lib/types';
import { severityDot, percentOffset, formatTime } from '@/lib/ui-helpers';

export function Timeline({
  events,
  startTime,
  endTime,
}: {
  events: TimelineEvent[];
  startTime: string;
  endTime: string;
}) {
  if (events.length === 0) return null;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="relative h-24">
        {/* Base line */}
        <div className="absolute top-10 left-0 right-0 h-px bg-zinc-700" />

        {/* Time labels */}
        <div className="absolute bottom-0 left-0 text-xs text-zinc-600">
          {formatTime(startTime)}
        </div>
        <div className="absolute bottom-0 right-0 text-xs text-zinc-600">
          {formatTime(endTime)}
        </div>

        {/* Event dots */}
        {events.map(event => {
          const left = percentOffset(event.time, startTime, endTime);
          const tooltip = `${event.severity.toUpperCase()} · ${event.title} · ${formatTime(event.time)}`;
          return (
            <div
              key={event.id}
              className={`absolute top-8 w-3 h-3 rounded-full ${severityDot(event.severity)} cursor-pointer hover:scale-150 transition-transform`}
              style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
              title={tooltip}
            />
          );
        })}
      </div>
    </div>
  );
}
