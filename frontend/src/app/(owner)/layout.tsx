'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Users, Wrench,
  Megaphone, BarChart2, Settings, LogOut, Menu, X, Bell,
} from 'lucide-react';
import { logout } from '@/lib/auth';
import api from '@/lib/api';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/orders', icon: ClipboardList, label: 'Ordens de Serviço' },
  { href: '/customers', icon: Users, label: 'Clientes' },
  { href: '/mechanics', icon: Wrench, label: 'Mecânicos' },
  { href: '/campaigns', icon: Megaphone, label: 'Campanhas' },
  { href: '/reports', icon: BarChart2, label: 'Relatórios' },
  { href: '/settings', icon: Settings, label: 'Configurações' },
];

const BOTTOM_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/orders', icon: ClipboardList, label: 'OS' },
  { href: '/customers', icon: Users, label: 'Clientes' },
  { href: '/campaigns', icon: Megaphone, label: 'Campanhas' },
  { href: '/settings', icon: Settings, label: 'Config.' },
];

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    api.get('/orders', { params: { status: 'waiting_approval', limit: 1 } })
      .then((r) => setWaitingCount(r.data?.total ?? 0))
      .catch(() => {});
    api.get('/tenants/me')
      .then((r) => setTenantName(r.data?.nome ?? r.data?.name ?? ''))
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-50
          flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div>
            <span className="text-lg font-bold text-blue-400">Nexora</span>
            <span className="text-lg font-bold text-white">360</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {tenantName && (
          <div className="px-5 py-2 border-b border-gray-800">
            <p className="text-xs text-gray-400 truncate">{tenantName}</p>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
                `}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{label}</span>
                {href === '/orders' && waitingCount > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {waitingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-700">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1 min-w-0">
            {tenantName && <p className="text-sm font-semibold text-gray-800 truncate">{tenantName}</p>}
          </div>
          {waitingCount > 0 && (
            <Link href="/orders?status=waiting_approval" className="relative text-gray-500 hover:text-orange-500">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {waitingCount > 9 ? '9+' : waitingCount}
              </span>
            </Link>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom navigation — mobile only */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
          {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors
                  ${active ? 'text-blue-600' : 'text-gray-500'}`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {href === '/orders' && waitingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full w-2 h-2" />
                  )}
                </div>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
