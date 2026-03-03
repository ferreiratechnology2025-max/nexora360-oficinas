'use client';
import { useEffect, useState } from 'react';
import { Save, Wifi, WifiOff, RefreshCw, Star, Clock } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type Tab = 'oficina' | 'whatsapp' | 'plano' | 'lembretes' | 'equipe';

const TABS: { key: Tab; label: string }[] = [
  { key: 'oficina', label: 'Oficina' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'plano', label: 'Plano' },
  { key: 'lembretes', label: 'Lembretes' },
  { key: 'equipe', label: 'Equipe' },
];

interface TenantForm { nome: string; endereco: string; telefone: string; email: string }
interface ReminderConfig {
  review24h: boolean;
  review72h: boolean;
  reactivationDays: number;
  reminderBeforeDelivery: number;
}
interface Plan { name: string; price: number; expiresAt?: string; features: string[] }
interface WhatsAppStatus { connected: boolean; phone?: string }

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('oficina');
  const [tenant, setTenant] = useState<TenantForm>({ nome: '', endereco: '', telefone: '', email: '' });
  const [tenantSaving, setTenantSaving] = useState(false);
  const [tenantSaved, setTenantSaved] = useState(false);
  const [reminders, setReminders] = useState<ReminderConfig>({
    review24h: true, review72h: true, reactivationDays: 60, reminderBeforeDelivery: 1,
  });
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [whatsapp, setWhatsapp] = useState<WhatsAppStatus>({ connected: false });
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [mechanics, setMechanics] = useState<{ id: string; name: string; email: string; isActive: boolean }[]>([]);

  useEffect(() => {
    api.get('/tenants/me').then((r) => {
      const d = r.data;
      setTenant({ nome: d.nome ?? '', endereco: d.endereco ?? '', telefone: d.telefone ?? d.phone ?? '', email: d.email ?? '' });
    }).catch(() => {});

    api.get('/reminders/config').then((r) => {
      if (r.data) setReminders((prev) => ({ ...prev, ...r.data }));
    }).catch(() => {});

    api.get('/billing/plan').then((r) => setPlan(r.data)).catch(() => {});

    api.get('/whatsapp/status').then((r) => setWhatsapp(r.data ?? { connected: false })).catch(() => {});

    api.get('/users').then((r) => {
      const all = r.data?.users ?? r.data ?? [];
      setMechanics(all.filter((u: { role?: string }) => u.role === 'mechanic'));
    }).catch(() => {});
  }, []);

  async function saveTenant() {
    setTenantSaving(true);
    try {
      await api.patch('/tenants/me', tenant);
      setTenantSaved(true);
      setTimeout(() => setTenantSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setTenantSaving(false);
    }
  }

  async function saveReminders() {
    setReminderSaving(true);
    try {
      await api.patch('/reminders/config', reminders);
      setReminderSaved(true);
      setTimeout(() => setReminderSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setReminderSaving(false);
    }
  }

  async function refreshWhatsapp() {
    setWhatsappLoading(true);
    try {
      const r = await api.get('/whatsapp/status');
      setWhatsapp(r.data ?? { connected: false });
    } catch (err) {
      console.error(err);
    } finally {
      setWhatsappLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Configurações</h1>

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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
        {/* Oficina */}
        {tab === 'oficina' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 mb-4">Dados da oficina</h2>
            <Input
              label="Nome da oficina"
              value={tenant.nome}
              onChange={(e) => setTenant((t) => ({ ...t, nome: e.target.value }))}
              placeholder="Auto Center Silva"
            />
            <Input
              label="Endereço"
              value={tenant.endereco}
              onChange={(e) => setTenant((t) => ({ ...t, endereco: e.target.value }))}
              placeholder="Rua das Flores, 123 — São Paulo, SP"
            />
            <Input
              label="Telefone"
              value={tenant.telefone}
              onChange={(e) => setTenant((t) => ({ ...t, telefone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
            <Input
              label="Email"
              type="email"
              value={tenant.email}
              onChange={(e) => setTenant((t) => ({ ...t, email: e.target.value }))}
              placeholder="contato@oficina.com"
            />
            <div className="pt-2">
              <label className="text-sm font-medium text-gray-700 block mb-2">Logo (upload)</label>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <Button loading={tenantSaving} onClick={saveTenant} className="w-full">
              <Save className="w-4 h-4" />
              {tenantSaved ? 'Salvo!' : 'Salvar alterações'}
            </Button>
          </div>
        )}

        {/* WhatsApp */}
        {tab === 'whatsapp' && (
          <div className="space-y-6">
            <h2 className="font-semibold text-gray-800 mb-4">WhatsApp</h2>

            <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
              {whatsapp.connected ? (
                <Wifi className="w-6 h-6 text-green-500 shrink-0" />
              ) : (
                <WifiOff className="w-6 h-6 text-red-400 shrink-0" />
              )}
              <div>
                <p className="font-medium text-gray-800">
                  {whatsapp.connected ? 'Conectado' : 'Desconectado'}
                </p>
                {whatsapp.phone && <p className="text-xs text-gray-500 font-mono">{whatsapp.phone}</p>}
              </div>
              <Button size="sm" variant="secondary" loading={whatsappLoading} onClick={refreshWhatsapp} className="ml-auto">
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </Button>
            </div>

            {!whatsapp.connected && (
              <div className="text-center space-y-4">
                <div className="bg-gray-100 rounded-xl p-8 inline-block">
                  <div className="w-40 h-40 bg-white rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-300 text-sm">
                    QR Code
                    <br />
                    (via Uazapi)
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Abra o WhatsApp no celular → Menu → Dispositivos conectados → Conectar um dispositivo
                </p>
              </div>
            )}
          </div>
        )}

        {/* Plano */}
        {tab === 'plano' && (
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800 mb-4">Seu plano</h2>

            {plan ? (
              <>
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Star className="w-5 h-5 text-yellow-300" />
                    <p className="font-bold text-lg">{plan.name}</p>
                  </div>
                  <p className="text-2xl font-bold mb-1">
                    R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                  </p>
                  {plan.expiresAt && (
                    <p className="text-blue-200 text-sm">
                      Próximo vencimento: {new Date(plan.expiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>

                {plan.features?.length > 0 && (
                  <ul className="space-y-1">
                    {plan.features.map((f, i) => (
                      <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="text-green-500">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                )}

                <Button className="w-full" onClick={() => window.location.href = '/register/plan'}>
                  Fazer upgrade
                </Button>
              </>
            ) : (
              <p className="text-center text-gray-400 py-8">Carregando informações do plano...</p>
            )}
          </div>
        )}

        {/* Lembretes */}
        {tab === 'lembretes' && (
          <div className="space-y-5">
            <h2 className="font-semibold text-gray-800 mb-4">Lembretes automáticos</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Avaliação 24h após entrega</p>
                  <p className="text-xs text-gray-400">Solicita avaliação do cliente</p>
                </div>
                <button
                  onClick={() => setReminders((r) => ({ ...r, review24h: !r.review24h }))}
                  className={`w-10 h-6 rounded-full transition-colors ${reminders.review24h ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${reminders.review24h ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Avaliação 72h após entrega</p>
                  <p className="text-xs text-gray-400">Lembrete se não avaliou</p>
                </div>
                <button
                  onClick={() => setReminders((r) => ({ ...r, review72h: !r.review72h }))}
                  className={`w-10 h-6 rounded-full transition-colors ${reminders.review72h ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-1 ${reminders.review72h ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-gray-400" />
                  Reativação após (dias sem OS)
                </label>
                <input
                  type="number"
                  min={7}
                  max={365}
                  value={reminders.reactivationDays}
                  onChange={(e) => setReminders((r) => ({ ...r, reactivationDays: parseInt(e.target.value) || 60 }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400">Disparar mensagem de reativação após N dias sem OS</p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800">Lembrete antes da entrega (dias)</label>
                <input
                  type="number"
                  min={0}
                  max={7}
                  value={reminders.reminderBeforeDelivery}
                  onChange={(e) => setReminders((r) => ({ ...r, reminderBeforeDelivery: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <Button loading={reminderSaving} onClick={saveReminders} className="w-full">
              <Save className="w-4 h-4" />
              {reminderSaved ? 'Salvo!' : 'Salvar configurações'}
            </Button>
          </div>
        )}

        {/* Equipe */}
        {tab === 'equipe' && (
          <div>
            <h2 className="font-semibold text-gray-800 mb-4">Equipe</h2>
            {mechanics.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum mecânico cadastrado</p>
            ) : (
              <div className="space-y-2">
                {mechanics.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.email}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {m.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={() => window.location.href = '/mechanics'}
            >
              Gerenciar mecânicos
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
