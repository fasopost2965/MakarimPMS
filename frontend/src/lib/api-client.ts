const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(body?.message ?? `Erreur ${res.status}`);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
