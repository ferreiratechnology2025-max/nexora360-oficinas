'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Clock, CheckCircle, DollarSign, Star, Wifi, WifiOff } from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { StatCard } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import type { Order, OrderStatus } from '@/types';

const PIE_COLORS: Record<string, string> = {
  received: '#9ca3af',
  diagnosis: '#fbbf24',
  waiting_approval: '#f97316',
  in_progress: '#3b82f6',
  testing: '#8b5cf6',
  ready: '#22c55e',
  delivered: '#059669',
  cancelled: '#ef4444',
};

interface DashboardData {
  openOrders: number;
  waitingApproval: number;
  readyOrders: number;
  monthRevenue: number;
  recentOrders: Order[];
  statusDistribution: { status: string; count: number }[];
  topMechanic?: { name: string; count: number };
}

interface RatingsStats {
  totalReviews: number;
  averageRating: number;
  distribution: Record<string, number>;
}

interface WhatsAppStatus {
  connected: boolean;
  status: string;
}

function WhatsAppBanner({ status, onConnect }: { status: WhatsAppStatus | null; onConnect: () => void }) {
  if (status === null) return null;

  if (status.connected) {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
        <Wifi className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-emerald-800">✅ WhatsApp Conectado</p>
          <p className="text-xs text-emerald-600">Mensagens automáticas ativas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-orange-50 border border-orange-300 rounded-xl px-4 py-3 mb-6">
      <WifiOff className="w-5 h-5 text-orange-600 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-orange-800">⚠️ WhatsApp Desconectado</p>
        <p className="text-xs text-orange-600">Seus clientes não estão recebendo notificações</p>
      </div>
      <button
        onClick={onConnect}
        className="shrink-0 text-xs font-semibold text-orange-700 hover:text-orange-900 whitespace-nowrap underline"
      >
        Conectar agora →
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [ratings, setRatings] = useState<RatingsStats | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [dashRes, ordersRes, waRes, ratingsRes] = await Promise.all([
          api.get('/tenants/dashboard').catch(() => null),
          api.get('/orders?limit=10'),
          api.get('/whatsapp/status').catch(() => null),
          api.get('/reviews/stats').catch(() => null),
        ]);

        const orders: Order[] = ordersRes.data?.orders ?? ordersRes.data ?? [];
        const dash = dashRes?.data ?? {};

        // Ratings
        if (ratingsRes?.data) {
          setRatings(ratingsRes.data);
        }

        // WhatsApp status
        if (waRes?.data) {
          setWaStatus({ connected: waRes.data.connected ?? false, status: waRes.data.status ?? 'disconnected' });
        } else {
          setWaStatus({ connected: false, status: 'disconnected' });
        }

        // Compute stats from orders
        const statusCount: Record<string, number> = {};
        orders.forEach((o) => {
          statusCount[o.status] = (statusCount[o.status] ?? 0) + 1;
        });

        const statusDistribution = Object.entries(statusCount).map(([status, count]) => ({
          status,
          count,
        }));

        // Mechanic stats
        const mechanicCount: Record<string, { name: string; count: number }> = {};
        orders.forEach((o) => {
          if (o.mechanic) {
            const id = o.mechanic.id;
            if (!mechanicCount[id]) mechanicCount[id] = { name: o.mechanic.name, count: 0 };
            mechanicCount[id].count++;
          }
        });
        const topMechanic = Object.values(mechanicCount).sort((a, b) => b.count - a.count)[0];

        setData({
          openOrders: dash.openOrders ?? orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length,
          waitingApproval: dash.waitingApproval ?? orders.filter((o) => o.status === 'waiting_approval').length,
          readyOrders: dash.readyOrders ?? orders.filter((o) => o.status === 'ready').length,
          monthRevenue: dash.monthRevenue ?? orders
            .filter((o) => o.status === 'delivered')
            .reduce((sum, o) => sum + (o.totalValue ?? 0), 0),
          recentOrders: orders.slice(0, 10),
          statusDistribution,
          topMechanic,
        });
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 rounded-xl h-14 mb-6" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-24" />
            ))}
          </div>
          <div className="bg-gray-200 rounded-xl h-64" />
        </div>
      </AppShell>
    );
  }

  const pieData = data?.statusDistribution.map((s) => ({
    name: s.status,
    value: s.count,
  })) ?? [];

  return (
    <AppShell title="Dashboard">
      {/* WhatsApp status banner */}
      <WhatsAppBanner
        status={waStatus}
        onConnect={() => router.push('/settings?tab=whatsapp')}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard
          title="OS Abertas"
          value={data?.openOrders ?? 0}
          icon={<ClipboardList className="w-5 h-5" />}
          color="text-blue-600"
        />
        <StatCard
          title="Aguard. Aprovação"
          value={data?.waitingApproval ?? 0}
          icon={<Clock className="w-5 h-5" />}
          color="text-orange-500"
        />
        <StatCard
          title="Prontas p/ Retirada"
          value={data?.readyOrders ?? 0}
          icon={<CheckCircle className="w-5 h-5" />}
          color="text-green-600"
        />
        <StatCard
          title="Faturamento do Mês"
          value={`R$ ${(data?.monthRevenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="text-emerald-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent orders */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">OS Recentes</h2>
            <button
              onClick={() => router.push('/orders')}
              className="text-sm text-blue-600 hover:underline"
            >
              Ver todas
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {(data?.recentOrders ?? []).length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">Nenhuma OS encontrada</p>
            )}
            {(data?.recentOrders ?? []).map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/orders/${order.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {order.customer.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {order.vehicle.brand} {order.vehicle.model} · {order.vehicle.plate}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={order.status as OrderStatus} />
                  <span className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(order.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Top mechanic */}
          {data?.topMechanic && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="font-semibold text-gray-800 text-sm">Top Mecânico do Mês</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{data.topMechanic.name}</p>
              <p className="text-sm text-gray-500">{data.topMechanic.count} OS concluídas</p>
            </div>
          )}

          {/* Ratings card */}
          {ratings && ratings.totalReviews > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-5 h-5 text-yellow-500" />
                <span className="font-semibold text-gray-800 text-sm">Avaliações</span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-gray-900">{ratings.averageRating.toFixed(1)}</span>
                <span className="text-sm text-gray-500">/ 5 · {ratings.totalReviews} avaliações</span>
              </div>
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = ratings.distribution?.[String(n)] ?? 0;
                  const pct = ratings.totalReviews > 0 ? Math.round((count / ratings.totalReviews) * 100) : 0;
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-gray-600 text-right">{n}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-yellow-400 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-5 text-gray-400 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chart */}
          {pieData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <h3 className="font-semibold text-gray-800 text-sm mb-3">OS por Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={PIE_COLORS[entry.name] ?? '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
