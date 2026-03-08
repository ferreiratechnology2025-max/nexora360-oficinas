'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronLeft, Save } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cpf: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function CustomerEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    api.get(`/customers/${id}`)
      .then((res) => {
        const c = res.data;
        form.reset({
          name: c.name ?? '',
          phone: c.phone ?? '',
          email: c.email ?? '',
          cpf: c.cpf ?? '',
          address: c.address ?? '',
          city: c.city ?? '',
          notes: c.notes ?? '',
        });
      })
      .catch(() => setError('Cliente não encontrado.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError('');
    try {
      await api.put(`/customers/${id}`, data);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 max-w-lg">
        {[...Array(5)].map((_, i) => <div key={i} className="bg-gray-200 rounded-lg h-12" />)}
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/customers')}
          className="text-gray-400 hover:text-gray-600"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Editar Cliente</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Nome *"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Input
            label="Telefone (WhatsApp) *"
            type="tel"
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
          <Input
            label="E-mail"
            type="email"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Input
            label="CPF"
            error={form.formState.errors.cpf?.message}
            {...form.register('cpf')}
          />
          <Input
            label="Endereço"
            error={form.formState.errors.address?.message}
            {...form.register('address')}
          />
          <Input
            label="Cidade"
            error={form.formState.errors.city?.message}
            {...form.register('city')}
          />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
              Cliente atualizado com sucesso.
            </div>
          )}

          <Button type="submit" className="w-full" loading={saving}>
            <Save className="w-4 h-4" />
            Salvar alterações
          </Button>
        </form>
      </div>
    </div>
  );
}
