export const severityColor = (sev: string): string => ({
  critical: 'bg-red-600 text-red-50',
  high: 'bg-orange-500 text-orange-50',
  medium: 'bg-yellow-500 text-yellow-950',
  low: 'bg-blue-400 text-blue-950',
}[sev] || 'bg-zinc-500 text-zinc-50');

export const severityBorder = (sev: string): string => ({
  critical: 'border-red-600',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-400',
}[sev] || 'border-zinc-500');

export const severityDot = (sev: string): string => ({
  critical: 'bg-red-600',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
}[sev] || 'bg-zinc-500');

export const percentOffset = (
  eventTime: string | Date,
  startTime: string | Date,
  endTime: string | Date
): number => {
  const t = new Date(eventTime).getTime();
  const s = new Date(startTime).getTime();
  const e = new Date(endTime).getTime();
  if (e === s) return 0;
  return Math.max(0, Math.min(100, ((t - s) / (e - s)) * 100));
};

export const formatDuration = (startTime: string | Date, endTime: string | Date): string => {
  const ms = new Date(endTime).getTime() - new Date(startTime).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs} sec`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr ${mins % 60} min`;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
};

export const formatTime = (t: string | Date): string => {
  return new Date(t).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};
