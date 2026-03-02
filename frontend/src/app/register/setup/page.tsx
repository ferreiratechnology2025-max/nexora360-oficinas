'use client';
import { useRouter } from 'next/navigation';
import { Smartphone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SetupPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full space-y-6">
        <div className="text-center">
          <div className="inline-block mb-2">
            <span className="text-xl font-bold text-blue-600">Nexora</span>
            <span className="text-xl font-bold text-gray-900">360</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conecte o WhatsApp</h1>
          <p className="text-gray-500 text-sm">
            Para enviar mensagens automáticas, conecte o número do WhatsApp da sua oficina.
          </p>
        </div>

        {/* QR Code area */}
        <div className="bg-gray-50 rounded-2xl p-8 text-center border-2 border-dashed border-gray-200">
          <div className="w-48 h-48 bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center mx-auto shadow-inner">
            <div className="grid grid-cols-3 gap-1 mb-2">
              {[...Array(9)].map((_, i) => (
                <div key={i} className={`w-5 h-5 rounded-sm ${
                  [0,1,3,4,5,7,8].includes(i) ? 'bg-gray-300' : 'bg-white'
                }`} />
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">QR Code</p>
            <p className="text-xs text-gray-300">(Uazapi pendente)</p>
          </div>
          <p className="text-xs text-gray-500 mt-3">O QR Code será gerado quando o Uazapi estiver configurado</p>
        </div>

        {/* Instructions */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700">Como conectar:</p>
          {[
            'Abra o WhatsApp no seu celular',
            'Toque no menu → Dispositivos conectados',
            'Toque em "Conectar um dispositivo"',
            'Aponte a câmera para o QR Code acima',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                {i + 1}
              </span>
              <p className="text-sm text-gray-600">{step}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-green-50 rounded-xl p-3 text-sm">
          <Smartphone className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-green-700">
            Use o número principal da sua oficina para melhor entrega das mensagens.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={() => router.push('/register/done')}>
            Já conectei!
          </Button>
          <button
            onClick={() => router.push('/register/done')}
            className="text-sm text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1"
          >
            Pular por agora
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
