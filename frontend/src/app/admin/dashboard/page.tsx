'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, Users, UserX, DollarSign, Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '@/lib/api';
import { AdminShell } from '@/components/layout/AdminShell';

const MONTHS_BR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Metrics {
  mrr: number;
  arr: number;
  activeTenants: number;
  trialTenants: number;
  churnRate: number;
  newThisMonth: number;
}

interface MonthRevenue { month: string; revenue: number }

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<MonthRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [metricsRes, revenueRes] = await Promise.allSettled([
          api.get('/admin/metrics'),
          api.get('/admin/revenue/monthly'),
        ]);

        if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value.data);

        if (revenueRes.status === 'fulfilled') {
          const raw = revenueRes.value.data ?? [];
          setMonthlyRevenue(
            raw.map((r: { month?: number; year?: number; revenue?: number; total?: number }) => ({
              month: r.month != null ? MONTHS_BR[r.month - 1] ?? String(r.month) : '',
              revenue: r.revenue ?? r.total ?? 0,
            })),
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stats = [
    { label: 'MRR', value: fmtBRL(metrics?.mrr ?? 0), icon: DollarSign, color: 'text-green-400' },
    { label: 'ARR', value: fmtBRL(metrics?.arr ?? 0), icon: TrendingUp, color: 'text-blue-400' },
    { label: 'Oficinas ativas', value: metrics?.activeTenants ?? 0, icon: Users, color: 'text-purple-400' },
    { label: 'Em trial', value: metrics?.trialTenants ?? 0, icon: Activity, color: 'text-yellow-400' },
    { label: 'Novas este mês', value: metrics?.newThisMonth ?? 0, icon: Users, color: 'text-emerald-400' },
    { label: 'Churn rate', value: `${(metrics?.churnRate ?? 0).toFixed(1)}%`, icon: UserX, color: 'text-red-400' },
  ];

  return (
    <AdminShell title="Dashboard">
      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 mb-6">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Revenue chart */}
          {monthlyRevenue.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Receita mensal (R$)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyRevenue} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(v) => [fmtBRL(Number(v)), 'Receita']}
                  />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
