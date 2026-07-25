import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./token-storage', () => ({
  getCsrfToken: vi.fn(() => 'csrf-token'),
  setCsrfToken: vi.fn(),
  setLoggedInHint: vi.fn(),
  clearLoggedInHint: vi.fn(),
  hasLoggedInHint: vi.fn(() => true),
}));

import { apiRequest } from './api-client';

interface MockResponseInit {
  status: number;
  body?: unknown;
  bodyText?: string;
}

function mockFetchOnce({ status, body, bodyText }: MockResponseInit) {
  const text =
    bodyText !== undefined
      ? bodyText
      : body !== undefined
        ? JSON.stringify(body)
        : '';
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('apiRequest — CH-007 : corps de réponse vide hors 204', () => {
  it("ne lève plus 'Unexpected end of JSON input' sur un corps vide en dehors d'un 204 explicite", async () => {
    mockFetchOnce({ status: 200, bodyText: '' });
    const result = await apiRequest('/reservations/1/self-checkin-pending');
    expect(result).toBeUndefined();
  });

  it('parse normalement un corps JSON non vide', async () => {
    mockFetchOnce({ status: 200, body: { id: 1, nom: 'Test' } });
    const result = await apiRequest<{ id: number; nom: string }>('/guests/1');
    expect(result).toEqual({ id: 1, nom: 'Test' });
  });
});

describe('apiRequest — CH-022 : upload multipart (FormData)', () => {
  it('ne fixe jamais Content-Type manuellement quand le corps est un FormData (laisse le navigateur poser la boundary)', async () => {
    const fetchMock = mockFetchOnce({ status: 201, body: { ok: true } });
    const formData = new FormData();
    formData.append('fichier', new Blob(['x']), 'x.jpg');

    await apiRequest('/document-ocr/scan', { method: 'POST', body: formData });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('fixe Content-Type: application/json pour un corps JSON classique', async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: {} });
    await apiRequest('/guests', { method: 'POST', body: JSON.stringify({}) });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('apiRequest — CH-026(e) : cookies httpOnly + double-submit CSRF', () => {
  it('envoie toujours credentials: "include" (cookies httpOnly cross-origin)', async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: {} });
    await apiRequest('/guests/1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
  });

  it("ajoute l'en-tête X-CSRF-Token sur une requête mutante (POST)", async () => {
    const fetchMock = mockFetchOnce({ status: 201, body: {} });
    await apiRequest('/guests', { method: 'POST', body: JSON.stringify({}) });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBe('csrf-token');
  });

  it("n'ajoute jamais l'en-tête X-CSRF-Token sur une requête en lecture (GET)", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: {} });
    await apiRequest('/guests/1');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['X-CSRF-Token']).toBeUndefined();
  });
});
