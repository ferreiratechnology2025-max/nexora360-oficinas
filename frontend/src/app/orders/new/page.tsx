'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Check, ChevronRight, ChevronLeft, User, Car, ClipboardList } from 'lucide-react';
import api from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import type { Customer, Vehicle } from '@/types';

// ─── Step schemas ─────────────────────────────────────────
const customerSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório'),
  phone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cpf: z.string().optional(),
});

const vehicleSchema = z.object({
  brand: z.string().min(1, 'Marca obrigatória'),
  model: z.string().min(1, 'Modelo obrigatório'),
  plate: z.string().min(7, 'Placa inválida').max(8),
  year: z.string().optional(),
  color: z.string().optional(),
});

const orderSchema = z.object({
  problemDescription: z.string().min(5, 'Descreva o problema'),
  mechanicId: z.string().optional(),
  currentKm: z.string().optional(),
});

type CustomerForm = z.infer<typeof customerSchema>;
type VehicleForm = z.infer<typeof vehicleSchema>;
type OrderForm = z.infer<typeof orderSchema>;

// ─── Step indicator ───────────────────────────────────────
const STEPS = [
  { label: 'Cliente', icon: User },
  { label: 'Veículo', icon: Car },
  { label: 'OS', icon: ClipboardList },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center mb-6">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                  done
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : active
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-gray-300 text-gray-400 bg-white'
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span
                className={`text-xs mt-1 font-medium ${
                  active ? 'text-blue-600' : done ? 'text-gray-700' : 'text-gray-400'
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-10px] ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────
export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Customer state
  const [searchPhone, setSearchPhone] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState<Customer[] | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomer, setNewCustomer] = useState(false);

  // Vehicle state
  const [foundVehicles, setFoundVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [newVehicle, setNewVehicle] = useState(false);

  // Mechanics list
  const [mechanics, setMechanics] = useState<{ id: string; name: string }[]>([]);
  const [mechanicsLoaded, setMechanicsLoaded] = useState(false);

  const customerForm = useForm<CustomerForm>({ resolver: zodResolver(customerSchema) });
  const vehicleForm = useForm<VehicleForm>({ resolver: zodResolver(vehicleSchema) });
  const orderForm = useForm<OrderForm>({ resolver: zodResolver(orderSchema) });

  // ── Step 1: search customer ──
  async function handleSearchCustomer() {
    if (!searchPhone.trim()) return;
    setSearching(true);
    setFoundCustomers(null);
    setSelectedCustomer(null);
    setNewCustomer(false);
    try {
      const res = await api.get('/customers', { params: { search: searchPhone, limit: 5 } });
      const list: Customer[] = res.data?.customers ?? res.data ?? [];
      setFoundCustomers(list);
      if (list.length === 0) setNewCustomer(true);
    } catch {
      setFoundCustomers([]);
      setNewCustomer(true);
    } finally {
      setSearching(false);
    }
  }

  async function handleSelectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setNewCustomer(false);
    await loadVehicles(c.id);
    setStep(1);
  }

  async function handleSaveNewCustomer(data: CustomerForm) {
    setError('');
    try {
      const res = await api.post('/customers', data);
      const c: Customer = res.data;
      setSelectedCustomer(c);
      setNewCustomer(false);
      setFoundVehicles([]);
      setNewVehicle(true);
      setStep(1);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao cadastrar cliente.');
    }
  }

  // ── Step 2: vehicles ──
  async function loadVehicles(customerId: string) {
    try {
      const res = await api.get(`/vehicles`, { params: { customerId } });
      const list: Vehicle[] = res.data?.vehicles ?? res.data ?? [];
      setFoundVehicles(list);
      if (list.length === 0) setNewVehicle(true);
    } catch {
      setFoundVehicles([]);
      setNewVehicle(true);
    }
  }

  function handleSelectVehicle(v: Vehicle) {
    setSelectedVehicle(v);
    setNewVehicle(false);
    loadMechanics();
    setStep(2);
  }

  async function handleSaveNewVehicle(data: VehicleForm) {
    if (!selectedCustomer) return;
    setError('');
    try {
      const res = await api.post('/vehicles', {
        ...data,
        customerId: selectedCustomer.id,
        year: data.year ? parseInt(data.year, 10) : undefined,
      });
      const v: Vehicle = res.data;
      setSelectedVehicle(v);
      setNewVehicle(false);
      loadMechanics();
      setStep(2);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao cadastrar veículo.');
    }
  }

  // ── Step 3: order ──
  async function loadMechanics() {
    if (mechanicsLoaded) return;
    try {
      const res = await api.get('/users/mechanics');
      setMechanics(res.data ?? []);
      setMechanicsLoaded(true);
    } catch {
      setMechanicsLoaded(true);
    }
  }

  async function handleSubmitOrder(data: OrderForm) {
    if (!selectedCustomer || !selectedVehicle) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/orders', {
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        mechanicId: data.mechanicId || undefined,
        problemDescription: data.problemDescription,
        currentKm: data.currentKm ? parseInt(data.currentKm, 10) : undefined,
      });
      router.push(`/orders/${res.data.id}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e?.response?.data?.message ?? 'Erro ao criar OS.');
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Nova Ordem de Serviço">
      <div className="max-w-xl mx-auto">
        <StepIndicator current={step} />

        {/* ── STEP 1: Customer ── */}
        {step === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <h2 className="font-semibold text-gray-800">Buscar ou cadastrar cliente</h2>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Telefone ou nome do cliente"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchCustomer()}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button onClick={handleSearchCustomer} loading={searching} size="sm">
                <Search className="w-4 h-4" />
                Buscar
              </Button>
            </div>

            {foundCustomers !== null && foundCustomers.length > 0 && (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {foundCustomers.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between"
                    onClick={() => handleSelectCustomer(c)}
                  >
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
                <button
                  className="w-full text-left px-4 py-3 text-blue-600 text-sm font-medium hover:bg-blue-50"
                  onClick={() => setNewCustomer(true)}
                >
                  + Cadastrar novo cliente
                </button>
              </div>
            )}

            {foundCustomers !== null && foundCustomers.length === 0 && !newCustomer && (
              <p className="text-sm text-gray-500 text-center">Nenhum cliente encontrado.</p>
            )}

            {newCustomer && (
              <form onSubmit={customerForm.handleSubmit(handleSaveNewCustomer)} className="space-y-3 pt-2 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700">Novo cliente</p>
                <Input label="Nome *" error={customerForm.formState.errors.name?.message} {...customerForm.register('name')} />
                <Input label="Telefone (WhatsApp) *" type="tel" placeholder="11999999999" error={customerForm.formState.errors.phone?.message} {...customerForm.register('phone')} />
                <Input label="E-mail" type="email" error={customerForm.formState.errors.email?.message} {...customerForm.register('email')} />
                <Input label="CPF" error={customerForm.formState.errors.cpf?.message} {...customerForm.register('cpf')} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" loading={customerForm.formState.isSubmitting}>
                  Salvar cliente e continuar
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        )}

        {/* ── STEP 2: Vehicle ── */}
        {step === 1 && selectedCustomer && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(0)} className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="font-semibold text-gray-800">Veículo de {selectedCustomer.name}</h2>
            </div>

            {foundVehicles.length > 0 && !newVehicle && (
              <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {foundVehicles.map((v) => (
                  <button
                    key={v.id}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between"
                    onClick={() => handleSelectVehicle(v)}
                  >
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{v.brand} {v.model} {v.year}</p>
                      <p className="text-xs text-gray-500 font-mono">{v.plate}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                ))}
                <button
                  className="w-full text-left px-4 py-3 text-blue-600 text-sm font-medium hover:bg-blue-50"
                  onClick={() => setNewVehicle(true)}
                >
                  + Adicionar novo veículo
                </button>
              </div>
            )}

            {(newVehicle || foundVehicles.length === 0) && (
              <form onSubmit={vehicleForm.handleSubmit(handleSaveNewVehicle)} className="space-y-3">
                {foundVehicles.length > 0 && (
                  <p className="text-sm font-medium text-gray-700">Novo veículo</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Marca *" placeholder="Ex: Toyota" error={vehicleForm.formState.errors.brand?.message} {...vehicleForm.register('brand')} />
                  <Input label="Modelo *" placeholder="Ex: Corolla" error={vehicleForm.formState.errors.model?.message} {...vehicleForm.register('model')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Placa *" placeholder="ABC1D23" error={vehicleForm.formState.errors.plate?.message} {...vehicleForm.register('plate')} />
                  <Input label="Ano" type="number" placeholder={String(new Date().getFullYear())} error={vehicleForm.formState.errors.year?.message} {...vehicleForm.register('year')} />
                </div>
                <Input label="Cor" placeholder="Ex: Prata" error={vehicleForm.formState.errors.color?.message} {...vehicleForm.register('color')} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <Button type="submit" className="w-full" loading={vehicleForm.formState.isSubmitting}>
                  Salvar veículo e continuar
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </form>
            )}
          </div>
        )}

        {/* ── STEP 3: Order ── */}
        {step === 2 && selectedCustomer && selectedVehicle && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="font-semibold text-gray-800">Detalhes da OS</h2>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-700"><span className="font-medium">Cliente:</span> {selectedCustomer.name}</p>
              <p className="text-gray-700">
                <span className="font-medium">Veículo:</span> {selectedVehicle.brand} {selectedVehicle.model} ·{' '}
                <span className="font-mono">{selectedVehicle.plate}</span>
              </p>
            </div>

            <form onSubmit={orderForm.handleSubmit(handleSubmitOrder)} className="space-y-4">
              <Textarea
                label="Descrição do problema *"
                rows={4}
                placeholder="Descreva o problema relatado pelo cliente..."
                error={orderForm.formState.errors.problemDescription?.message}
                {...orderForm.register('problemDescription')}
              />

              <Select
                label="Mecânico responsável"
                error={orderForm.formState.errors.mechanicId?.message}
                {...orderForm.register('mechanicId')}
              >
                <option value="">Não atribuir agora</option>
                {mechanics.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>

              <Input
                label="KM atual"
                type="number"
                placeholder="Ex: 85000"
                error={orderForm.formState.errors.currentKm?.message}
                {...orderForm.register('currentKm')}
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" loading={submitting}>
                <Check className="w-4 h-4" />
                Abrir Ordem de Serviço
              </Button>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
