'use client';
import { useEffect, useState } from 'react';
import { LogOut, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { logout, getUser } from '@/lib/auth';

interface PerformanceData {
  monthCompleted: number;
  avgTimeHours: number;
  weeklyData: { week: string; count: number }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    customerName: string;
    vehicleInfo: string;
    deliveredAt: string;
  }[];
}

function getWeeklyBuckets() {
  const now = new Date();
  const weeks: { label: string; start: Date }[] = [];
  for (let i = 3; i >= 0; i--) {
    const weekStart = startOfWeek(addDays(now, -i * 7), { weekStartsOn: 1 });
    weeks.push({
      label: `${format(weekStart, 'dd/MM', { locale: ptBR })}`,
      start: weekStart,
    });
  }
  return weeks;
}

export default function MechanicPerformancePage() {
  const user = getUser();
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsRes, ordersRes] = await Promise.allSettled([
          api.get('/mechanics/me/stats'),
          api.get('/orders', { params: { status: 'delivered', limit: 50, mechanicId: user?.id } }),
        ]);

        const stats = statsRes.status === 'fulfilled' ? statsRes.value.data : {};
        const orders = ordersRes.status === 'fulfilled'
          ? (ordersRes.value.data?.orders ?? ordersRes.value.data ?? [])
          : [];

        // Compute weekly data from orders
        const weeklyBuckets = getWeeklyBuckets();
        const weeklyData = weeklyBuckets.map(({ label, start }) => {
          const end = addDays(start, 7);
          const count = orders.filter((o: { deliveredAt?: string }) => {
            if (!o.deliveredAt) return false;
            const d = new Date(o.deliveredAt);
            return d >= start && d < end;
          }).length;
          return { week: label, count };
        });

        const recentOrders = orders.slice(0, 10).map((o: {
          id: string;
          orderNumber: string;
          customer?: { name: string };
          vehicle?: { brand: string; model: string };
          deliveredAt?: string;
        }) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customer?.name ?? '',
          vehicleInfo: o.vehicle ? `${o.vehicle.brand} ${o.vehicle.model}` : '',
          deliveredAt: o.deliveredAt ?? '',
        }));

        setData({
          monthCompleted: stats.monthCompleted ?? stats.monthOrders ?? orders.length,
          avgTimeHours: stats.avgTimeHours ?? 0,
          weeklyData,
          recentOrders,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user?.id]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="text-sm font-bold text-blue-400">Nexora</span>
          <span className="text-sm font-bold text-white">360</span>
          {user?.name && <span className="text-xs text-gray-400 ml-2">— {user.name}</span>}
        </div>
        <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors">
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      <main className="p-4 pb-24 max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Minha Performance
        </h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Hero stat */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white text-center shadow-lg">
              <p className="text-sm text-blue-200 mb-1">OS concluídas este mês</p>
              <p className="text-6xl font-black">{data.monthCompleted}</p>
              <p className="text-blue-200 text-sm mt-1">ordens de serviço</p>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <Clock className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">
                  {data.avgTimeHours > 0 ? data.avgTimeHours.toFixed(1) : '—'}h
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Tempo médio por OS</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{data.recentOrders.length}</p>
                <p className="text-xs text-gray-500 mt-0.5">Últimas concluídas</p>
              </div>
            </div>

            {/* Weekly chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">OS por semana (mês atual)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.weeklyData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: '#eff6ff' }} />
                  <Bar dataKey="count" fill="#3b82f6" name="OS" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recent orders */}
            {data.recentOrders.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <h3 className="text-sm font-semibold text-gray-700">Últimas OS concluídas</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {data.recentOrders.map((o) => (
                    <div key={o.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{o.customerName}</p>
                          <p className="text-xs text-gray-500 truncate">{o.vehicleInfo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-mono text-gray-400">{o.orderNumber}</p>
                          {o.deliveredAt && (
                            <p className="text-xs text-gray-400">
                              {format(new Date(o.deliveredAt), "dd/MM/yy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-gray-400 py-12">Sem dados disponíveis</p>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {[
          { href: '/mechanic/orders', label: 'Minhas OS' },
          { href: '/mechanic/performance', label: 'Performance' },
        ].map(({ href, label }) => (
          <a
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
              href === '/mechanic/performance'
                ? 'text-blue-600 border-t-2 border-blue-600 -mt-px'
                : 'text-gray-500'
            }`}
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
}
