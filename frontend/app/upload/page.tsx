'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
const ACCEPTED_EXTENSIONS = '.jsonl,.json,.log,.txt';
const POLL_INTERVAL = 2000;
const MAX_POLL_MS = 90_000;

function getStatusMessage(elapsedMs: number): string {
  if (elapsedMs < 6000) return 'Uploading file...';
  if (elapsedMs < 12000) return 'Parsing log entries...';
  if (elapsedMs < 24000) return 'Running detection rules...';
  return 'Analyzing with Claude AI...';
}

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState('');
  const [timedOutUploadId, setTimedOutUploadId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number>(0);

  // Auth check
  useEffect(() => {
    api.me()
      .then(data => { setUser(data.user); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    };
  }, []);

  const validateFile = useCallback((f: File): string | null => {
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.split(',').includes(ext)) {
      return `Invalid file type: ${ext}. Accepted: ${ACCEPTED_EXTENSIONS}`;
    }
    return null;
  }, []);

  function handleFileSelect(f: File) {
    const err = validateFile(f);
    if (err) {
      setError(err);
      setFile(null);
      return;
    }
    setError('');
    setTimedOutUploadId(null);
    setFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
  }

  function stopPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
  }

  function startPolling(uploadId: string) {
    pollStartTimeRef.current = Date.now();
    setStatusMessage(getStatusMessage(0));
    setElapsedSec(0);

    // Update status message and elapsed timer every second
    statusIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - pollStartTimeRef.current;
      setStatusMessage(getStatusMessage(elapsed));
      setElapsedSec(Math.floor(elapsed / 1000));
    }, 1000);

    // Poll summary endpoint every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      const elapsed = Date.now() - pollStartTimeRef.current;

      if (elapsed > MAX_POLL_MS) {
        stopPolling();
        setTimedOutUploadId(uploadId);
        setError('Processing is taking longer than expected. The analysis may still complete in the background.');
        setUploading(false);
        return;
      }

      try {
        const result = await api.summary(uploadId);
        if (result.upload.status === 'completed') {
          stopPolling();
          router.push(`/dashboard/${uploadId}`);
        } else if (result.upload.status === 'failed') {
          stopPolling();
          setError('Analysis failed. Please try uploading again.');
          setUploading(false);
        }
      } catch {
        // Summary endpoint may 404 while upload is still processing
        // Keep polling until timeout
      }
    }, POLL_INTERVAL);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError('');
    setTimedOutUploadId(null);

    try {
      const data = await api.uploadFile(file);
      startPolling(data.uploadId);
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  }

  function handleReset() {
    stopPolling();
    setUploading(false);
    setError('');
    setTimedOutUploadId(null);
    setFile(null);
  }

  async function handleLogout() {
    await api.logout();
    router.replace('/login');
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link href="/dashboard" className="text-lg font-bold hover:text-zinc-300 transition-colors">Tenex Log Analyzer</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-400">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Upload area */}
      <main className="max-w-2xl mx-auto mt-16 px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 hover:text-zinc-100 transition-colors">← Back to dashboard</Link>
        <h2 className="text-2xl font-bold mb-2 mt-2">Upload Log File</h2>
        <p className="text-zinc-400 mb-8">
          Upload a Zscaler web proxy log file (.jsonl, .json, .log, .txt) up to 10 MB.
        </p>

        {/* Drag-drop zone */}
        {!uploading && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors
              ${dragOver
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              onChange={handleInputChange}
              className="hidden"
              aria-label="Upload log file"
            />
            {file ? (
              <div>
                <p className="text-zinc-100 font-medium">{file.name}</p>
                <p className="text-zinc-500 text-sm mt-1">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-zinc-400">Drag and drop a log file here</p>
                <p className="text-zinc-600 text-sm mt-1">or click to browse</p>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            <p>{error}</p>
            <div className="flex gap-3 mt-3">
              {timedOutUploadId && (
                <button
                  type="button"
                  onClick={() => router.push(`/dashboard/${timedOutUploadId}`)}
                  className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  View dashboard anyway
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-1.5 text-sm font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded hover:bg-zinc-700 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {/* Upload button / processing status */}
        {uploading ? (
          <div className="mt-8 text-center">
            {/* Spinner */}
            <div className="inline-block w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />

            {/* Status message */}
            <p className="text-zinc-200 text-lg font-medium mt-4">{statusMessage}</p>

            {/* Elapsed time */}
            <p className="text-zinc-500 text-sm mt-2">
              {elapsedSec < 60
                ? `${elapsedSec}s elapsed`
                : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s elapsed`
              }
            </p>

            {/* Progress hint */}
            <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400">
              <p>Your file is being analyzed. This typically takes 15-30 seconds.</p>
              <p className="mt-1">You will be automatically redirected when analysis completes.</p>
            </div>
          </div>
        ) : !error && (
          <button
            onClick={handleUpload}
            disabled={!file}
            className="mt-6 w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Upload and Analyze
          </button>
        )}
      </main>
    </div>
  );
}
