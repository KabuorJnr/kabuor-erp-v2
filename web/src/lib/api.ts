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
  user: { id: string; name: string; email: string; role: Role; language: 'en' | 'sw'; employeeId?: string | null; mustChangePassword?: boolean; twoFactorEnabled?: boolean; permissions?: Permission[] };
  company: { id: string; name: string; kraPin: string; vatRegistered: boolean; industry?: string; accountingLockDate?: string | null; awaitingFirstPayment?: boolean };
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

const apiCache = new Map<string, { data: any; timestamp: number }>();

export function clearApiCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
  } else {
    for (const key of apiCache.keys()) {
      if (key.startsWith(prefix)) apiCache.delete(key);
    }
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = getSession();
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  const res = await fetch(`/api${path}`, {
    method,
    headers: { ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && s) setSession(null);
  if (res.status === 204) {
    if (method !== 'GET') clearApiCache();
    return undefined as T;
  }
  const data = await res.json().catch(() => ({}));
  // The account hasn't been paid for yet (or no longer is, on a stale page): show the payment screen.
  if (res.status === 402 && data.code === 'pay-to-start' && s && !s.company.awaitingFirstPayment) setSession({ ...s, company: { ...s.company, awaitingFirstPayment: true } });
  if (!res.ok) throw new ApiError(res.status, data.error ?? (res.status === 403 ? 'You don’t have access to this.' : 'Network problem. Check your connection.'));
  if (method !== 'GET') {
    clearApiCache();
  }
  return data as T;
}

/** Downloads a file from the API (CSV exports) with the sign-in token, under the server's file name. */
export async function download(path: string, fallbackName: string) {
  const s = getSession();
  const res = await fetch(`/api${path}`, { headers: s ? { Authorization: `Bearer ${s.token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, 'Couldn’t download that file.');
  const name = /filename="?([^";]+)"?/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Loads `path` and reloads when it changes. SWR caching renders instantaneously if cached. `reload()` forces a refetch. */
export function useApi<T = any>(path: string | null) {
  const cached = path ? apiCache.get(path) : undefined;
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: cached ? (cached.data as T) : null,
    error: null,
    loading: Boolean(path) && !cached,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let live = true;
    const currentCached = apiCache.get(path);
    if (!currentCached) {
      setState((s) => ({ ...s, loading: true }));
    }
    api<T>(path)
      .then((data) => {
        apiCache.set(path, { data, timestamp: Date.now() });
        if (live) setState({ data, error: null, loading: false });
      })
      .catch((e: Error) => {
        if (live) setState((s) => ({ ...s, error: e.message, loading: false }));
      });
    return () => {
      live = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => {
    if (path) apiCache.delete(path);
    setTick((t) => t + 1);
  }, [path]);

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
