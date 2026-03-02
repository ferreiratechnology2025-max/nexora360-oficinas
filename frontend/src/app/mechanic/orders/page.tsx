'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LogOut, Wrench } from 'lucide-react';
import api from '@/lib/api';
import { StatusBadge } from '@/components/ui/Badge';
import { logout, getUser } from '@/lib/auth';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS } from '@/types';

const ACTIVE_STATUSES: OrderStatus[] = ['received', 'diagnosis', 'waiting_approval', 'in_progress', 'testing'];

export default function MechanicOrdersPage() {
  const router = useRouter();
  const user = getUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('active');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params: Record<string, string> = { limit: '50' };
        if (filterStatus === 'active') {
          params.status = ACTIVE_STATUSES.join(',');
        } else if (filterStatus !== 'all') {
          params.status = filterStatus;
        }
        const res = await api.get('/mechanic/orders', { params });
        setOrders(res.data?.orders ?? res.data ?? []);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [filterStatus]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 leading-none">Nexora360</p>
            <p className="text-xs text-gray-500">{user?.name ?? 'Mecânico'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
          {[
            { value: 'active', label: 'Em andamento' },
            { value: 'ready', label: ORDER_STATUS_LABELS['ready'] },
            { value: 'all', label: 'Todas' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === tab.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-20 animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Nenhuma OS encontrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <button
                key={o.id}
                className="w-full bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-left hover:border-blue-200 active:bg-gray-50 transition-colors"
                onClick={() => router.push(`/mechanic/orders/${o.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{o.customer.name}</p>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {o.vehicle.brand} {o.vehicle.model} ·{' '}
                      <span className="font-mono">{o.vehicle.plate}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <StatusBadge status={o.status as OrderStatus} />
                </div>
                {o.problemDescription && (
                  <p className="text-xs text-gray-500 mt-2 line-clamp-2 border-t border-gray-50 pt-2">
                    {o.problemDescription}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
