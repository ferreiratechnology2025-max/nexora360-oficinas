'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Wrench, Car, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import axios from 'axios';
import type { OrderStatus } from '@/types';
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE, ORDER_STATUS_COLORS } from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface TrackingData {
  orderNumber: string;
  status: OrderStatus;
  problemDescription?: string;
  diagnosis?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  vehicle: {
    brand: string;
    model: string;
    plate: string;
    year?: number;
  };
  tenant?: {
    name: string;
    phone?: string;
  };
}

const STATUS_ICONS: Partial<Record<OrderStatus, React.ReactNode>> = {
  delivered: <CheckCircle className="w-5 h-5 text-emerald-600" />,
  cancelled: <XCircle className="w-5 h-5 text-red-500" />,
};

export default function TrackingPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await axios.get(`${BASE_URL}/orders/track/${token}`);
        setData(res.data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
        <div className="animate-pulse text-white text-center">
          <Wrench className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-gray-300">Carregando...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold mb-2">OS não encontrada</h1>
          <p className="text-gray-400 text-sm">O link de rastreamento pode estar incorreto ou expirado.</p>
        </div>
      </div>
    );
  }

  const currentIdx = ORDER_STATUS_SEQUENCE.indexOf(data.status);
  const isFinal = data.status === 'delivered' || data.status === 'cancelled';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 p-4 flex flex-col items-center">
      {/* Header */}
      <div className="text-center mb-6 mt-6">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl mb-3 shadow-lg">
          <Wrench className="w-6 h-6 text-white" />
        </div>
        {data.tenant?.name && (
          <p className="text-white font-bold text-lg">{data.tenant.name}</p>
        )}
        <p className="text-gray-400 text-sm">Rastreamento de Ordem de Serviço</p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        {/* Status card */}
        <div className="bg-white rounded-2xl shadow-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-400 font-mono">{data.orderNumber}</p>
            <div className="flex items-center gap-1.5">
              {STATUS_ICONS[data.status] ?? <Clock className="w-4 h-4 text-blue-500" />}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ORDER_STATUS_COLORS[data.status]}`}>
                {ORDER_STATUS_LABELS[data.status]}
              </span>
            </div>
          </div>

          {/* Vehicle */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <Car className="w-4 h-4 text-gray-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {data.vehicle.brand} {data.vehicle.model} {data.vehicle.year}
              </p>
              <p className="text-xs font-mono text-gray-500">{data.vehicle.plate}</p>
            </div>
          </div>

          {/* Problem */}
          {data.problemDescription && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Problema relatado</p>
              <p className="text-sm text-gray-700 leading-relaxed">{data.problemDescription}</p>
            </div>
          )}

          {/* Diagnosis */}
          {data.diagnosis && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Diagnóstico</p>
              <p className="text-sm text-gray-700 leading-relaxed">{data.diagnosis}</p>
            </div>
          )}
        </div>

        {/* Progress timeline */}
        {!isFinal && (
          <div className="bg-white rounded-2xl shadow-xl p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Progresso</p>
            <div className="space-y-3">
              {ORDER_STATUS_SEQUENCE.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-3 h-3 rounded-full shrink-0 transition-colors ${
                          active
                            ? 'bg-blue-600 ring-2 ring-blue-200'
                            : done
                            ? 'bg-gray-800'
                            : 'bg-gray-200'
                        }`}
                      />
                      {i < ORDER_STATUS_SEQUENCE.length - 1 && (
                        <div className={`w-0.5 h-4 mt-0.5 ${done ? 'bg-gray-700' : 'bg-gray-200'}`} />
                      )}
                    </div>
                    <span
                      className={`text-sm pb-4 ${
                        active
                          ? 'font-bold text-blue-600'
                          : done
                          ? 'text-gray-700 font-medium'
                          : 'text-gray-400'
                      }`}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Delivered */}
        {data.status === 'delivered' && data.deliveredAt && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
            <p className="font-bold text-emerald-800 text-lg">Veículo entregue!</p>
            <p className="text-sm text-emerald-600 mt-1">
              {format(new Date(data.deliveredAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        )}

        {/* Cancelled */}
        {data.status === 'cancelled' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <XCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
            <p className="font-bold text-red-700 text-lg">OS Cancelada</p>
            <p className="text-sm text-red-500 mt-1">Entre em contato com a oficina para mais informações.</p>
          </div>
        )}

        {/* Dates */}
        <div className="text-center text-gray-400 text-xs space-y-1 pb-6">
          <p>Abertura: {format(new Date(data.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <p>Atualizado {formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true, locale: ptBR })}</p>
          {data.tenant?.phone && (
            <a
              href={`https://wa.me/55${data.tenant.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-3 text-blue-400 underline text-sm"
            >
              Falar com a oficina via WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
