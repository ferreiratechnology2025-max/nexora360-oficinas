'use client';
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Cpu, Database, Radio } from 'lucide-react';
import api from '@/lib/api';
import { AdminShell } from '@/components/layout/AdminShell';
import { Button } from '@/components/ui/Button';

interface ServiceHealth {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latencyMs?: number;
  details?: string;
}

interface SystemHealth {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  services: ServiceHealth[];
  memory?: { used: number; total: number };
  cpu?: number;
  queueSize?: number;
  version?: string;
}

const STATUS_ICON: Record<string, React.ElementType> = {
  ok: CheckCircle,
  degraded: AlertCircle,
  down: XCircle,
};
const STATUS_COLOR: Record<string, string> = {
  ok: 'text-green-400',
  degraded: 'text-yellow-400',
  down: 'text-red-400',
};
const STATUS_BG: Record<string, string> = {
  ok: 'bg-green-900/30 border-green-800',
  degraded: 'bg-yellow-900/30 border-yellow-800',
  down: 'bg-red-900/30 border-red-800',
};

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminSystemPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/system/health');
      setHealth(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const globalStatus = health?.status ?? 'down';
  const GlobalIcon = STATUS_ICON[globalStatus] ?? XCircle;

  return (
    <AdminShell title="Monitoramento do Sistema">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${STATUS_BG[globalStatus]}`}>
            <GlobalIcon className={`w-4 h-4 ${STATUS_COLOR[globalStatus]}`} />
            <span className={STATUS_COLOR[globalStatus]}>
              {globalStatus === 'ok' ? 'Todos os sistemas operacionais' : globalStatus === 'degraded' ? 'Degradado' : 'Sistema com falhas'}
            </span>
          </div>
          {health?.version && (
            <span className="text-xs text-gray-600 font-mono">v{health.version}</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${autoRefresh ? 'text-green-400' : 'text-gray-500'}`}
          >
            <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'Auto-refresh ativo' : 'Auto-refresh pausado'}
          </button>
          <Button size="sm" variant="ghost" onClick={load} loading={loading}>
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>
      </div>

      {lastUpdated && (
        <p className="text-xs text-gray-600 mb-4">
          Última atualização: {lastUpdated.toLocaleTimeString('pt-BR')}
        </p>
      )}

      {loading && !health ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Server metrics */}
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-gray-500 uppercase font-medium">CPU</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">
                {health?.cpu != null ? `${health.cpu.toFixed(1)}%` : '—'}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-purple-400" />
                <span className="text-xs text-gray-500 uppercase font-medium">Memória</span>
              </div>
              <p className="text-2xl font-bold text-purple-400">
                {health?.memory
                  ? `${Math.round(health.memory.used / 1024 / 1024)}MB`
                  : '—'}
              </p>
              {health?.memory && (
                <p className="text-xs text-gray-600 mt-0.5">
                  de {Math.round(health.memory.total / 1024 / 1024)}MB
                </p>
              )}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-xs text-gray-500 uppercase font-medium">Uptime</span>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {health?.uptime ? formatUptime(health.uptime) : '—'}
              </p>
              {health?.queueSize != null && (
                <p className="text-xs text-gray-600 mt-0.5">
                  Fila WhatsApp: {health.queueSize} mensagens
                </p>
              )}
            </div>
          </div>

          {/* Services */}
          {health?.services && health.services.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <h3 className="text-sm font-semibold text-gray-300">Serviços</h3>
              </div>
              <div className="divide-y divide-gray-800/50">
                {health.services.map((svc) => {
                  const Icon = STATUS_ICON[svc.status] ?? XCircle;
                  return (
                    <div key={svc.name} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${STATUS_COLOR[svc.status] ?? 'text-gray-400'}`} />
                        <div>
                          <p className="text-sm font-medium text-gray-200 capitalize">{svc.name}</p>
                          {svc.details && <p className="text-xs text-gray-500 mt-0.5">{svc.details}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {svc.latencyMs != null && (
                          <span className={`text-xs font-mono ${
                            svc.latencyMs < 100 ? 'text-green-400' : svc.latencyMs < 500 ? 'text-yellow-400' : 'text-red-400'
                          }`}>
                            {svc.latencyMs}ms
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BG[svc.status]} ${STATUS_COLOR[svc.status]}`}>
                          {svc.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No health data */}
          {!health && (
            <div className="text-center py-20">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3 opacity-60" />
              <p className="text-gray-400">Não foi possível obter dados do sistema</p>
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
