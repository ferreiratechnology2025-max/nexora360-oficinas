'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ShieldOff, ShieldCheck, MessageSquare, CreditCard, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';

interface TenantProfile {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cnpj?: string;
  status: string;
  isActive: boolean;
  plano?: string;
  createdAt: string;
  lastLoginAt?: string;
  trialEndsAt?: string;
  ordersCount?: number;
  customersCount?: number;
  mechanicsCount?: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt?: string;
  createdAt: string;
  planId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'text-green-400 bg-green-900/50',
  trial: 'text-yellow-400 bg-yellow-900/50',
  suspended: 'text-red-400 bg-red-900/50',
  cancelled: 'text-gray-500 bg-gray-800',
};

export default function TenantProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [msgForm, setMsgForm] = useState<{ type: 'whatsapp' | 'email'; message: string } | null>(null);
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [profileRes, paymentsRes] = await Promise.allSettled([
        api.get(`/admin/tenants/${id}`),
        api.get(`/admin/payments/${id}`),
      ]);
      if (profileRes.status === 'fulfilled') setProfile(profileRes.value.data);
      if (paymentsRes.status === 'fulfilled') {
        setPayments(paymentsRes.value.data?.payments ?? paymentsRes.value.data ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function toggleBlock() {
    if (!profile) return;
    setToggling(true);
    try {
      await api.patch(`/admin/tenants/${id}/${profile.isActive ? 'block' : 'unblock'}`);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(false);
    }
  }

  async function sendMessage() {
    if (!msgForm?.message.trim()) return;
    setSending(true);
    try {
      await api.post(`/admin/tenants/${id}/message`, msgForm);
      setMsgForm(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  }

  function fmtDate(d?: string) {
    if (!d) return '—';
    return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  }

  if (loading) {
    return (
      <AdminShell title="Perfil da oficina">
        <div className="space-y-4 animate-pulse">
          <div className="bg-gray-900 border border-gray-800 rounded-xl h-40" />
          <div className="bg-gray-900 border border-gray-800 rounded-xl h-60" />
        </div>
      </AdminShell>
    );
  }

  if (!profile) {
    return (
      <AdminShell title="Perfil da oficina">
        <p className="text-gray-400 text-center py-12">Oficina não encontrada</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={profile.nome}>
      <button
        onClick={() => router.push('/admin/tenants')}
        className="flex items-center gap-1.5 text-gray-400 hover:text-white mb-4 text-sm transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para oficinas
      </button>

      {/* Profile header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">{profile.nome}</h2>
            <p className="text-gray-400 text-sm">{profile.email}</p>
            {profile.telefone && <p className="text-gray-500 text-xs font-mono">{profile.telefone}</p>}
            {profile.cnpj && <p className="text-gray-600 text-xs font-mono">CNPJ: {profile.cnpj}</p>}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={profile.isActive ? 'danger' : 'secondary'}
              loading={toggling}
              onClick={toggleBlock}
            >
              {profile.isActive
                ? <><ShieldOff className="w-3.5 h-3.5" /> Bloquear</>
                : <><ShieldCheck className="w-3.5 h-3.5" /> Desbloquear</>
              }
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMsgForm({ type: 'whatsapp', message: '' })}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Mensagem
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Status', value: <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[profile.status] ?? ''} capitalize`}>{profile.status?.replace('_', ' ')}</span> },
            { label: 'Plano', value: profile.plano ?? '—' },
            { label: 'OS abertas', value: profile.ordersCount ?? '—' },
            { label: 'Mecânicos', value: profile.mechanicsCount ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-200">{value}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="mt-4 space-y-1 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Cadastro: {fmtDate(profile.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>Último login: {fmtDate(profile.lastLoginAt)}</span>
          </div>
          {profile.trialEndsAt && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              <span>Trial até: {fmtDate(profile.trialEndsAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-300">Histórico de pagamentos</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-center text-gray-600 py-8 text-sm">Nenhum pagamento registrado</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-800">
              <tr>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Data</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Valor</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Método</th>
                <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-800/30">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">
                    {fmtDate(p.paidAt ?? p.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-200">
                    R$ {(p.amount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 capitalize text-xs">{p.method}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      p.status === 'paid' ? 'bg-green-900/50 text-green-400' :
                      p.status === 'pending' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-red-900/50 text-red-400'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Message modal */}
      {msgForm && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setMsgForm(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
              <h3 className="font-semibold text-white mb-4">Enviar mensagem para {profile.nome}</h3>
              <div className="flex gap-2 mb-3">
                {(['whatsapp', 'email'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setMsgForm((f) => f ? { ...f, type: t } : null)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      msgForm.type === t
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                value={msgForm.message}
                onChange={(e) => setMsgForm((f) => f ? { ...f, message: e.target.value } : null)}
                rows={4}
                placeholder="Digite a mensagem..."
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3 mt-4">
                <Button variant="secondary" className="flex-1 border-gray-700 text-gray-300" onClick={() => setMsgForm(null)}>
                  Cancelar
                </Button>
                <Button className="flex-1" loading={sending} onClick={sendMessage}>
                  Enviar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
