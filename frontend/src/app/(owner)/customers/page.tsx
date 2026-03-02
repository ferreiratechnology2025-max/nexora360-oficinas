'use client';
import { useEffect, useState, useCallback } from 'react';
import { Search, X, RefreshCw, Car, Phone, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/Badge';
import type { Order, OrderStatus } from '@/types';

const SEGMENT_COLORS: Record<string, string> = {
  VIP: 'bg-purple-100 text-purple-800',
  REGULAR: 'bg-blue-100 text-blue-800',
  NEW_CUSTOMER: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-red-100 text-red-700',
  AT_RISK: 'bg-orange-100 text-orange-800',
};

interface CustomerItem {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalOrders: number;
  lastOrderAt?: string;
  segment?: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  vehicles: { id: string; brand: string; model: string; plate: string; year?: number }[];
  orders: Order[];
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reactivating, setReactivating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', { params: { search: search || undefined } });
      setCustomers(res.data?.customers ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  async function openDrawer(id: string) {
    setDrawerOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      const [custRes, ordersRes] = await Promise.all([
        api.get(`/customers/${id}`),
        api.get('/orders', { params: { customerId: id, limit: 20 } }),
      ]);
      setDetail({
        ...custRes.data,
        orders: ordersRes.data?.orders ?? ordersRes.data ?? [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }

  async function reactivate(customerId: string) {
    setReactivating(customerId);
    try {
      await api.post(`/reactivation/${customerId}`);
    } catch (err) {
      console.error(err);
    } finally {
      setReactivating(null);
    }
  }

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search),
      )
    : customers;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
        <span className="text-sm text-gray-500">{filtered.length} clientes</span>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">Carregando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Nenhum cliente encontrado</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Nome</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Telefone</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Total OS</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Última OS</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium">Segmento</th>
                    <th className="text-left px-4 py-3 text-gray-600 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openDrawer(c.id)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-600">{c.totalOrders ?? 0}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {c.lastOrderAt
                          ? formatDistanceToNow(new Date(c.lastOrderAt), { addSuffix: true, locale: ptBR })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.segment ? (
                          <Badge
                            label={c.segment}
                            color={SEGMENT_COLORS[c.segment] ?? 'bg-gray-100 text-gray-700'}
                          />
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {c.segment === 'INACTIVE' && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={reactivating === c.id}
                            onClick={() => reactivate(c.id)}
                          >
                            <RefreshCw className="w-3 h-3" />
                            Reativar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-gray-100">
              {filtered.map((c) => (
                <div
                  key={c.id}
                  className="px-4 py-3 hover:bg-gray-50 active:bg-gray-100 cursor-pointer"
                  onClick={() => openDrawer(c.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{c.phone}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.totalOrders ?? 0} OS
                        {c.lastOrderAt && ` · ${formatDistanceToNow(new Date(c.lastOrderAt), { addSuffix: true, locale: ptBR })}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {c.segment && (
                        <Badge
                          label={c.segment}
                          color={SEGMENT_COLORS[c.segment] ?? 'bg-gray-100 text-gray-700'}
                        />
                      )}
                      {c.segment === 'INACTIVE' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); reactivate(c.id); }}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Reativar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">
                {detail ? detail.name : 'Carregando...'}
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {detailLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-gray-100 rounded-lg h-16" />
                  ))}
                </div>
              ) : detail ? (
                <>
                  {/* Contact info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="font-mono">{detail.phone}</span>
                    </div>
                    {detail.email && (
                      <p className="text-sm text-gray-500">{detail.email}</p>
                    )}
                    {detail.cpf && (
                      <p className="text-xs text-gray-400">CPF: {detail.cpf}</p>
                    )}
                  </div>

                  {/* Reactivate button */}
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={reactivating === detail.id}
                    onClick={() => reactivate(detail.id)}
                    className="w-full"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Enviar mensagem de reativação
                  </Button>

                  {/* Vehicles */}
                  {detail.vehicles.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                        <Car className="w-4 h-4" />
                        Veículos ({detail.vehicles.length})
                      </h3>
                      <div className="space-y-2">
                        {detail.vehicles.map((v) => (
                          <div key={v.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <span className="font-medium text-gray-800">
                              {v.brand} {v.model}
                            </span>
                            {v.year && <span className="text-gray-500"> {v.year}</span>}
                            <span className="ml-2 font-mono text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
                              {v.plate}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Order history */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      Histórico de OS ({detail.orders.length})
                    </h3>
                    {detail.orders.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Nenhuma OS encontrada</p>
                    ) : (
                      <div className="space-y-2">
                        {detail.orders.map((o) => (
                          <div key={o.id} className="border border-gray-100 rounded-lg px-3 py-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-mono text-gray-400">{o.orderNumber}</span>
                              <StatusBadge status={o.status as OrderStatus} size="sm" />
                            </div>
                            <p className="text-sm text-gray-700">
                              {o.vehicle?.brand} {o.vehicle?.model} · {o.vehicle?.plate}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-xs text-gray-400">
                                {format(new Date(o.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                              <p className="text-xs font-medium text-gray-700">
                                R$ {(o.totalValue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
