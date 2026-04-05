'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
const ACCEPTED_EXTENSIONS = '.jsonl,.json,.log,.txt';
const STATUS_MESSAGES = [
  'Uploading file...',
  'Parsing log entries...',
  'Running detection rules...',
  'Analyzing with AI...',
];

export default function UploadPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusIdx, setStatusIdx] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth check
  useEffect(() => {
    fetch(`${BACKEND}/api/auth/me`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated');
        return res.json();
      })
      .then(data => { setUser(data.user); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  // Rotating status messages during upload
  useEffect(() => {
    if (!uploading) return;
    const interval = setInterval(() => {
      setStatusIdx(prev => (prev + 1) % STATUS_MESSAGES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [uploading]);

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

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setStatusIdx(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${BACKEND}/api/uploads`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (res.status === 413) {
        throw new Error('File too large. Maximum size is 10 MB.');
      }
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Upload failed (HTTP ${res.status})`);
      }

      const data = await res.json();
      console.log('Upload complete:', data);

      // Wait 3 seconds for pipeline stub, then redirect
      await new Promise(resolve => setTimeout(resolve, 3000));
      router.push(`/dashboard/${data.uploadId}`);
    } catch (e) {
      setError((e as Error).message);
      setUploading(false);
    }
  }

  async function handleLogout() {
    await fetch(`${BACKEND}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
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
        <h1 className="text-lg font-bold">Tenex Log Analyzer</h1>
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
        <h2 className="text-2xl font-bold mb-2">Upload Log File</h2>
        <p className="text-zinc-400 mb-8">
          Upload a Zscaler web proxy log file (.jsonl, .json, .log, .txt) up to 10 MB.
        </p>

        {/* Drag-drop zone */}
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

        {/* Error message */}
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Upload button / status */}
        {uploading ? (
          <div className="mt-6 text-center">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-300 mt-3">{STATUS_MESSAGES[statusIdx]}</p>
          </div>
        ) : (
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
