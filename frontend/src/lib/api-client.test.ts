import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./token-storage', () => ({
  getCsrfToken: vi.fn(() => 'csrf-token'),
  setCsrfToken: vi.fn(),
  setLoggedInHint: vi.fn(),
  clearLoggedInHint: vi.fn(),
  hasLoggedInHint: vi.fn(() => true),
}));

import { ApiError, apiRequest } from './api-client';

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

function mockFetchOnceJsonError(status: number) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve('<not json>'),
    json: () => Promise.reject(new Error('invalid json')),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function mockFetchSequence(responses: MockResponseInit[]) {
  const fetchMock = vi.fn();
  for (const { status, body, bodyText } of responses) {
    const text =
      bodyText !== undefined
        ? bodyText
        : body !== undefined
          ? JSON.stringify(body)
          : '';
    fetchMock.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(text),
      json: () => Promise.resolve(body),
    });
  }
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

describe('apiRequest — MX-002A : ApiError préserve les erreurs structurées', () => {
  it('erreur NestJS standard : message préservé, code absent', async () => {
    mockFetchOnce({
      status: 409,
      body: {
        statusCode: 409,
        message: 'Ce séjour est déjà clôturé (statut actuel : CHECKOUT).',
        error: 'Conflict',
      },
    });

    await expect(
      apiRequest('/stays/1/extend', { method: 'POST' }),
    ).rejects.toMatchObject({
      message: 'Ce séjour est déjà clôturé (statut actuel : CHECKOUT).',
      status: 409,
      code: undefined,
    });
  });

  it('erreur structurée ROOM_UNAVAILABLE : code et alternatives préservés dans details', async () => {
    const alternatives = [{ id: 5, numero: '105', roomTypeId: 2 }];
    mockFetchOnce({
      status: 409,
      body: {
        code: 'ROOM_UNAVAILABLE',
        message:
          "La chambre actuelle (3) n'est pas disponible pour la période de prolongation demandée.",
        alternatives,
      },
    });

    try {
      await apiRequest('/stays/1/extend', { method: 'POST' });
      throw new Error('devait lever une ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(409);
      expect(apiErr.code).toBe('ROOM_UNAVAILABLE');
      expect(
        (apiErr.details as { alternatives?: unknown }).alternatives,
      ).toEqual(alternatives);
    }
  });

  it('erreur structurée PAYMENT_REQUIRED : amountRequired et availableCredit préservés dans details', async () => {
    mockFetchOnce({
      status: 409,
      body: {
        code: 'PAYMENT_REQUIRED',
        message:
          'Crédit disponible insuffisant pour couvrir le supplément de cette prolongation — enregistrer un paiement puis relancer la prolongation.',
        amountRequired: '350.00',
        availableCredit: '0.00',
      },
    });

    try {
      await apiRequest('/stays/1/extend', { method: 'POST' });
      throw new Error('devait lever une ApiError');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe('PAYMENT_REQUIRED');
      const details = apiErr.details as {
        amountRequired?: string;
        availableCredit?: string;
      };
      expect(details.amountRequired).toBe('350.00');
      expect(details.availableCredit).toBe('0.00');
    }
  });

  it('réponse non JSON : ApiError avec message de repli, sans lever d’exception non gérée', async () => {
    mockFetchOnceJsonError(502);

    await expect(
      apiRequest('/stays/1/extend', { method: 'POST' }),
    ).rejects.toMatchObject({
      status: 502,
      message: 'Erreur 502',
      code: undefined,
    });
  });

  it('reste compatible avec `error instanceof Error` (convention existante des appelants)', async () => {
    mockFetchOnce({
      status: 500,
      body: { message: 'Erreur interne du serveur.' },
    });

    try {
      await apiRequest('/stays/1/extend', { method: 'POST' });
      throw new Error('devait lever une erreur');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as Error).message).toBe('Erreur interne du serveur.');
    }
  });

  it('comportement 401 existant non régressé : un refresh réussi rejoue silencieusement la requête initiale', async () => {
    const fetchMock = mockFetchSequence([
      { status: 401, body: { message: 'Unauthorized' } },
      { status: 200, body: { csrfToken: 'new-csrf-token' } },
      { status: 200, body: { id: 1 } },
    ]);

    const result = await apiRequest('/stays/1');

    expect(result).toEqual({ id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1] as [string])[0]).toContain('/auth/refresh');
  });

  it('comportement 401 existant non régressé : un refresh échoué lève une Error de session expirée (pas une ApiError)', async () => {
    mockFetchSequence([
      { status: 401, body: { message: 'Unauthorized' } },
      { status: 401, body: { message: 'Invalid refresh token' } },
    ]);

    await expect(apiRequest('/stays/1')).rejects.toThrow(
      'Session expirée, veuillez vous reconnecter.',
    );
  });
});
