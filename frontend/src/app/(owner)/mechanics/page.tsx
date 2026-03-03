'use client';
import { useEffect, useState } from 'react';
import { Plus, X, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';

interface Mechanic {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  activeOrders?: number;
  monthOrders?: number;
}

interface MechanicStats {
  activeOrders: number;
  monthOrders: number;
  avgTimeHours: number;
  recentOrders: { id: string; orderNumber: string; customerName: string; createdAt: string }[];
}

interface NewMechanicForm {
  name: string;
  email: string;
  password: string;
  phone: string;
}

const EMPTY_FORM: NewMechanicForm = { name: '', email: '', password: '', phone: '' };

export default function MechanicsPage() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<NewMechanicForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<NewMechanicForm>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [stats, setStats] = useState<MechanicStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/users');
      const all = res.data?.users ?? res.data ?? [];
      setMechanics(all.filter((u: Mechanic & { role?: string }) => u.role === 'mechanic'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openDrawer(m: Mechanic) {
    setSelectedMechanic(m);
    setDrawerOpen(true);
    setStats(null);
    setStatsLoading(true);
    try {
      const res = await api.get(`/users/${m.id}/stats`);
      setStats(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  }

  function validate() {
    const e: Partial<NewMechanicForm> = {};
    if (!form.name.trim()) e.name = 'Nome obrigatório';
    if (!form.email.trim()) e.email = 'Email obrigatório';
    if (!form.password || form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    return e;
  }

  async function saveMechanic() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSaving(true);
    try {
      const body: Partial<NewMechanicForm> = { name: form.name, email: form.email, password: form.password };
      if (form.phone.trim()) body.phone = form.phone;
      await api.post('/users', body);
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setErrors({});
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(m: Mechanic) {
    setToggling(m.id);
    try {
      const action = m.isActive ? 'deactivate' : 'reactivate';
      await api.patch(`/users/${m.id}/${action}`);
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setToggling(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mecânicos</h1>
        <Button onClick={() => { setModalOpen(true); setForm(EMPTY_FORM); setErrors({}); }}>
          <Plus className="w-4 h-4" />
          Novo mecânico
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-36 animate-pulse" />
          ))}
        </div>
      ) : mechanics.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">Nenhum mecânico cadastrado</p>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4" />
            Cadastrar primeiro mecânico
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mechanics.map((m) => (
            <Card key={m.id} className="space-y-3" onClick={() => openDrawer(m)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 truncate">{m.name}</p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  {m.phone && <p className="text-xs text-gray-400 font-mono">{m.phone}</p>}
                </div>
                <Badge
                  label={m.isActive ? 'Ativo' : 'Inativo'}
                  color={m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-50 rounded-lg py-2">
                  <p className="text-xl font-bold text-blue-600">{m.activeOrders ?? 0}</p>
                  <p className="text-xs text-gray-500">OS ativas</p>
                </div>
                <div className="bg-green-50 rounded-lg py-2">
                  <p className="text-xl font-bold text-green-600">{m.monthOrders ?? 0}</p>
                  <p className="text-xs text-gray-500">no mês</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => toggleActive(m)}
                  disabled={toggling === m.id}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
                >
                  {m.isActive
                    ? <ToggleRight className="w-4 h-4 text-green-500" />
                    : <ToggleLeft className="w-4 h-4 text-gray-400" />
                  }
                  {m.isActive ? 'Desativar' : 'Reativar'}
                </button>
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New mechanic modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Novo mecânico</h2>
                <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <Input
                  label="Nome completo"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  error={errors.name}
                  placeholder="João Silva"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  error={errors.email}
                  placeholder="joao@oficina.com"
                />
                <Input
                  label="Senha"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  error={errors.password}
                  helper="Mínimo 6 caracteres"
                />
                <Input
                  label="Telefone (opcional)"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <Button variant="secondary" className="flex-1" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button className="flex-1" loading={saving} onClick={saveMechanic}>
                  Cadastrar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer */}
      {drawerOpen && selectedMechanic && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-800">{selectedMechanic.name}</h2>
                <p className="text-xs text-gray-500">{selectedMechanic.email}</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {statsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-100 rounded-lg h-16" />)}
                </div>
              ) : stats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.activeOrders}</p>
                      <p className="text-xs text-gray-500 mt-0.5">OS ativas</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.monthOrders}</p>
                      <p className="text-xs text-gray-500 mt-0.5">no mês</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">{stats.avgTimeHours?.toFixed(0) ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">horas/OS</p>
                    </div>
                  </div>

                  {stats.recentOrders?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-2">OS Recentes</h3>
                      <div className="space-y-2">
                        {stats.recentOrders.map((o) => (
                          <div key={o.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
                            <p className="font-medium text-gray-700">{o.customerName}</p>
                            <p className="text-xs text-gray-400 font-mono">{o.orderNumber}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm py-8">Sem dados disponíveis</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
