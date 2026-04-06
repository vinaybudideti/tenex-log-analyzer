'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMe, useUploads } from '@/lib/hooks';
import { api } from '@/lib/api';
import { LoadingState } from '@/components/LoadingState';
import { formatTime } from '@/lib/ui-helpers';

export default function DashboardPage() {
  const router = useRouter();
  const { data: meData, isLoading: meLoading, error: meError } = useMe();
  const { data: uploadsData, isLoading: uploadsLoading } = useUploads();

  if (meError) {
    router.replace('/login');
    return null;
  }

  if (meLoading || uploadsLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <LoadingState message="Loading uploads..." />
      </div>
    );
  }

  const uploads = uploadsData?.uploads ?? [];

  async function handleLogout() {
    await api.logout();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="text-lg font-bold hover:text-zinc-300 transition-colors">Tenex Log Analyzer</Link>
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Uploads</h2>
          <Link
            href="/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Upload New
          </Link>
        </div>

        {uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-200 mb-2">No uploads yet</h3>
            <p className="text-zinc-500 mb-6">Upload a Zscaler log file to start analyzing threats.</p>
            <Link
              href="/upload"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Upload Your First File
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {uploads.map(upload => (
              <Link
                key={upload.id}
                href={`/dashboard/${upload.id}`}
                className="block bg-zinc-900 rounded-lg p-5 border border-zinc-800 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{upload.filename}</h3>
                    <div className="flex items-center gap-3 text-sm text-zinc-500 mt-1">
                      <span>{upload.logCount.toLocaleString()} entries</span>
                      {upload.completedAt && <span>{formatTime(upload.completedAt)}</span>}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    upload.status === 'completed' ? 'bg-green-900/50 text-green-400' :
                    upload.status === 'processing' ? 'bg-blue-900/50 text-blue-400' :
                    'bg-red-900/50 text-red-400'
                  }`}>
                    {upload.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
