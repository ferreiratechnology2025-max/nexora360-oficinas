'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Car, User, FileText, Check, Camera, Trash2, ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea, Input } from '@/components/ui/Input';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE } from '@/types';

interface OrderFile {
  id: string;
  url: string;
  originalName: string;
  stage?: string;
  createdAt: string;
}

const diagSchema = z.object({
  diagnosis: z.string().min(3, 'Diagnóstico obrigatório'),
  currentKm: z.string().optional(),
});
type DiagForm = z.infer<typeof diagSchema>;

export default function MechanicOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);

  const [photos, setPhotos] = useState<OrderFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const diagForm = useForm<DiagForm>({ resolver: zodResolver(diagSchema) });

  async function load() {
    setLoading(true);
    try {
      const [orderRes, photosRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/photos`),
      ]);
      const o: Order = orderRes.data;
      setOrder(o);
      if (o.diagnosis) diagForm.setValue('diagnosis', o.diagnosis);
      if (o.currentKm) diagForm.setValue('currentKm', String(o.currentKm));
      setPhotos(photosRes.data ?? []);
    } catch {
      setError('OS não encontrada.');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  /** Salva diagnóstico + KM e avança received → diagnosis */
  async function saveDiagnosis(data: DiagForm) {
    setSaving(true);
    setError('');
    try {
      // Save diagnosis + KM
      await api.put(`/orders/${id}`, {
        diagnosis: data.diagnosis,
        currentKm: data.currentKm ? parseInt(data.currentKm) : undefined,
      });

      // If still 'received', advance to 'diagnosis'
      if (order?.status === 'received') {
        const r = await api.patch(`/orders/${id}/advance`, { diagnosis: data.diagnosis });
        setOrder(r.data);
      } else {
        // Just reload to show updated data
        const r = await api.get(`/orders/${id}`);
        setOrder(r.data);
      }

      setIsSaving(true);
      setDraftSaved(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao salvar diagnóstico.');
    } finally {
      setSaving(false);
    }
  }

  /** Avança status para in_progress / testing / ready */
  async function advanceStatus() {
    if (!order) return;
    const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(order.status as OrderStatus);
    if (currentIdx < 0 || currentIdx >= ORDER_STATUS_SEQUENCE.length - 1) return;
    setAdvancing(true);
    setError('');
    try {
      const res = await api.patch(`/orders/${id}/advance`, {});
      setOrder(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao avançar status.');
    } finally {
      setAdvancing(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stage', 'general');
      const res = await api.post(`/orders/${id}/photos`, formData, {
        headers: { 'Content-Type': undefined },
      });
      setPhotos((prev) => [...prev, res.data]);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setUploadError(e?.response?.data?.message ?? 'Erro ao enviar foto.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deletePhoto(photoId: string) {
    setDeletingId(photoId);
    try {
      await api.delete(`/orders/${id}/photos/${photoId}`);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
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
  const isTerminal = ['delivered', 'cancelled', 'rejected'].includes(order.status);
  const showDiagForm = order.status === 'received' || order.status === 'diagnosis';
  // Mechanic can advance in_progress and testing only (stops at ready)
  const canAdvance = !isTerminal && !showDiagForm
    && order.status !== 'waiting_approval'
    && order.status !== 'ready';
  const nextStatusLabel = canAdvance && currentIdx >= 0
    ? ORDER_STATUS_LABELS[ORDER_STATUS_SEQUENCE[currentIdx + 1]]
    : null;

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
          <p className="font-semibold text-gray-800 truncate">{order.customer?.name ?? '—'}</p>
        </div>
        <StatusBadge status={order.status as OrderStatus} />
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Status-based action area */}
        {canAdvance && nextStatusLabel && (
          <Button onClick={advanceStatus} loading={advancing} className="w-full" size="lg">
            <ChevronRight className="w-5 h-5" />
            Avançar para {nextStatusLabel}
          </Button>
        )}
        {order.status === 'ready' && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center text-sm text-green-800">
            ✅ Veículo pronto — aguardando retirada pelo cliente
          </div>
        )}
        {order.status === 'waiting_approval' && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center text-sm text-orange-800">
            ⏳ Aguardando aprovação do cliente
          </div>
        )}
        {order.status === 'diagnosis' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center text-sm text-yellow-800">
            ✅ Diagnóstico salvo — aguardando dono enviar orçamento
          </div>
        )}
        {isTerminal && (
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
                {order.vehicle?.brand} {order.vehicle?.model} {order.vehicle?.year}
              </p>
              <p className="text-sm font-mono text-gray-500">{order.vehicle?.plate ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-800">{order.customer?.name ?? '—'}</p>
              <p className="text-sm text-gray-500">{order.customer?.phone ?? '—'}</p>
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

        {/* Diagnosis form — shown for received / diagnosis */}
        {showDiagForm && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Diagnóstico</p>

            <Textarea
              rows={4}
              placeholder="Descreva o diagnóstico técnico..."
              error={diagForm.formState.errors.diagnosis?.message}
              {...diagForm.register('diagnosis')}
            />

            <Input
              label="KM atual do veículo"
              type="number"
              placeholder="Ex: 85000"
              {...diagForm.register('currentKm')}
            />

            <Button
              type="button"
              onClick={diagForm.handleSubmit(saveDiagnosis)}
              className="w-full"
              size="lg"
              loading={saving}
              disabled={isSaving || saving}
            >
              {draftSaved
                ? <><Check className="w-5 h-5" /> Diagnóstico salvo!</>
                : <><Check className="w-5 h-5" /> Salvar diagnóstico</>
              }
            </Button>
          </div>
        )}

        {/* Diagnosis read-only (after diagnosis stage) */}
        {!showDiagForm && order.diagnosis && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Diagnóstico</p>
            <p className="text-sm text-gray-700 leading-relaxed">{order.diagnosis}</p>
          </div>
        )}

        {/* Photos */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Fotos</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 font-medium"
            >
              <Camera className="w-4 h-4" />
              {uploading ? 'Enviando...' : 'Adicionar foto'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {uploadError && (
            <p className="text-xs text-red-600 mb-2">{uploadError}</p>
          )}

          {photos.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              <ImageOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">Nenhuma foto adicionada</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.originalName}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => deletePhoto(photo.id)}
                    disabled={deletingId === photo.id}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
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
