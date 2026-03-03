'use client';
import { useEffect, useState } from 'react';
import { TrendingUp, Users, UserX, DollarSign, Activity, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import api from '@/lib/api';
import { AdminShell } from '@/components/layout/AdminShell';

const MONTHS_BR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface ApiMetrics {
  mrr: number;
  arr: number;
  mrrGrowth: string;
  churn: { count: number; rate: string };
  newSubscribers: { paid: number; trials: number; trialConversionRate: string };
  totals: { totalTenants: number; active: number; trial: number; suspended: number; pendingApproval: number };
  activeSubscriptions: number;
}

interface MonthData { month: string; revenue: number; newSubscribers: number; churned: number }

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function parseRate(rate: string | undefined): number {
  return parseFloat((rate ?? '0').replace('%', ''));
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
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
          const raw: Array<{ month?: string; revenue?: number; total?: number; newSubscribers?: number; churned?: number }> =
            revenueRes.value.data ?? [];
          setMonthlyData(
            raw.map((r) => {
              const parts = (r.month ?? '').split('-');
              const idx = parts[1] ? parseInt(parts[1], 10) - 1 : -1;
              return {
                month: idx >= 0 ? (MONTHS_BR[idx] ?? r.month ?? '') : (r.month ?? ''),
                revenue: r.revenue ?? r.total ?? 0,
                newSubscribers: r.newSubscribers ?? 0,
                churned: r.churned ?? 0,
              };
            }),
          );
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const convRate  = parseRate(metrics?.newSubscribers?.trialConversionRate);
  const convColor = convRate > 30 ? 'text-green-400' : convRate >= 10 ? 'text-yellow-400' : 'text-red-400';
  const churnNum  = parseRate(metrics?.churn?.rate);

  const stats = [
    { label: 'MRR',              value: fmtBRL(metrics?.mrr ?? 0),             icon: DollarSign, color: 'text-green-400'   },
    { label: 'ARR',              value: fmtBRL(metrics?.arr ?? 0),             icon: TrendingUp, color: 'text-blue-400'    },
    { label: 'Oficinas ativas',  value: metrics?.totals?.active ?? 0,          icon: Users,      color: 'text-purple-400'  },
    { label: 'Em trial',         value: metrics?.totals?.trial ?? 0,           icon: Activity,   color: 'text-yellow-400'  },
    { label: 'Conv. Trial→Pago', value: `${convRate.toFixed(1)}%`,             icon: Percent,    color: convColor           },
    { label: 'Novas este mês',   value: metrics?.newSubscribers?.paid ?? 0,    icon: Users,      color: 'text-emerald-400' },
    { label: 'Churn rate',       value: `${churnNum.toFixed(1)}%`,             icon: UserX,      color: 'text-red-400'     },
    { label: 'Trials pendentes', value: metrics?.totals?.pendingApproval ?? 0, icon: Activity,   color: 'text-orange-400'  },
  ];

  return (
    <AdminShell title="Dashboard">
      {loading ? (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Stat cards ─────────────────────────────────── */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
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

          {/* ── Receita Mensal ─────────────────────────────── */}
          {monthlyData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-4">Receita Mensal (R$)</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
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

          {/* ── Composição MRR — Novos vs. Churn ──────────── */}
          {monthlyData.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-300 mb-1">Composição MRR — Novos vs. Churn</h2>
              <p className="text-xs text-gray-600 mb-4">Assinantes novos e cancelamentos por mês</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Bar dataKey="newSubscribers" name="Novos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="churned"        name="Churn" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
