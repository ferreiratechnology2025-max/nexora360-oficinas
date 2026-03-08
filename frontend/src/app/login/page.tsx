'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { setToken, setUser } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const ownerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

const mechanicSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

type OwnerForm = z.infer<typeof ownerSchema>;
type MechanicForm = z.infer<typeof mechanicSchema>;

type Mode = 'owner' | 'mechanic';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('owner');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');

  const ownerForm = useForm<OwnerForm>({ resolver: zodResolver(ownerSchema) });
  const mechanicForm = useForm<MechanicForm>({ resolver: zodResolver(mechanicSchema) });

  const isSubmitting = mode === 'owner' ? ownerForm.formState.isSubmitting : mechanicForm.formState.isSubmitting;

  async function onOwnerSubmit(data: OwnerForm) {
    setError('');
    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, user } = res.data;
      if (!accessToken || !user) { setError('Credenciais inválidas.'); return; }
      setToken(accessToken);
      setUser(user);
      if (user.role === 'superadmin') router.push('/admin');
      else router.push('/dashboard');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr?.response?.data?.message ?? 'Erro ao entrar. Verifique suas credenciais.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
  }

  async function onMechanicSubmit(data: MechanicForm) {
    setError('');
    try {
      const res = await api.post('/auth/mechanic-login', { email: data.email, password: data.password });
      const { accessToken, user } = res.data;
      if (!accessToken || !user) { setError('Credenciais inválidas.'); return; }
      setToken(accessToken);
      setUser(user);
      router.push('/mechanic/orders');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const msg = axiosErr?.response?.data?.message ?? 'Erro ao entrar. Verifique suas credenciais.';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setShowPass(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Nexora<span className="text-blue-400">360</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestão completa para sua oficina</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-gray-100 rounded-xl">
            <button
              type="button"
              onClick={() => switchMode('owner')}
              className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                mode === 'owner'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              👑 Dono
            </button>
            <button
              type="button"
              onClick={() => switchMode('mechanic')}
              className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                mode === 'mechanic'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🔧 Mecânico
            </button>
          </div>

          {mode === 'owner' ? (
            <>
              <p className="text-xs text-gray-500 mb-4 -mt-2">Acesso ao painel completo da oficina.</p>
              <form onSubmit={ownerForm.handleSubmit(onOwnerSubmit)} className="space-y-4">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  error={ownerForm.formState.errors.email?.message}
                  {...ownerForm.register('email')}
                />
                <PasswordField
                  showPass={showPass}
                  onToggle={() => setShowPass((v) => !v)}
                  error={ownerForm.formState.errors.password?.message}
                  {...ownerForm.register('password')}
                />
                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  Entrar
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4 -mt-2">Acesso às ordens de serviço atribuídas a você.</p>
              <form onSubmit={mechanicForm.handleSubmit(onMechanicSubmit)} className="space-y-4">
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  error={mechanicForm.formState.errors.email?.message}
                  {...mechanicForm.register('email')}
                />
                <PasswordField
                  showPass={showPass}
                  onToggle={() => setShowPass((v) => !v)}
                  error={mechanicForm.formState.errors.password?.message}
                  {...mechanicForm.register('password')}
                />
                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
                  Entrar
                </Button>
              </form>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Ainda não tem conta?{' '}
              <Link href="/register" className="text-blue-600 font-medium hover:underline">
                Cadastrar minha oficina
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
      {message}
    </div>
  );
}

import { forwardRef } from 'react';

const PasswordField = forwardRef<
  HTMLInputElement,
  { showPass: boolean; onToggle: () => void; error?: string } & React.InputHTMLAttributes<HTMLInputElement>
>(({ showPass, onToggle, error, ...rest }, ref) => (
  <div className="flex flex-col gap-1">
    <label className="text-sm font-medium text-gray-700">Senha</label>
    <div className="relative">
      <input
        type={showPass ? 'text' : 'password'}
        placeholder="••••••••"
        autoComplete="current-password"
        ref={ref}
        className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
          error ? 'border-red-400 bg-red-50' : 'border-gray-300'
        }`}
        {...rest}
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        onClick={onToggle}
      >
        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
    {error && <span className="text-xs text-red-600">{error}</span>}
  </div>
));
PasswordField.displayName = 'PasswordField';
