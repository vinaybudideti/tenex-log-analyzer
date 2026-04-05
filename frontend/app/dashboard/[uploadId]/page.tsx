'use client';
import { useParams, useRouter } from 'next/navigation';
import { useMe, useSummary } from '@/lib/hooks';
import { LoadingState } from '@/components/LoadingState';
import { EmptyState } from '@/components/EmptyState';
import { severityBorder } from '@/lib/ui-helpers';
import { formatTime } from '@/lib/ui-helpers';

const SEVERITY_CARDS: { key: 'critical' | 'high' | 'medium' | 'low'; label: string; color: string; border: string }[] = [
  { key: 'critical', label: 'CRITICAL', color: 'text-red-500', border: 'border-red-600' },
  { key: 'high', label: 'HIGH', color: 'text-orange-500', border: 'border-orange-500' },
  { key: 'medium', label: 'MEDIUM', color: 'text-yellow-500', border: 'border-yellow-500' },
  { key: 'low', label: 'LOW', color: 'text-blue-400', border: 'border-blue-400' },
];

export default function UploadDashboardPage() {
  const params = useParams<{ uploadId: string }>();
  const router = useRouter();
  const uploadId = params.uploadId;

  const { data: meData, isLoading: meLoading, error: meError } = useMe();
  const { data: summary, isLoading: summaryLoading, error: summaryError } = useSummary(uploadId);

  // Auth redirect
  if (meError) {
    router.replace('/login');
    return null;
  }

  if (meLoading || summaryLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <LoadingState message="Loading dashboard..." />
      </div>
    );
  }

  if (summaryError || !summary) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
        <p className="text-red-400">
          {summary?.upload.status === 'failed'
            ? 'Analysis failed. Please try uploading again.'
            : (summaryError as Error)?.message || 'Failed to load dashboard'}
        </p>
      </div>
    );
  }

  const { upload, counts } = summary;

  async function handleLogout() {
    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h1 className="text-lg font-bold">Tenex Log Analyzer</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{meData?.user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Upload metadata */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">{upload.filename}</h2>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>{upload.logCount.toLocaleString()} log entries</span>
            {upload.parseErrors > 0 && (
              <span className="text-yellow-500">{upload.parseErrors} parse errors</span>
            )}
            {upload.completedAt && (
              <span>Completed {formatTime(upload.completedAt)}</span>
            )}
          </div>
        </div>

        {/* Severity cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {SEVERITY_CARDS.map(({ key, label, color, border }) => (
            <div
              key={key}
              className={`bg-zinc-900 rounded-lg p-5 border-t-2 ${border}`}
            >
              <div className={`text-3xl font-bold ${color}`}>
                {counts[key]}
              </div>
              <div className="text-xs font-semibold text-zinc-500 mt-1 tracking-wider">
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Empty state or content sections */}
        {counts.total === 0 ? (
          <EmptyState logCount={upload.logCount} />
        ) : (
          <>
            {/* Incidents section - populated in Batch B */}
            <section className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Incidents ({counts.total} findings)</h3>
              <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 text-zinc-500">
                Incident cards loading in next batch...
              </div>
            </section>

            {/* Timeline section - populated in Batch B */}
            <section className="mb-8">
              <h3 className="text-lg font-semibold mb-4">Timeline</h3>
              <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 text-zinc-500">
                Timeline loading in next batch...
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
