export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let sessionExpired: () => void = () => {};
export function onSessionExpired(handler: () => void) {
  sessionExpired = handler;
  return () => {
    sessionExpired = () => {};
  };
}
export function clearCsrf() {
  csrfToken = null;
  csrfRequest = null;
}
const statusMessages: Record<number, string> = {
  400: 'Skontrolujte zadané údaje. Ak problém pretrváva, obnovte stránku.',
  401: 'Relácia vypršala. Prihláste sa znova.',
  403: 'Na túto akciu nemáte oprávnenie.',
  404: 'Požadovaný záznam sa nenašiel.',
  409: 'Záznam s týmito údajmi už existuje.',
  429: 'Príliš veľa pokusov. Skúste to znova o minútu.',
};
function businessMessage(message: string): string {
  const text = message.toLocaleLowerCase();
  if (text.includes('медикамент') && (text.includes('уже') || text.includes('вже')))
    return 'Tento liek už bol pridaný k hospitalizácii.';
  if (text.includes('email') && text.includes('існує'))
    return 'Používateľ s týmto e-mailom už existuje.';
  if (text.includes('не передано жодного')) return 'Neboli zadané žiadne zmeny.';
  if (text.includes('не знайдено'))
    return 'Súvisiaci záznam sa nenašiel. Obnovte stránku a skúste to znova.';
  if (text.includes('дата виписки')) return 'Dátum prepustenia nemôže byť pred prijatím.';
  return 'Údaje sa nepodarilo uložiť. Skontrolujte vyplnené polia a skúste to znova.';
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  anonymous = false,
): Promise<T> {
  options.signal?.throwIfAborted();
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-TOKEN', await getCsrf());
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      method,
      headers,
      credentials: 'same-origin',
    });
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error != null && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
    )
      throw error;
    const failure = new ApiError(
      0,
      'Server nie je dostupný. Skontrolujte pripojenie a skúste to znova.',
    );
    failure.cause = error;
    throw failure;
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
      errors?: Record<string, string[]>;
    };
    if (response.status === 401 && !anonymous) {
      clearCsrf();
      sessionExpired();
    }
    // MVC antiforgery failures can be non-JSON 400 responses. Refresh only on the next explicit submission.
    if (response.status === 400 && !body.message && !body.errors) clearCsrf();
    const message =
      body.code === 'backend_unavailable'
        ? 'Backend nie je spustený alebo nie je dostupný. Skontrolujte jeho pripojenie.'
        : anonymous && response.status === 401
          ? 'Nesprávny e-mail alebo heslo.'
          : response.status >= 500
            ? 'Pri spracovaní nastala chyba servera. Skúste to znova neskôr.'
            : (statusMessages[response.status] ?? 'Operáciu sa nepodarilo dokončiť.');
    const error = new ApiError(response.status, message, body.errors);
    // Preserve business errors for the form without displaying infrastructure details on 5xx.
    if (response.status === 400 && body.message) error.message = businessMessage(body.message);
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function getCsrf(force = false): Promise<string> {
  if (force) clearCsrf();
  if (csrfToken) return csrfToken;
  if (!csrfRequest)
    csrfRequest = request<{ csrfToken: string }>('/auth/csrf', {}, true)
      .then((result) => {
        csrfToken = result.csrfToken;
        return result.csrfToken;
      })
      .finally(() => {
        csrfRequest = null;
      });
  return csrfRequest;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Nastala neočakávaná chyba.';
}
