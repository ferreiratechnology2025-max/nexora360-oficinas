'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Car, User, FileText, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '@/types';

const diagSchema = z.object({
  diagnosis: z.string().min(3, 'Diagnóstico obrigatório'),
});
type DiagForm = z.infer<typeof diagSchema>;

export default function MechanicOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [savingDiag, setSavingDiag] = useState(false);
  const [error, setError] = useState('');
  const [diagSaved, setDiagSaved] = useState(false);

  const diagForm = useForm<DiagForm>({ resolver: zodResolver(diagSchema) });

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      const o: Order = res.data;
      setOrder(o);
      if (o.diagnosis) diagForm.setValue('diagnosis', o.diagnosis);
    } catch {
      setError('OS não encontrada.');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  async function advanceStatus() {
    if (!order) return;
    const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
    if (currentIdx < 0 || currentIdx >= ORDER_STATUS_SEQUENCE.length - 1) return;
    const nextStatus = ORDER_STATUS_SEQUENCE[currentIdx + 1];
    setAdvancing(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${id}/status`, { status: nextStatus });
      setOrder(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao avançar status.');
    } finally {
      setAdvancing(false);
    }
  }

  async function saveDiagnosis(data: DiagForm) {
    setSavingDiag(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${id}`, { diagnosis: data.diagnosis });
      setOrder(res.data);
      setDiagSaved(true);
      setTimeout(() => setDiagSaved(false), 2500);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao salvar diagnóstico.');
    } finally {
      setSavingDiag(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="animate-pulse space-y-4 max-w-lg mx-auto">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-200 rounded-xl h-24" />)}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center text-gray-400">
          <p>{error || 'OS não encontrada'}</p>
          <button onClick={() => router.push('/mechanic/orders')} className="mt-4 text-blue-600 text-sm">
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
  const canAdvance = order.status !== 'delivered' && order.status !== 'cancelled' && currentIdx >= 0;
  const nextStatus = canAdvance ? ORDER_STATUS_SEQUENCE[currentIdx + 1] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={() => router.push('/mechanic/orders')}
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-gray-400">{order.orderNumber}</p>
          <p className="font-semibold text-gray-800 truncate">{order.customer.name}</p>
        </div>
        <StatusBadge status={order.status as OrderStatus} />
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Advance status */}
        {canAdvance && nextStatus && (
          <Button onClick={advanceStatus} loading={advancing} className="w-full" size="lg">
            <ChevronRight className="w-5 h-5" />
            Avançar para {ORDER_STATUS_LABELS[nextStatus]}
          </Button>
        )}
        {!canAdvance && (
          <div className="bg-gray-100 rounded-xl p-4 text-center text-sm text-gray-500">
            OS finalizada
          </div>
        )}

        {/* Vehicle info */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <Car className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">
                {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
              </p>
              <p className="text-sm font-mono text-gray-500">{order.vehicle.plate}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">{order.customer.name}</p>
              <p className="text-sm text-gray-500">{order.customer.phone}</p>
            </div>
          </div>
        </div>

        {/* Problem description */}
        {order.problemDescription && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Problema relatado</p>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{order.problemDescription}</p>
          </div>
        )}

        {/* Diagnosis input */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Diagnóstico</p>
          <form onSubmit={diagForm.handleSubmit(saveDiagnosis)} className="space-y-3">
            <Textarea
              rows={4}
              placeholder="Descreva o diagnóstico técnico..."
              error={diagForm.formState.errors.diagnosis?.message}
              {...diagForm.register('diagnosis')}
            />
            <Button
              type="submit"
              variant={diagSaved ? 'secondary' : 'primary'}
              className="w-full"
              loading={savingDiag}
            >
              {diagSaved ? (
                <>
                  <Check className="w-4 h-4" /> Diagnóstico salvo!
                </>
              ) : (
                'Salvar diagnóstico'
              )}
            </Button>
          </form>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Progresso</p>
          <div className="space-y-2">
            {ORDER_STATUS_SEQUENCE.map((s, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s} className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full shrink-0 ${
                      active ? 'bg-blue-600 ring-2 ring-blue-200' : done ? 'bg-gray-700' : 'bg-gray-200'
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      active ? 'font-semibold text-blue-600' : done ? 'text-gray-700' : 'text-gray-400'
                    }`}
                  >
                    {ORDER_STATUS_LABELS[s]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dates */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-sm text-gray-500 space-y-1">
          <p>
            <span className="font-medium text-gray-700">Abertura:</span>{' '}
            {format(new Date(order.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
          {order.deliveredAt && (
            <p>
              <span className="font-medium text-gray-700">Entrega:</span>{' '}
              {format(new Date(order.deliveredAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
