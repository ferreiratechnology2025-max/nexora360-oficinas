'use client';
import { useEffect, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from 'recharts';
import api from '@/lib/api';

type Tab = 'overview' | 'campaigns' | 'customers' | 'mechanics';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Visão Geral' },
  { key: 'campaigns', label: 'Campanhas' },
  { key: 'customers', label: 'Clientes' },
  { key: 'mechanics', label: 'Mecânicos' },
];

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ef4444'];
const MONTHS_BR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface MonthData { month: string; orders: number; revenue: number }
interface CampaignReport { id: string; name: string; segment: string; totalSent: number; status: string }
interface SegmentData { name: string; value: number }
interface MechanicRank { id: string; name: string; completed: number; avgHours: number }

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [monthData, setMonthData] = useState<MonthData[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignReport[]>([]);
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [mechanics, setMechanics] = useState<MechanicRank[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [ordersRes, campaignRes, segRes, mechRes] = await Promise.allSettled([
          api.get('/orders', { params: { limit: 200 } }),
          api.get('/campaigns'),
          api.get('/segments'),
          api.get('/mechanics'),
        ]);

        // Process orders into month buckets
        if (ordersRes.status === 'fulfilled') {
          const orders = ordersRes.value.data?.orders ?? ordersRes.value.data ?? [];
          const byMonth: Record<string, { orders: number; revenue: number }> = {};
          orders.forEach((o: { createdAt: string; totalValue?: number; status: string }) => {
            const d = new Date(o.createdAt);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!byMonth[key]) byMonth[key] = { orders: 0, revenue: 0 };
            byMonth[key].orders++;
            if (o.status === 'delivered') byMonth[key].revenue += o.totalValue ?? 0;
          });
          const now = new Date();
          const months: MonthData[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            months.push({
              month: MONTHS_BR[d.getMonth()],
              orders: byMonth[key]?.orders ?? 0,
              revenue: byMonth[key]?.revenue ?? 0,
            });
          }
          setMonthData(months);
        }

        if (campaignRes.status === 'fulfilled') {
          setCampaigns(campaignRes.value.data?.campaigns ?? campaignRes.value.data ?? []);
        }

        if (segRes.status === 'fulfilled') {
          const raw = segRes.value.data?.segments ?? segRes.value.data ?? [];
          setSegments(raw.map((s: { label?: string; type?: string; count?: number; total?: number }) => ({
            name: s.label ?? s.type ?? '',
            value: s.count ?? s.total ?? 0,
          })));
        }

        if (mechRes.status === 'fulfilled') {
          const raw = mechRes.value.data?.mechanics ?? mechRes.value.data ?? [];
          setMechanics(raw.map((m: { id: string; name: string; monthOrders?: number; avgTimeHours?: number }) => ({
            id: m.id,
            name: m.name,
            completed: m.monthOrders ?? 0,
            avgHours: m.avgTimeHours ?? 0,
          })).sort((a: MechanicRank, b: MechanicRank) => b.completed - a.completed));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Relatórios</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Overview */}
          {tab === 'overview' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 mb-4 text-sm">OS por mês</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#3b82f6" name="OS" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 mb-4 text-sm">Faturamento por mês (R$)</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => [`R$ ${Number(v).toLocaleString('pt-BR')}`, 'Faturamento']} />
                    <Line dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Faturamento" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Campaigns */}
          {tab === 'campaigns' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {campaigns.length === 0 ? (
                <p className="text-center text-gray-400 py-12">Nenhuma campanha ainda</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Campanha</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Segmento</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Enviados</th>
                      <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500">{c.segment}</td>
                        <td className="px-4 py-3 text-gray-600">{c.totalSent ?? 0}</td>
                        <td className="px-4 py-3 capitalize text-gray-500">{c.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Customers */}
          {tab === 'customers' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 mb-4 text-sm">OS abertas por mês</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#8b5cf6" name="Novos clientes" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 mb-4 text-sm">Segmentação atual</h3>
                {segments.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Sem dados de segmentação</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={segments} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                        {segments.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Mechanics */}
          {tab === 'mechanics' && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-700 text-sm">Ranking — OS concluídas no mês</h3>
                </div>
                {mechanics.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Sem dados</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {mechanics.map((m, i) => (
                      <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          i === 0 ? 'bg-yellow-400 text-yellow-900'
                          : i === 1 ? 'bg-gray-300 text-gray-700'
                          : i === 2 ? 'bg-orange-400 text-orange-900'
                          : 'bg-gray-100 text-gray-500'
                        }`}>{i + 1}</span>
                        <span className="flex-1 text-sm text-gray-800">{m.name}</span>
                        <span className="text-sm font-bold text-blue-600">{m.completed}</span>
                        <span className="text-xs text-gray-400">{m.avgHours?.toFixed(1)}h/OS</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <h3 className="font-semibold text-gray-700 mb-4 text-sm">OS concluídas por mecânico</h3>
                {mechanics.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={mechanics.slice(0, 5)}
                      layout="vertical"
                      margin={{ top: 0, right: 20, left: 60, bottom: 0 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="completed" fill="#3b82f6" name="OS" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
