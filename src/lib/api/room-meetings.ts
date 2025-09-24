const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.amore.id.vn';
//const API_TOKEN = localStorage.getItem('accessToken') || '';
//const accessToken = localStorage.getItem('accessToken');

type Opts = RequestInit & { query?: Record<string, any> };

function buildUrl(path: string, query?: Record<string, any>) {
  const url = new URL(path.replace(/^\//, ''), API_BASE + '/');
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

export async function api<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const url = buildUrl(path, opts.query);
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    // ...(localStorage.getItem('accessToken') ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers, credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
  }
  return res.json();
}
