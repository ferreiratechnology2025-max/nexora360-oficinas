'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, TrendingUp, LogOut } from 'lucide-react';
import { logout, getUser } from '@/lib/auth';

const BOTTOM_NAV = [
  { href: '/mechanic/orders', icon: ClipboardList, label: 'Minhas OS' },
  { href: '/mechanic/performance', icon: TrendingUp, label: 'Performance' },
];

export default function MechanicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = getUser();

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <div>
          <div>
            <span className="text-sm font-bold text-blue-400">Nexora</span>
            <span className="text-sm font-bold text-white">360</span>
          </div>
          {user?.name && <p className="text-xs text-gray-400 mt-0.5">{user.name}</p>}
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      <main className="flex-1 p-4 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-30">
        {BOTTOM_NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors
                ${active
                  ? 'text-blue-600 border-t-2 border-blue-600 -mt-px'
                  : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
