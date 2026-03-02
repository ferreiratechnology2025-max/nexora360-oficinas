'use client';
import { useEffect, useState } from 'react';
import { Check, X, Clock, Building2, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';

interface Trial {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cnpj?: string;
  ownerName?: string;
  createdAt: string;
  trialEndsAt?: string;
}

interface RejectModalState { open: boolean; tenantId: string; tenantName: string }

export default function AdminTrialsPage() {
  const [trials, setTrials] = useState<Trial[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [modal, setModal] = useState<RejectModalState>({ open: false, tenantId: '', tenantName: '' });
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/admin/trials/pending');
      setTrials(res.data?.trials ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function approve(tenantId: string) {
    setApproving(tenantId);
    try {
      await api.post(`/admin/trials/${tenantId}/approve`);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setApproving(null);
    }
  }

  async function reject() {
    setRejecting(modal.tenantId);
    try {
      await api.post(`/admin/trials/${modal.tenantId}/reject`, { reason: rejectReason });
      setModal({ open: false, tenantId: '', tenantName: '' });
      setRejectReason('');
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setRejecting(null);
    }
  }

  return (
    <AdminShell title="Trials Pendentes">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Fila de aprovação</h2>
          <p className="text-sm text-gray-400">{trials.length} oficina{trials.length !== 1 ? 's' : ''} aguardando</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : trials.length === 0 ? (
        <div className="text-center py-20">
          <Check className="w-12 h-12 text-green-500 mx-auto mb-3 opacity-60" />
          <p className="text-gray-400">Nenhum trial pendente</p>
          <p className="text-sm text-gray-600">Boa notícia! Fila limpa.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trials.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-500 shrink-0" />
                    <p className="font-semibold text-white truncate">{t.nome}</p>
                  </div>
                  {t.ownerName && (
                    <p className="text-sm text-gray-400 pl-6">Responsável: {t.ownerName}</p>
                  )}
                  <p className="text-xs text-gray-500 pl-6">{t.email}</p>
                  {t.telefone && (
                    <div className="flex items-center gap-1.5 pl-6">
                      <Phone className="w-3 h-3 text-gray-600" />
                      <span className="text-xs text-gray-500 font-mono">{t.telefone}</span>
                    </div>
                  )}
                  {t.cnpj && <p className="text-xs text-gray-600 pl-6 font-mono">CNPJ: {t.cnpj}</p>}
                  <div className="flex items-center gap-1.5 pl-6 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>
                      Cadastrado {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true, locale: ptBR })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="danger"
                    loading={rejecting === t.id}
                    onClick={() => setModal({ open: true, tenantId: t.id, tenantName: t.nome })}
                  >
                    <X className="w-3.5 h-3.5" />
                    Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    loading={approving === t.id}
                    onClick={() => approve(t.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aprovar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {modal.open && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setModal({ open: false, tenantId: '', tenantName: '' })} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="font-semibold text-white mb-1">Rejeitar trial</h3>
              <p className="text-sm text-gray-400 mb-4">
                Informe o motivo para <strong className="text-gray-200">{modal.tenantName}</strong>:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Ex: CNPJ inválido, atividade suspeita..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3 mt-4">
                <Button
                  variant="secondary"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => setModal({ open: false, tenantId: '', tenantName: '' })}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={!!rejecting}
                  onClick={reject}
                >
                  Confirmar rejeição
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
