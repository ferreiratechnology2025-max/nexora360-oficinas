'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ChevronRight, ShieldOff, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import api from '@/lib/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';

interface Tenant {
  id: string;
  nome: string;
  email: string;
  status: string;
  plano?: string;
  isActive: boolean;
  lastLoginAt?: string;
  ordersCount?: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-900 text-green-400',
  trial: 'bg-yellow-900 text-yellow-400',
  trial_pending: 'bg-orange-900 text-orange-400',
  suspended: 'bg-red-900 text-red-400',
  cancelled: 'bg-gray-800 text-gray-500',
};

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/admin/tenants', { params: { limit: 100 } });
      setTenants(res.data?.tenants ?? res.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleBlock(t: Tenant) {
    setToggling(t.id);
    try {
      await api.patch(`/admin/tenants/${t.id}/${t.isActive ? 'block' : 'unblock'}`);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(null);
    }
  }

  const filtered = search
    ? tenants.filter(
        (t) =>
          t.nome.toLowerCase().includes(search.toLowerCase()) ||
          t.email.toLowerCase().includes(search.toLowerCase()),
      )
    : tenants;

  return (
    <AdminShell title="Oficinas">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar oficina ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 text-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-sm text-gray-500">{filtered.length} oficinas</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-500 py-12">Nenhuma oficina encontrada</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase">Oficina</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase hidden md:table-cell">Plano</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase hidden lg:table-cell">Último acesso</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase hidden lg:table-cell">OS</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-800/40 transition-colors group">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-100 truncate max-w-[180px]">{t.nome}</p>
                      <p className="text-xs text-gray-500 truncate">{t.email}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-400 capitalize">{t.plano ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                        STATUS_COLORS[t.status] ?? 'bg-gray-800 text-gray-400'
                      }`}>
                        {t.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {t.lastLoginAt
                        ? formatDistanceToNow(new Date(t.lastLoginAt), { addSuffix: true, locale: ptBR })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                      {t.ordersCount ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={toggling === t.id}
                          title={t.isActive ? 'Bloquear' : 'Desbloquear'}
                          onClick={(e) => { e.stopPropagation(); toggleBlock(t); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {t.isActive
                            ? <ShieldOff className="w-3.5 h-3.5 text-red-400" />
                            : <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                          }
                        </Button>
                        <button
                          onClick={() => router.push(`/admin/tenants/${t.id}`)}
                          className="text-gray-500 hover:text-gray-200 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </AdminShell>
  );
}
