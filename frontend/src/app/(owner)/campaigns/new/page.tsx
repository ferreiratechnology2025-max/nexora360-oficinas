'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Users, MessageSquare, Clock, Send, Check } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Input';

interface Segment {
  type: string;
  label: string;
  count: number;
}

interface CampaignForm {
  name: string;
  segment: string;
  message: string;
  channel: 'whatsapp' | 'email' | 'both';
  scheduleType: 'immediate' | 'scheduled';
  scheduledAt: string;
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'WhatsApp + Email' },
];

const STEPS = ['Campanha', 'Mensagem', 'Envio'];

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [form, setForm] = useState<CampaignForm>({
    name: '',
    segment: '',
    message: '',
    channel: 'whatsapp',
    scheduleType: 'immediate',
    scheduledAt: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof CampaignForm, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/campaigns/segments').then((r) => {
      const raw = r.data?.segments ?? r.data ?? [];
      setSegments(
        raw.map((s: { type?: string; segment?: string; label?: string; count?: number; total?: number }) => ({
          type: s.type ?? s.segment ?? '',
          label: s.label ?? s.type ?? s.segment ?? '',
          count: s.count ?? s.total ?? 0,
        })),
      );
    }).catch(() => {});
  }, []);

  const selectedSegment = segments.find((s) => s.type === form.segment);

  function validateStep() {
    const e: Partial<Record<keyof CampaignForm, string>> = {};
    if (step === 0) {
      if (!form.name.trim()) e.name = 'Nome obrigatório';
      if (!form.segment) e.segment = 'Selecione um segmento';
    }
    if (step === 1) {
      if (!form.message.trim()) e.message = 'Mensagem obrigatória';
    }
    if (step === 2 && form.scheduleType === 'scheduled') {
      if (!form.scheduledAt) e.scheduledAt = 'Informe a data e hora';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep()) setStep((s) => s + 1);
  }

  async function submit() {
    if (!validateStep()) return;
    setSaving(true);
    try {
      await api.post('/campaigns', {
        name: form.name,
        segment: form.segment,
        message: form.message,
        channel: form.channel,
        scheduledAt: form.scheduleType === 'scheduled' ? form.scheduledAt : undefined,
      });
      router.push('/campaigns');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => step === 0 ? router.push('/campaigns') : setStep((s) => s - 1)}
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Nova campanha</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  i < step
                    ? 'bg-green-500 text-white'
                    : i === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-sm hidden sm:inline ${i === step ? 'font-semibold text-gray-800' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${i < step ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {/* Step 0: Campaign details */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Dados da campanha</h2>
            </div>

            <Input
              label="Nome da campanha"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={errors.name}
              placeholder="Ex: Promoção de inverno"
            />

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Segmento de clientes</label>
              <select
                value={form.segment}
                onChange={(e) => setForm((f) => ({ ...f, segment: e.target.value }))}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500
                  ${errors.segment ? 'border-red-400' : 'border-gray-300'}`}
              >
                <option value="">Selecione um segmento...</option>
                {segments.map((s) => (
                  <option key={s.type} value={s.type}>
                    {s.label} ({s.count} clientes)
                  </option>
                ))}
              </select>
              {errors.segment && <span className="text-xs text-red-600">{errors.segment}</span>}
            </div>

            {selectedSegment && (
              <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3">
                <Users className="w-8 h-8 text-blue-500 shrink-0" />
                <div>
                  <p className="font-semibold text-blue-800 text-lg">{selectedSegment.count} clientes</p>
                  <p className="text-xs text-blue-600">receberão esta campanha</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Message */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Mensagem</h2>
            </div>

            <Select
              label="Canal"
              value={form.channel}
              onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as CampaignForm['channel'] }))}
              options={CHANNEL_OPTIONS}
            />

            <Textarea
              label="Mensagem"
              rows={6}
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              error={errors.message}
              placeholder="Olá {nome}! Passando para lembrar que faz {dias} dias desde a última revisão do seu {veiculo}..."
            />

            {form.message && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-500 mb-2 font-medium">Preview da mensagem</p>
                <div className="bg-green-100 text-green-900 rounded-xl rounded-tl-none px-4 py-3 text-sm inline-block max-w-xs shadow-sm">
                  {form.message
                    .replace('{nome}', 'João')
                    .replace('{dias}', '45')
                    .replace('{veiculo}', 'Honda Civic')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Schedule */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-gray-800">Quando enviar?</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'immediate', label: 'Enviar agora', icon: Send, desc: 'Disparo imediato' },
                { key: 'scheduled', label: 'Agendar', icon: Clock, desc: 'Escolha data e hora' },
              ].map(({ key, label, icon: Icon, desc }) => (
                <button
                  key={key}
                  onClick={() => setForm((f) => ({ ...f, scheduleType: key as CampaignForm['scheduleType'] }))}
                  className={`border-2 rounded-xl p-4 text-left transition-colors ${
                    form.scheduleType === key
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-6 h-6 mb-2 ${form.scheduleType === key ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className={`font-semibold text-sm ${form.scheduleType === key ? 'text-blue-800' : 'text-gray-700'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>

            {form.scheduleType === 'scheduled' && (
              <Input
                label="Data e hora"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                error={errors.scheduledAt}
              />
            )}

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700">Resumo da campanha</p>
              <div className="text-xs text-gray-500 space-y-1">
                <p><span className="font-medium text-gray-700">Campanha:</span> {form.name}</p>
                <p><span className="font-medium text-gray-700">Segmento:</span> {selectedSegment?.label ?? form.segment}</p>
                <p><span className="font-medium text-gray-700">Canal:</span> {CHANNEL_OPTIONS.find((o) => o.value === form.channel)?.label}</p>
                <p className="font-semibold text-blue-700">
                  {selectedSegment?.count ?? '?'} clientes receberão esta mensagem
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="secondary" className="flex-1" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
          )}
          {step < 2 ? (
            <Button className="flex-1" onClick={next}>
              Próximo
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button className="flex-1" loading={saving} onClick={submit}>
              <Send className="w-4 h-4" />
              {form.scheduleType === 'immediate' ? 'Enviar campanha' : 'Agendar campanha'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
