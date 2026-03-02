import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center space-y-6">
        {/* Illustration */}
        <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
          <svg viewBox="0 0 80 80" className="w-16 h-16" fill="none">
            <circle cx="40" cy="40" r="38" fill="#dbeafe" />
            <path d="M20 40l12 12 28-24" stroke="#2563eb" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Cadastro recebido!</h1>
          <p className="text-gray-600 leading-relaxed">
            Nossa equipe vai analisar e liberar seu acesso em breve.
            Normalmente em até <strong>2 horas úteis</strong>.
          </p>
        </div>

        {/* WhatsApp notice */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-left">
          <div className="flex items-start gap-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-600 shrink-0 mt-0.5" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.527 5.857L.057 23.5l5.775-1.515A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 0 1-5.007-1.37l-.36-.213-3.427.9.916-3.34-.234-.374A9.819 9.819 0 0 1 2.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-800 mb-0.5">Notificação via WhatsApp</p>
              <p className="text-xs text-green-700">
                Você receberá uma mensagem no WhatsApp informado no cadastro quando seu acesso for liberado.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-gray-500">
          <p>Dúvidas? Entre em contato pelo WhatsApp:</p>
          <a
            href="https://wa.me/5511999999999"
            className="inline-flex items-center gap-2 text-green-600 font-semibold hover:underline"
          >
            (11) 99999-9999
          </a>
        </div>

        <Link
          href="/login"
          className="block text-sm text-blue-600 hover:underline"
        >
          Já ativaram minha conta → Entrar
        </Link>
      </div>
    </div>
  );
}
