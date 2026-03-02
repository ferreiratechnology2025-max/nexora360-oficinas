'use client';
import type { OrderStatus } from '@/types';
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '@/types';

interface BadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
};

export function StatusBadge({ status, size = 'md', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${SIZE_CLASSES[size]} ${ORDER_STATUS_COLORS[status]} ${className}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

interface GenericBadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function Badge({ label, color = 'bg-gray-100 text-gray-700', className = '' }: GenericBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color} ${className}`}>
      {label}
    </span>
  );
}
