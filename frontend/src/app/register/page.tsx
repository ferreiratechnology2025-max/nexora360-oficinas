'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Form {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  ownerName: string;
  password: string;
}

function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function isValidCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  return d.length === 14;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<Form>({
    nome: '', cnpj: '', telefone: '', email: '', ownerName: '', password: '',
  });
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState<'trial' | 'plan' | null>(null);

  function set(key: keyof Form, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate() {
    const e: Partial<Form> = {};
    if (!form.nome.trim()) e.nome = 'Nome da oficina obrigatório';
    if (!isValidCNPJ(form.cnpj)) e.cnpj = 'CNPJ inválido';
    if (!form.telefone.trim()) e.telefone = 'Telefone obrigatório';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email inválido';
    if (!form.ownerName.trim()) e.ownerName = 'Seu nome é obrigatório';
    if (!form.password || form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(type: 'trial' | 'plan') {
    if (!validate()) return;
    setLoading(type);
    try {
      const res = await api.post('/auth/register', {
        nome: form.nome,
        cnpj: form.cnpj.replace(/\D/g, ''),
        telefone: form.telefone.replace(/\D/g, ''),
        email: form.email,
        ownerName: form.ownerName,
        password: form.password,
      });
      const { tenantId } = res.data ?? {};
      if (type === 'trial') {
        router.push('/register/pending');
      } else {
        router.push(`/register/plan${tenantId ? `?tenantId=${tenantId}` : ''}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <span className="text-3xl font-bold text-blue-400">Nexora</span>
            <span className="text-3xl font-bold text-white">360</span>
          </div>
          <p className="text-gray-400 text-sm">Cadastre sua oficina e comece a crescer</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          <h1 className="text-lg font-bold text-gray-900 mb-2">Criar conta</h1>

          <Input
            label="Nome da oficina"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            error={errors.nome}
            placeholder="Auto Center Silva"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">CNPJ</label>
            <input
              value={form.cnpj}
              onChange={(e) => set('cnpj', formatCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                ${errors.cnpj ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.cnpj && <span className="text-xs text-red-600">{errors.cnpj}</span>}
            {form.cnpj.replace(/\D/g, '').length === 14 && !errors.cnpj && (
              <span className="text-xs text-green-600">CNPJ válido ✓</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              error={errors.telefone}
              placeholder="(11) 99999-9999"
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              placeholder="contato@oficina.com"
            />
          </div>

          <Input
            label="Seu nome (responsável)"
            value={form.ownerName}
            onChange={(e) => set('ownerName', e.target.value)}
            error={errors.ownerName}
            placeholder="João Silva"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={`w-full px-3 py-2.5 pr-10 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <span className="text-xs text-red-600">{errors.password}</span>}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="secondary"
              loading={loading === 'trial'}
              disabled={loading === 'plan'}
              onClick={() => submit('trial')}
            >
              Testar 7 dias grátis
            </Button>
            <Button
              loading={loading === 'plan'}
              disabled={loading === 'trial'}
              onClick={() => submit('plan')}
            >
              Assinar agora
            </Button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Já tem conta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline">Entrar</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
