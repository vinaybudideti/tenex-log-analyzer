'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@tenex.demo');
  const [password, setPassword] = useState('Demo1234!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.login(email, password);
      router.push('/dashboard');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-8 bg-zinc-900 rounded-lg border border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Tenex Log Analyzer</h1>
        <input className="w-full mb-3 px-4 py-2 bg-zinc-800 text-zinc-100 rounded border border-zinc-700" value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" />
        <input className="w-full mb-4 px-4 py-2 bg-zinc-800 text-zinc-100 rounded border border-zinc-700" value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" />
        {error && <div className="mb-4 text-red-400 text-sm">{error}</div>}
        <button disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </div>
  );
}
