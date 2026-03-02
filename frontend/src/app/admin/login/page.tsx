'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ShieldAlert } from 'lucide-react';
import axios from 'axios';
import { setToken, setUser } from '@/lib/auth';
import { Button } from '@/components/ui/Button';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
      const res = await axios.post(`${BASE_URL}/auth/login`, { email, password });
      const { accessToken, user } = res.data;

      if (user?.role !== 'superadmin') {
        setError('Acesso restrito ao painel administrativo.');
        return;
      }

      setToken(accessToken);
      setUser(user);
      router.push('/admin/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-950 rounded-2xl mb-4">
            <ShieldAlert className="w-7 h-7 text-red-400" />
          </div>
          <div>
            <span className="text-2xl font-bold text-blue-400">Nexora</span>
            <span className="text-2xl font-bold text-white">360</span>
          </div>
          <p className="text-red-400 text-xs font-bold tracking-widest uppercase mt-1">Painel Administrativo</p>
        </div>

        <form onSubmit={submit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@nexora360.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-400">Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 pr-10 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Entrar como Admin
          </Button>
        </form>
      </div>
    </div>
  );
}
