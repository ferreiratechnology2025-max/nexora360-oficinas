'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Plan {
  key: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    monthlyPrice: 97,
    annualPrice: 79,
    features: [
      'Até 100 OS/mês',
      '2 mecânicos',
      'WhatsApp básico',
      'Rastreamento de OS',
      'Relatórios simples',
    ],
  },
  {
    key: 'profissional',
    name: 'Profissional',
    monthlyPrice: 197,
    annualPrice: 157,
    popular: true,
    features: [
      'OS ilimitadas',
      'Mecânicos ilimitados',
      'WhatsApp automático',
      'Campanhas de reativação',
      'Relatórios avançados',
      'Segmentação de clientes',
      'Suporte prioritário',
    ],
  },
  {
    key: 'elite',
    name: 'Elite',
    monthlyPrice: 397,
    annualPrice: 317,
    features: [
      'Tudo do Profissional',
      'Multi-unidades',
      'API personalizada',
      'Gerente de conta dedicado',
      'Treinamento da equipe',
      'SLA garantido',
    ],
  },
];

function PlanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');
  const [annual, setAnnual] = useState(false);
  const [selected, setSelected] = useState('profissional');

  function proceed() {
    const plan = PLANS.find((p) => p.key === selected)!;
    const price = annual ? plan.annualPrice : plan.monthlyPrice;
    const params = new URLSearchParams({
      plan: selected,
      price: price.toString(),
      billing: annual ? 'annual' : 'monthly',
      ...(tenantId ? { tenantId } : {}),
    });
    router.push(`/register/payment?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-2xl font-bold text-blue-400">Nexora</span>
          <span className="text-2xl font-bold text-white">360</span>
          <h1 className="text-3xl font-bold text-white mt-4 mb-2">Escolha seu plano</h1>
          <p className="text-gray-400">Cancele a qualquer momento. Sem fidelidade.</p>

          {/* Toggle mensal/anual */}
          <div className="inline-flex items-center gap-3 bg-gray-800 rounded-xl p-1 mt-6">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !annual ? 'bg-white text-gray-900' : 'text-gray-400'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                annual ? 'bg-white text-gray-900' : 'text-gray-400'
              }`}
            >
              Anual
              <span className="ml-1.5 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">-20%</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = annual ? plan.annualPrice : plan.monthlyPrice;
            const isSelected = selected === plan.key;

            return (
              <div
                key={plan.key}
                onClick={() => setSelected(plan.key)}
                className={`relative rounded-2xl p-6 cursor-pointer transition-all ${
                  plan.popular
                    ? 'bg-blue-600 text-white shadow-2xl ring-4 ring-blue-400'
                    : isSelected
                    ? 'bg-white shadow-xl ring-2 ring-blue-500'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Mais popular
                  </div>
                )}

                <div className="mb-4">
                  <h2 className={`text-xl font-bold ${plan.popular ? 'text-white' : isSelected ? 'text-gray-900' : 'text-white'}`}>
                    {plan.name}
                  </h2>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className={`text-3xl font-bold ${plan.popular ? 'text-white' : isSelected ? 'text-blue-600' : 'text-blue-300'}`}>
                      R$ {price}
                    </span>
                    <span className={`text-sm ${plan.popular ? 'text-blue-200' : 'text-gray-400'}`}>/mês</span>
                  </div>
                  {annual && (
                    <p className={`text-xs mt-1 ${plan.popular ? 'text-blue-200' : 'text-gray-400'}`}>
                      Cobrado anualmente · R$ {price * 12}/ano
                    </p>
                  )}
                </div>

                <ul className="space-y-2 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-center gap-2 text-sm ${
                      plan.popular ? 'text-blue-100' : isSelected ? 'text-gray-700' : 'text-gray-300'
                    }`}>
                      <Check className={`w-4 h-4 shrink-0 ${plan.popular ? 'text-white' : 'text-green-500'}`} />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className={`h-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-colors ${
                  isSelected || plan.popular
                    ? plan.popular
                      ? 'bg-white text-blue-600'
                      : 'bg-blue-600 text-white'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}>
                  {isSelected ? 'Selecionado ✓' : 'Escolher'}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <Button size="lg" onClick={proceed}>
            Continuar com {PLANS.find((p) => p.key === selected)?.name}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <PlanContent />
    </Suspense>
  );
}
