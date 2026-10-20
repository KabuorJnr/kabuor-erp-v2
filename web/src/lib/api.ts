// Talking to the Kabuor ERP API. The sign-in token lives in localStorage; a 401 signs the person out.
import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const KEY = 'kerp-session';

export type Session = {
  token: string;
  user: { id: string; name: string; email: string; role: Role; language: 'en' | 'sw'; employeeId?: string | null; mustChangePassword?: boolean; permissions?: Permission[] };
  company: { id: string; name: string; kraPin: string; vatRegistered: boolean };
};
export type Role = 'Owner' | 'Accountant' | 'Sales' | 'Storekeeper' | 'Viewer' | 'HR' | 'Employee' | 'Procurement';

export function getSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Session | null;
    return s && Array.isArray(s.user.permissions) ? s : null; // saved before permissions came with the sign-in
  } catch {
    return null;
  }
}
export function setSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event('kerp-session'));
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = getSession();
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && s) setSession(null);
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? (res.status === 403 ? 'You don’t have access to this.' : 'Network problem. Check your connection.'));
  return data as T;
}

/** Loads `path` and reloads when it changes. `reload()` fetches again (after a save). */
export function useApi<T = any>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: Boolean(path) });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    api<T>(path)
      .then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => {
      live = false;
    };
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useSession() {
  const [s, set] = useState(getSession);
  useEffect(() => {
    const on = () => set(getSession());
    window.addEventListener('kerp-session', on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener('kerp-session', on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return s;
}

/** What each part of the app needs. The server decides who has which (Auth.cs, Policies) and sends the list with
 * the sign-in, so the menu, pages, tiles and buttons always agree with what the API will allow. */
export type Permission = 'read' | 'sales.view' | 'sell' | 'pos' | 'crm' | 'finance' | 'reports' | 'stock.view' | 'stock' | 'buy.view' | 'buy' | 'make' | 'people' | 'admin';
export const can = (s: Session | null, p: Permission) => Boolean(s?.user.permissions?.includes(p));
