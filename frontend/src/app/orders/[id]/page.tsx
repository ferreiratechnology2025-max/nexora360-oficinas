'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft, User, Car, Wrench,
  ChevronRight, X, Share2, Clock, ImageOff, UserPlus,
} from 'lucide-react';
import { Select, Input } from '@/components/ui/Input';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '@/types';

interface OrderFile {
  id: string;
  url: string;
  originalName: string;
  stage?: string;
  createdAt: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
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
  const [photos, setPhotos] = useState<OrderFile[]>([]);

  // Budget editing (only when status = 'diagnosis')
  const [laborInput, setLaborInput] = useState('');
  const [partsInput, setPartsInput] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);

  // Mechanic assignment
  const [mechanics, setMechanics] = useState<{ id: string; name: string }[]>([]);
  const [assigningMechanic, setAssigningMechanic] = useState(false);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [savingMechanic, setSavingMechanic] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [orderRes, photosRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/photos`),
      ]);
      const o: Order = orderRes.data;
      setOrder(o);
      setPhotos(photosRes.data ?? []);
      setLaborInput(String(o.laborValue ?? 0));
      setPartsInput(String(o.partsValue ?? 0));
      if (!o.mechanic) {
        api.get('/users/mechanics').then((r) => setMechanics(r.data ?? [])).catch(() => {});
      }
    } catch {
      setError('OS não encontrada.');
    } finally {
      setLoading(false);
    }
  }

  async function loadMechanics() {
    if (mechanics.length > 0) return;
    try {
      const r = await api.get('/users/mechanics');
      setMechanics(r.data ?? []);
    } catch {}
  }

  async function assignMechanic() {
    if (!selectedMechanicId) return;
    setSavingMechanic(true);
    setError('');
    try {
      const res = await api.put(`/orders/${id}`, { mechanicId: selectedMechanicId });
      setOrder(res.data);
      setAssigningMechanic(false);
      setSelectedMechanicId('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao atribuir mecânico.');
    } finally {
      setSavingMechanic(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  async function advanceStatus() {
    if (!order) return;
    const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
    if (currentIdx < 0 || currentIdx >= ORDER_STATUS_SEQUENCE.length - 1) return;
    setAdvancing(true);
    setError('');
    try {
      const body = order.status === 'waiting_approval' ? { clientApproved: true } : {};
      const res = await api.patch(`/orders/${id}/advance`, body);
      setOrder(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao avançar status.');
    } finally {
      setAdvancing(false);
    }
  }

  /** Owner sends budget and advances diagnosis → waiting_approval */
  async function sendQuote() {
    if (!order) return;
    setSendingQuote(true);
    setError('');
    try {
      const laborValue = parseFloat(laborInput.replace(',', '.')) || 0;
      const partsValue = parseFloat(partsInput.replace(',', '.')) || 0;

      // Save values + advance to waiting_approval in one step
      const res = await api.patch(`/orders/${id}/advance`, { laborValue, partsValue });
      setOrder(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao enviar orçamento.');
    } finally {
      setSendingQuote(false);
    }
  }

  async function cancelOrder() {
    setCancelling(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${id}/cancel`);
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
    const url = `https://track.nexora360.cloud/tracking/${order.trackingToken}`;
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
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(order.status);
  const canCancel = !isTerminal;
  const nextStatus = !isTerminal && currentIdx >= 0 && currentIdx < ORDER_STATUS_SEQUENCE.length - 1
    ? ORDER_STATUS_SEQUENCE[currentIdx + 1]
    : null;
  // Owner can advance for all statuses EXCEPT 'diagnosis' (uses send quote button)
  const canAdvance = nextStatus !== null && order.status !== 'diagnosis';

  const laborValue = parseFloat(laborInput.replace(',', '.')) || 0;
  const partsValue = parseFloat(partsInput.replace(',', '.')) || 0;
  const totalPreview = laborValue + partsValue;

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

          {/* Rejected badge */}
          {order.status === 'rejected' && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              ❌ O cliente recusou o orçamento. Entre em contato para negociar.
            </div>
          )}

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

        {/* ORÇAMENTO — editável apenas no status diagnosis */}
        {order.status === 'diagnosis' && (
          <div className="bg-white rounded-xl shadow-sm border border-blue-200 p-4">
            <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3">
              Orçamento
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                label="Mão de obra (R$)"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={laborInput}
                onChange={(e) => setLaborInput(e.target.value)}
              />
              <Input
                label="Peças (R$)"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={partsInput}
                onChange={(e) => setPartsInput(e.target.value)}
              />
            </div>
            <div className="flex justify-between items-center py-2 border-t border-gray-100 mb-4">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="font-bold text-lg text-gray-900">{BRL(totalPreview)}</span>
            </div>
            <Button onClick={sendQuote} loading={sendingQuote} className="w-full" size="lg">
              <ChevronRight className="w-4 h-4" />
              Enviar orçamento para aprovação
            </Button>
          </div>
        )}

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
          {order.mechanic && !assigningMechanic ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <Wrench className="w-4 h-4 text-green-600" />
                </div>
                <p className="font-medium text-gray-800">{order.mechanic.name}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { loadMechanics(); setAssigningMechanic(true); setSelectedMechanicId(''); }}
              >
                Reatribuir
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {!order.mechanic && (
                <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  Nenhum mecânico atribuído
                </div>
              )}
              {mechanics.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Carregando mecânicos...</p>
              ) : (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={selectedMechanicId}
                      onChange={(e) => setSelectedMechanicId(e.target.value)}
                    >
                      <option value="">Selecione o mecânico...</option>
                      {mechanics.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </Select>
                  </div>
                  <Button onClick={assignMechanic} loading={savingMechanic} disabled={!selectedMechanicId}>
                    Atribuir
                  </Button>
                  {assigningMechanic && (
                    <Button variant="secondary" onClick={() => setAssigningMechanic(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Photos — read-only for owner */}
        <Section title={`Fotos${photos.length > 0 ? ` (${photos.length})` : ''}`}>
          {photos.length === 0 ? (
            <div className="text-center py-4 text-gray-400">
              <ImageOff className="w-7 h-7 mx-auto mb-1.5 opacity-40" />
              <p className="text-xs">Nenhuma foto adicionada pelo mecânico</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <a
                  key={photo.id}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square block"
                >
                  <img
                    src={photo.url}
                    alt={photo.originalName}
                    className="w-full h-full object-cover rounded-lg hover:opacity-90 transition-opacity"
                  />
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* Financial — read-only (shown after diagnosis step) */}
        {order.status !== 'diagnosis' && order.status !== 'received' && (
          <Section title="Valores">
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-500">Mão de obra</span>
              <span className="text-sm font-medium text-gray-800">{BRL(order.laborValue ?? 0)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-gray-50">
              <span className="text-sm text-gray-500">Peças</span>
              <span className="text-sm font-medium text-gray-800">{BRL(order.partsValue ?? 0)}</span>
            </div>
            <div className="flex justify-between py-2 mt-1 border-t border-gray-200">
              <span className="font-semibold text-gray-800">Total</span>
              <span className="font-bold text-lg text-gray-900">{BRL((order.laborValue ?? 0) + (order.partsValue ?? 0))}</span>
            </div>
          </Section>
        )}

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
