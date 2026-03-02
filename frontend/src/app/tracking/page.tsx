import { Wrench } from 'lucide-react';

export default function TrackingIndexPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-2xl mb-6">
          <Wrench className="w-8 h-8 text-gray-400" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">
          Link inválido ou expirado
        </h1>
        <p className="text-gray-400 text-sm">
          Este link de rastreamento é inválido ou expirou.
          <br />
          Peça um novo link para a sua oficina.
        </p>
      </div>
    </div>
  );
}
