export interface User {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'mechanic' | 'superadmin';
  tenantId: string;
}

export interface Tenant {
  id: string;
  nome: string;
  email: string;
  phone?: string;
  plano: string;
  isActive: boolean;
  status: string;
}

export type OrderStatus =
  | 'received'
  | 'diagnosis'
  | 'waiting_approval'
  | 'in_progress'
  | 'testing'
  | 'ready'
  | 'delivered'
  | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Recebido',
  diagnosis: 'Diagnóstico',
  waiting_approval: 'Aguard. Aprovação',
  in_progress: 'Em Andamento',
  testing: 'Em Testes',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  received: 'bg-gray-100 text-gray-700',
  diagnosis: 'bg-yellow-100 text-yellow-800',
  waiting_approval: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-blue-100 text-blue-800',
  testing: 'bg-purple-100 text-purple-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-700',
};

export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  'received', 'diagnosis', 'waiting_approval', 'in_progress', 'testing', 'ready', 'delivered',
];

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  cpf?: string;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year?: number;
  plate: string;
  color?: string;
  customerId: string;
}

export interface Order {
  id: string;
  tenantId: string;
  customerId: string;
  vehicleId: string;
  mechanicId?: string;
  orderNumber: string;
  trackingToken: string;
  problemDescription?: string;
  diagnosis?: string;
  laborValue: number;
  partsValue: number;
  totalValue: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  customer: Customer;
  vehicle: Vehicle;
  mechanic?: { id: string; name: string };
}
