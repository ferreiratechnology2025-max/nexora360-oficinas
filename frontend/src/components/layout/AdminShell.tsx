'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FlaskConical, Activity, LogOut, Menu, X,
} from 'lucide-react';
import { useState } from 'react';
import { logout } from '@/lib/auth';

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/trials', icon: FlaskConical, label: 'Trials' },
  { href: '/admin/tenants', icon: Users, label: 'Oficinas' },
  { href: '/admin/system', icon: Activity, label: 'Sistema' },
];

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AdminShell({ children, title }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-56 bg-gray-900 border-r border-gray-800 z-50
        flex flex-col transition-transform duration-200
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <div>
            <span className="font-bold text-blue-400">Nexora</span>
            <span className="font-bold text-white">360</span>
            <span className="block text-xs text-red-400 font-semibold tracking-widest uppercase mt-0.5">Admin</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-2 py-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => setOpen(true)} className="lg:hidden text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          {title && <h1 className="text-sm font-semibold text-gray-200">{title}</h1>}
          <div className="flex-1" />
          <span className="text-xs text-red-400 font-bold bg-red-950 px-2 py-0.5 rounded">SUPERADMIN</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-950 text-gray-100">
          {children}
        </main>
      </div>
    </div>
  );
}
