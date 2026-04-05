'use client';
import { useParams } from 'next/navigation';

export default function UploadDashboardPage() {
  const params = useParams<{ uploadId: string }>();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <h1 className="text-2xl font-bold">Upload Dashboard (stub - built in Hour 6)</h1>
      <p className="text-zinc-400 mt-2">Upload ID: {params.uploadId}</p>
      <p className="text-zinc-500 mt-1">Incident cards, evidence drill-in, and timeline will appear here.</p>
    </div>
  );
}
