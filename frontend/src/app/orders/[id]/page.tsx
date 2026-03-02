'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft, User, Car, Wrench,
  ChevronRight, X, Share2, Clock,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '@/types';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get(`/orders/${id}`);
      setOrder(res.data);
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

  async function cancelOrder() {
    setCancelling(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${id}/status`, { status: 'cancelled' });
      setOrder(res.data);
      setConfirmCancel(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao cancelar OS.');
    } finally {
      setCancelling(false);
    }
  }

  function copyTrackingLink() {
    if (!order) return;
    const url = `${window.location.origin}/tracking/${order.trackingToken}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }

  if (loading) {
    return (
      <AppShell title="Ordem de Serviço">
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-28" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell title="Ordem de Serviço">
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{error || 'OS não encontrada'}</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/orders')}>
            <ChevronLeft className="w-4 h-4" /> Voltar
          </Button>
        </div>
      </AppShell>
    );
  }

  const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
  const canAdvance = order.status !== 'delivered' && order.status !== 'cancelled' && currentIdx >= 0;
  const canCancel = order.status !== 'delivered' && order.status !== 'cancelled';
  const nextStatus = canAdvance ? ORDER_STATUS_SEQUENCE[currentIdx + 1] : null;

  return (
    <AppShell title={`OS ${order.orderNumber}`}>
      {/* Back + share */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => router.push('/orders')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-4 h-4" /> Ordens
        </button>
        <button
          onClick={copyTrackingLink}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
        >
          <Share2 className="w-4 h-4" />
          Copiar link de rastreio
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* Status + actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-400 font-mono mb-1">{order.orderNumber}</p>
              <StatusBadge status={order.status as OrderStatus} size="lg" />
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Abertura</p>
              <p className="text-sm text-gray-600">
                {format(new Date(order.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Status timeline */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4">
            {ORDER_STATUS_SEQUENCE.map((s, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s} className="flex items-center flex-shrink-0">
                  <div
                    className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-600'
                        : done
                        ? 'bg-gray-800 border-gray-800'
                        : 'bg-white border-gray-300'
                    }`}
                  />
                  {i < ORDER_STATUS_SEQUENCE.length - 1 && (
                    <div className={`w-5 h-0.5 ${done && !active ? 'bg-gray-800' : 'bg-gray-200'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {canAdvance && nextStatus && (
              <Button onClick={advanceStatus} loading={advancing} className="flex-1">
                <ChevronRight className="w-4 h-4" />
                Avançar para {ORDER_STATUS_LABELS[nextStatus]}
              </Button>
            )}
            {canCancel && !confirmCancel && (
              <Button variant="danger" size="sm" onClick={() => setConfirmCancel(true)}>
                <X className="w-4 h-4" />
                Cancelar OS
              </Button>
            )}
            {confirmCancel && (
              <div className="flex gap-2 w-full">
                <Button variant="danger" onClick={cancelOrder} loading={cancelling} className="flex-1">
                  Confirmar cancelamento
                </Button>
                <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
                  Não
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Customer */}
        <Section title="Cliente">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">{order.customer.name}</p>
              <p className="text-sm text-gray-500">{order.customer.phone}</p>
              {order.customer.email && <p className="text-xs text-gray-400">{order.customer.email}</p>}
            </div>
          </div>
        </Section>

        {/* Vehicle */}
        <Section title="Veículo">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Car className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">
                {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
              </p>
              <p className="text-sm font-mono text-gray-500">{order.vehicle.plate}</p>
              {order.vehicle.color && <p className="text-xs text-gray-400">{order.vehicle.color}</p>}
            </div>
          </div>
        </Section>

        {/* Problem / Diagnosis */}
        <Section title="Problema e Diagnóstico">
          {order.problemDescription && (
            <div className="mb-3">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Relatado</p>
              <p className="text-sm text-gray-700 leading-relaxed">{order.problemDescription}</p>
            </div>
          )}
          {order.diagnosis ? (
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Diagnóstico</p>
              <p className="text-sm text-gray-700 leading-relaxed">{order.diagnosis}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Diagnóstico pendente</p>
          )}
        </Section>

        {/* Mechanic */}
        <Section title="Mecânico">
          {order.mechanic ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4 text-green-600" />
              </div>
              <p className="font-medium text-gray-800">{order.mechanic.name}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">Nenhum mecânico atribuído</p>
          )}
        </Section>

        {/* Financial */}
        <Section title="Valores">
          <InfoRow label="Mão de obra" value={BRL(order.laborValue)} />
          <InfoRow label="Peças" value={BRL(order.partsValue)} />
          <div className="flex justify-between py-2 mt-1 border-t border-gray-200">
            <span className="font-semibold text-gray-800">Total</span>
            <span className="font-bold text-lg text-gray-900">{BRL(order.totalValue)}</span>
          </div>
        </Section>

        {/* Delivery */}
        {order.deliveredAt && (
          <Section title="Entrega">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4 text-gray-400" />
              {format(new Date(order.deliveredAt), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </Section>
        )}
      </div>
    </AppShell>
  );
}
