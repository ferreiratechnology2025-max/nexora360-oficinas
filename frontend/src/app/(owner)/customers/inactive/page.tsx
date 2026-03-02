'use client';
import { useEffect, useState } from 'react';
import { Car, SendHorizonal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

type InactivityBucket = '30' | '60' | '90';

interface InactiveCustomer {
  id: string;
  name: string;
  phone: string;
  lastOrderAt: string;
  daysSince: number;
  vehicle?: { brand: string; model: string; plate: string };
  lastService?: string;
}

const TABS: { key: InactivityBucket; label: string; color: string }[] = [
  { key: '30', label: '30+ dias', color: 'text-yellow-600' },
  { key: '60', label: '60+ dias', color: 'text-orange-600' },
  { key: '90', label: '90+ dias', color: 'text-red-600' },
];

export default function InactiveCustomersPage() {
  const [activeTab, setActiveTab] = useState<InactivityBucket>('30');
  const [data, setData] = useState<Record<InactivityBucket, InactiveCustomer[]>>({
    '30': [], '60': [], '90': [],
  });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState<InactivityBucket | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [r30, r60, r90] = await Promise.all([
          api.get('/customers/inactive', { params: { days: 30 } }).catch(() => ({ data: [] })),
          api.get('/customers/inactive', { params: { days: 60 } }).catch(() => ({ data: [] })),
          api.get('/customers/inactive', { params: { days: 90 } }).catch(() => ({ data: [] })),
        ]);
        setData({
          '30': r30.data?.customers ?? r30.data ?? [],
          '60': r60.data?.customers ?? r60.data ?? [],
          '90': r90.data?.customers ?? r90.data ?? [],
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function sendReactivation(customerId: string) {
    setSending(customerId);
    try {
      await api.post(`/reactivation/${customerId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(null);
    }
  }

  async function sendAllInGroup(bucket: InactivityBucket) {
    setSendingAll(bucket);
    const group = data[bucket];
    try {
      await Promise.allSettled(group.map((c) => api.post(`/reactivation/${c.id}`)));
    } catch (err) {
      console.error(err);
    } finally {
      setSendingAll(null);
    }
  }

  const current = data[activeTab];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Clientes Inativos</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`ml-2 text-xs font-semibold ${tab.color}`}>
              {data[tab.key].length}
            </span>
          </button>
        ))}
      </div>

      {/* Bulk action */}
      {current.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">
            {current.length} cliente{current.length !== 1 ? 's' : ''} sem retornar há {activeTab}+ dias
          </p>
          <Button
            size="sm"
            variant="secondary"
            loading={sendingAll === activeTab}
            onClick={() => sendAllInGroup(activeTab)}
          >
            <SendHorizonal className="w-4 h-4" />
            Reativar todos do grupo
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      ) : current.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-1">Nenhum cliente inativo neste período</p>
          <p className="text-sm">Ótimo sinal! 🎉</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((c) => (
            <Card key={c.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{c.phone}</p>
                </div>
                <span className={`text-xs font-bold shrink-0 ${
                  activeTab === '90' ? 'text-red-600' : activeTab === '60' ? 'text-orange-600' : 'text-yellow-600'
                }`}>
                  {c.daysSince}d
                </span>
              </div>

              {c.vehicle && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Car className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{c.vehicle.brand} {c.vehicle.model}</span>
                  <span className="font-mono bg-gray-100 px-1 rounded shrink-0">{c.vehicle.plate}</span>
                </div>
              )}

              {c.lastService && (
                <p className="text-xs text-gray-400 truncate">Último serviço: {c.lastService}</p>
              )}

              <p className="text-xs text-gray-400">
                Última OS:{' '}
                {c.lastOrderAt
                  ? formatDistanceToNow(new Date(c.lastOrderAt), { addSuffix: true, locale: ptBR })
                  : '—'}
              </p>

              <Button
                size="sm"
                variant="secondary"
                loading={sending === c.id}
                onClick={() => sendReactivation(c.id)}
                className="w-full"
              >
                <SendHorizonal className="w-3.5 h-3.5" />
                Enviar mensagem de reativação
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
