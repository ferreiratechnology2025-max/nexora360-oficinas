'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Send, Trash2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sent: 'Enviada',
  cancelled: 'Cancelada',
};

interface Campaign {
  id: string;
  name: string;
  segment: string;
  status: string;
  totalSent: number;
  scheduledAt?: string;
  createdAt: string;
  channel?: string;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/campaigns');
      setCampaigns(res.data?.campaigns ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function sendNow(id: string) {
    setSending(id);
    try {
      await api.post(`/campaigns/${id}/send`);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(null);
    }
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Excluir esta campanha?')) return;
    setDeleting(id);
    try {
      await api.delete(`/campaigns/${id}`);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Campanhas</h1>
        <Button onClick={() => router.push('/campaigns/new')}>
          <Plus className="w-4 h-4" />
          Nova campanha
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">Nenhuma campanha ainda</p>
          <Button onClick={() => router.push('/campaigns/new')}>
            <Plus className="w-4 h-4" />
            Criar primeira campanha
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Segmento</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Enviados</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Data</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3">
                      <Badge label={c.segment ?? '—'} color="bg-blue-50 text-blue-700" />
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={STATUS_LABELS[c.status] ?? c.status}
                        color={STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.totalSent ?? 0}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {c.scheduledAt
                        ? format(new Date(c.scheduledAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : format(new Date(c.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {(c.status === 'draft' || c.status === 'scheduled') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={sending === c.id}
                            onClick={() => sendNow(c.id)}
                            title="Enviar agora"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {c.status !== 'sent' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            loading={deleting === c.id}
                            onClick={() => deleteCampaign(c.id)}
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <div className="md:hidden space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-800 truncate flex-1">{c.name}</p>
                  <Badge
                    label={STATUS_LABELS[c.status] ?? c.status}
                    color={STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}
                  />
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Badge label={c.segment ?? '—'} color="bg-blue-50 text-blue-700" />
                  <span>·</span>
                  <span>{c.totalSent ?? 0} enviados</span>
                  {c.scheduledAt && (
                    <>
                      <span>·</span>
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(c.scheduledAt), "dd/MM HH:mm", { locale: ptBR })}</span>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  {(c.status === 'draft' || c.status === 'scheduled') && (
                    <Button size="sm" variant="secondary" loading={sending === c.id} onClick={() => sendNow(c.id)}>
                      <Send className="w-3.5 h-3.5" />
                      Enviar agora
                    </Button>
                  )}
                  {c.status !== 'sent' && (
                    <Button size="sm" variant="ghost" loading={deleting === c.id} onClick={() => deleteCampaign(c.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
