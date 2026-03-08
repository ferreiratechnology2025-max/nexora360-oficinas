'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Order, OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS } from '@/types';

// Statuses available in the filter dropdown (excluding cancelled — shown separately)
const FILTER_STATUSES: [string, string][] = [
  ['', 'Todos (sem canceladas)'],
  ['received', ORDER_STATUS_LABELS['received']],
  ['diagnosis', ORDER_STATUS_LABELS['diagnosis']],
  ['waiting_approval', ORDER_STATUS_LABELS['waiting_approval']],
  ['in_progress', ORDER_STATUS_LABELS['in_progress']],
  ['testing', ORDER_STATUS_LABELS['testing']],
  ['ready', ORDER_STATUS_LABELS['ready']],
  ['delivered', ORDER_STATUS_LABELS['delivered']],
  ['rejected', ORDER_STATUS_LABELS['rejected']],
  ['cancelled', 'Canceladas'],
];

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await api.get('/orders', {
          params: { page, limit: LIMIT, status: filterStatus || undefined },
        });
        const raw = res.data;
        setOrders(raw.orders ?? raw ?? []);
        setTotal(raw.total ?? (raw.orders ?? raw).length);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, filterStatus]);

  const filtered = search
    ? orders.filter((o) =>
        o.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        o.vehicle.plate.toLowerCase().includes(search.toLowerCase()) ||
        o.orderNumber.toLowerCase().includes(search.toLowerCase()),
      )
    : orders;

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AppShell title="Ordens de Serviço">
      {/* Header actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar cliente, placa, OS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FILTER_STATUSES.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        <Button onClick={() => router.push('/orders/new')}>
          <Plus className="w-4 h-4" />
          Nova OS
        </Button>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhuma OS encontrada</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">OS</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Veículo</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Mecânico</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Abertura</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/orders/${o.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.orderNumber}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{o.customer.name}</td>
                      <td className="px-4 py-3 text-gray-600">{o.vehicle.brand} {o.vehicle.model} · <span className="font-mono">{o.vehicle.plate}</span></td>
                      <td className="px-4 py-3"><StatusBadge status={o.status as OrderStatus} /></td>
                      <td className="px-4 py-3">
                        {o.mechanic?.name ?? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            Sem mecânico
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true, locale: ptBR })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((o) => (
                <div
                  key={o.id}
                  className="px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
                  onClick={() => router.push(`/orders/${o.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 truncate">{o.customer.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {o.vehicle.brand} {o.vehicle.model} · {o.vehicle.plate}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{o.orderNumber}</p>
                      {!o.mechanic && (
                        <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                          Sem mecânico
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={o.status as OrderStatus} />
                      <span className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-gray-500">
            {total} OS · Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
