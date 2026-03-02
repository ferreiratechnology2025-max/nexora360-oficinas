'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, QrCode, ChevronLeft, Lock } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

type PayMethod = 'card' | 'pix';

function formatCard(v: string) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})/g, '$1 ').trim();
}
function formatExpiry(v: string) {
  return v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
}

function PaymentContent() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get('plan') ?? 'profissional';
  const price = parseFloat(params.get('price') ?? '197');
  const billing = params.get('billing') ?? 'monthly';
  const tenantId = params.get('tenantId');

  const [method, setMethod] = useState<PayMethod>('card');
  const [card, setCard] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [errors, setErrors] = useState<Partial<typeof card>>({});
  const [loading, setLoading] = useState(false);

  function validateCard() {
    const e: Partial<typeof card> = {};
    if (card.number.replace(/\s/g, '').length < 16) e.number = 'Número inválido';
    if (!card.name.trim()) e.name = 'Nome obrigatório';
    if (card.expiry.length < 5) e.expiry = 'Data inválida';
    if (card.cvv.length < 3) e.cvv = 'CVV inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function pay() {
    if (method === 'card' && !validateCard()) return;
    setLoading(true);
    try {
      await api.post('/billing/subscribe', {
        plan,
        billing,
        method,
        tenantId,
        ...(method === 'card' ? {
          cardNumber: card.number.replace(/\s/g, ''),
          cardName: card.name,
          cardExpiry: card.expiry,
          cardCvv: card.cvv,
        } : {}),
      });
      router.push('/register/setup');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const PLAN_NAMES: Record<string, string> = {
    starter: 'Starter', profissional: 'Profissional', elite: 'Elite',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </button>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Form */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-xl p-6">
            <h1 className="text-lg font-bold text-gray-900 mb-1">Pagamento</h1>
            <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              Ambiente seguro — SSL protegido
            </p>

            {/* Method selector */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {([
                { key: 'card', icon: CreditCard, label: 'Cartão de crédito' },
                { key: 'pix', icon: QrCode, label: 'Pix / Boleto' },
              ] as { key: PayMethod; icon: React.FC<{ className?: string }>; label: string }[]).map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setMethod(key)}
                  className={`border-2 rounded-xl p-3 text-left transition-colors ${
                    method === key ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-1.5 ${method === key ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className={`text-sm font-medium ${method === key ? 'text-blue-800' : 'text-gray-700'}`}>{label}</p>
                </button>
              ))}
            </div>

            {method === 'card' ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Número do cartão</label>
                  <input
                    value={card.number}
                    onChange={(e) => setCard((c) => ({ ...c, number: formatCard(e.target.value) }))}
                    placeholder="0000 0000 0000 0000"
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${errors.number ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.number && <span className="text-xs text-red-600">{errors.number}</span>}
                </div>

                <Input
                  label="Nome no cartão"
                  value={card.name}
                  onChange={(e) => setCard((c) => ({ ...c, name: e.target.value.toUpperCase() }))}
                  error={errors.name}
                  placeholder="JOÃO DA SILVA"
                />

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Validade</label>
                    <input
                      value={card.expiry}
                      onChange={(e) => setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))}
                      placeholder="MM/AA"
                      className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${errors.expiry ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {errors.expiry && <span className="text-xs text-red-600">{errors.expiry}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">CVV</label>
                    <input
                      value={card.cvv}
                      onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      placeholder="123"
                      className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500
                        ${errors.cvv ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                    />
                    {errors.cvv && <span className="text-xs text-red-600">{errors.cvv}</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="bg-gray-100 rounded-xl p-8 inline-block">
                  <QrCode className="w-20 h-20 text-gray-400 mx-auto" />
                  <p className="text-xs text-gray-500 mt-2">QR Code gerado após confirmação</p>
                </div>
                <p className="text-sm text-gray-600">
                  Um código Pix será gerado após confirmar o pedido.
                  <br />
                  <span className="text-xs text-gray-400">Boleto disponível com vencimento em 3 dias úteis</span>
                </p>
              </div>
            )}

            <Button className="w-full mt-6" size="lg" loading={loading} onClick={pay}>
              <Lock className="w-4 h-4" />
              Confirmar pagamento · R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Button>
          </div>

          {/* Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 text-white rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold text-lg">Resumo do pedido</h2>
              <div className="border-t border-white/20 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Plano {PLAN_NAMES[plan] ?? plan}</span>
                  <span className="font-medium">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300">Cobrança</span>
                  <span>{billing === 'annual' ? 'Anual' : 'Mensal'}</span>
                </div>
                {billing === 'annual' && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Total anual</span>
                    <span className="font-bold">R$ {(price * 12).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
              <div className="border-t border-white/20 pt-4">
                <div className="flex justify-between">
                  <span className="font-semibold">Total hoje</span>
                  <span className="font-bold text-lg">
                    R$ {(billing === 'annual' ? price * 12 : price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Cancele a qualquer momento. Sem taxas de cancelamento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentContent />
    </Suspense>
  );
}
