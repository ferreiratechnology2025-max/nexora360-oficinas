'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, FlaskConical, Activity, LogOut, Menu, X, Settings,
} from 'lucide-react';
import { useState } from 'react';
import { logout } from '@/lib/auth';
import api from '@/lib/api';

const NAV_ITEMS = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/trials',    icon: FlaskConical,    label: 'Trials'    },
  { href: '/admin/tenants',   icon: Users,           label: 'Oficinas'  },
  { href: '/admin/system',    icon: Activity,        label: 'Sistema'   },
];

interface AdminShellProps {
  children: React.ReactNode;
  title?: string;
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next,    setNext]    = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next !== confirm) { setError('As senhas não coincidem.'); return; }
    if (next.length < 6)  { setError('Nova senha deve ter ao menos 6 caracteres.'); return; }
    setLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword: current, newPassword: next });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Erro ao alterar senha.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">Alterar senha</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <p className="text-green-400 font-medium mb-4">Senha alterada com sucesso!</p>
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-white">Fechar</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {[
              { label: 'Senha atual',         val: current,  set: setCurrent  },
              { label: 'Nova senha',          val: next,     set: setNext     },
              { label: 'Confirmar nova senha',val: confirm,  set: setConfirm  },
            ].map(({ label, val, set }) => (
              <div key={label} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-400">{label}</label>
                <input
                  type="password"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ))}

            {error && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50 transition-colors mt-1"
            >
              {loading ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function AdminShell({ children, title }: AdminShellProps) {
  const pathname = usePathname();
  const [open,      setOpen]      = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {showModal && <ChangePasswordModal onClose={() => setShowModal(false)} />}

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
          <button
            onClick={() => setShowModal(true)}
            title="Alterar senha"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-gray-950 text-gray-100">
          {children}
        </main>
      </div>
    </div>
  );
}
