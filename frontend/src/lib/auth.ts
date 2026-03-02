import Cookies from 'js-cookie';
import type { User } from '@/types';

const TOKEN_KEY = 'nexora_token';
const USER_KEY = 'nexora_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return Cookies.get(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  Cookies.set(TOKEN_KEY, token, { expires: 7, sameSite: 'lax' });
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  Cookies.remove(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function logout(): void {
  removeToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}
