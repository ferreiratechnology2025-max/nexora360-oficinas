'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, ClipboardList, Share2, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Cadastre o primeiro mecânico',
    desc: 'Adicione sua equipe para distribuir as ordens de serviço.',
    action: '/mechanics',
    label: 'Ir para Mecânicos',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    icon: ClipboardList,
    title: 'Abra a primeira OS',
    desc: 'Registre o primeiro veículo e acompanhe o serviço em tempo real.',
    action: '/orders/new',
    label: 'Nova OS',
    color: 'bg-green-50 text-green-600',
  },
  {
    icon: Share2,
    title: 'Compartilhe o link de rastreamento',
    desc: 'Seu cliente pode acompanhar o serviço sem precisar ligar.',
    action: '/orders',
    label: 'Ver OS',
    color: 'bg-purple-50 text-purple-600',
  },
];

export default function DonePage() {
  const router = useRouter();
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    api.get('/tenants/me')
      .then((r) => setTenantName(r.data?.nome ?? r.data?.name ?? 'sua oficina'))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full space-y-8">
        {/* Celebration */}
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Bem-vindo{tenantName ? `, ${tenantName}` : ''}!
          </h1>
          <p className="text-gray-500">
            Sua conta está pronta. Veja por onde começar:
          </p>
        </div>

        {/* Next steps */}
        <div className="space-y-3">
          {STEPS.map(({ icon: Icon, title, desc, action, color }, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => router.push(action)}
            >
              <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-gray-300">Passo {i + 1}</span>
                <p className="font-semibold text-gray-800 text-sm">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{desc}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="w-full"
          onClick={() => router.push('/dashboard')}
        >
          Ir para o Dashboard
          <ArrowRight className="w-4 h-4" />
        </Button>

        <p className="text-center text-xs text-gray-400">
          Precisa de ajuda? Acesse a central de suporte ou fale pelo WhatsApp.
        </p>
      </div>
    </div>
  );
}
