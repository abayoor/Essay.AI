import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type ServerConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type SupabaseUser = { id: string };
type OAuthState = { accessToken: string; issuedAt: number };
type StravaToken = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id?: number | string };
};
type StoredConnection = {
  strava_athlete_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};
type StravaActivity = {
  id: number;
  name: string;
  start_date: string;
  distance: number;
  total_elevation_gain: number;
  moving_time: number;
  map?: { summary_polyline?: string | null };
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Не задана переменная окружения ${name}.`);
  return value;
}

function config(): ServerConfig {
  return {
    clientId: required('STRAVA_CLIENT_ID'),
    clientSecret: required('STRAVA_CLIENT_SECRET'),
    redirectUri: required('STRAVA_REDIRECT_URI'),
    stateSecret: required('STRAVA_STATE_SECRET'),
    supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? required('SUPABASE_URL'),
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? required('SUPABASE_ANON_KEY'),
  };
}

function json(value: object, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function base64Url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function encryptState(state: OAuthState, secret: string): string {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${base64Url(iv)}.${base64Url(tag)}.${base64Url(encrypted)}`;
}

function decryptState(value: string, secret: string): OAuthState {
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Некорректное состояние авторизации.');
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, decodeBase64Url(ivValue));
  decipher.setAuthTag(decodeBase64Url(tagValue));
  const decoded = Buffer.concat([decipher.update(decodeBase64Url(encryptedValue)), decipher.final()]).toString('utf8');
  const state = JSON.parse(decoded) as OAuthState;
  if (!state.accessToken || Date.now() - state.issuedAt > 15 * 60 * 1000) throw new Error('Срок авторизации истёк. Попробуй подключить Strava снова.');
  return state;
}

function bearerToken(request: Request): string {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) throw new Error('Нужна авторизация.');
  return header.slice('Bearer '.length);
}

async function authenticatedUser(accessToken: string, settings: ServerConfig): Promise<SupabaseUser> {
  const response = await fetch(`${settings.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: settings.supabaseAnonKey, authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Сессия истекла. Войди в аккаунт снова.');
  const user = await response.json() as Partial<SupabaseUser>;
  if (!user.id) throw new Error('Не удалось определить пользователя.');
  return { id: user.id };
}

async function readConnection(userId: string, accessToken: string, settings: ServerConfig): Promise<StoredConnection | null> {
  const endpoint = new URL(`${settings.supabaseUrl}/rest/v1/strava_connections`);
  endpoint.searchParams.set('user_id', `eq.${userId}`);
  endpoint.searchParams.set('select', 'strava_athlete_id,access_token,refresh_token,expires_at');
  const response = await fetch(endpoint, { headers: { apikey: settings.supabaseAnonKey, authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Не удалось прочитать подключение Strava.');
  const rows = await response.json() as StoredConnection[];
  return rows[0] ?? null;
}

async function saveConnection(userId: string, connection: StoredConnection, accessToken: string, settings: ServerConfig): Promise<void> {
  const response = await fetch(`${settings.supabaseUrl}/rest/v1/strava_connections?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: settings.supabaseAnonKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({ user_id: userId, ...connection }),
  });
  if (!response.ok) throw new Error('Не удалось сохранить подключение Strava.');
}

async function exchangeToken(params: URLSearchParams, settings: ServerConfig): Promise<StravaToken> {
  params.set('client_id', settings.clientId);
  params.set('client_secret', settings.clientSecret);
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: params,
  });
  if (!response.ok) throw new Error('Strava не подтвердил подключение.');
  const token = await response.json() as Partial<StravaToken>;
  if (!token.access_token || !token.refresh_token || !token.expires_at) throw new Error('Strava вернул неполные данные подключения.');
  return token as StravaToken;
}

function asStoredConnection(token: StravaToken, fallbackAthleteId: string | undefined): StoredConnection {
  const athleteId = token.athlete?.id ?? fallbackAthleteId;
  if (athleteId === undefined) throw new Error('Strava не вернул идентификатор спортсмена.');
  return {
    strava_athlete_id: String(athleteId),
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: new Date(token.expires_at * 1000).toISOString(),
  };
}

async function refreshedConnection(connection: StoredConnection, userId: string, accessToken: string, settings: ServerConfig): Promise<StoredConnection> {
  if (new Date(connection.expires_at).getTime() > Date.now() + 5 * 60 * 1000) return connection;
  const params = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: connection.refresh_token });
  const refreshed = asStoredConnection(await exchangeToken(params, settings), connection.strava_athlete_id);
  await saveConnection(userId, refreshed, accessToken, settings);
  return refreshed;
}

function appOrigin(settings: ServerConfig): string {
  return new URL(settings.redirectUri).origin;
}

async function authorize(request: Request, settings: ServerConfig): Promise<Response> {
  const accessToken = bearerToken(request);
  await authenticatedUser(accessToken, settings);
  const state = encryptState({ accessToken, issuedAt: Date.now() }, settings.stateSecret);
  const endpoint = new URL('https://www.strava.com/oauth/authorize');
  endpoint.searchParams.set('client_id', settings.clientId);
  endpoint.searchParams.set('redirect_uri', settings.redirectUri);
  endpoint.searchParams.set('response_type', 'code');
  endpoint.searchParams.set('approval_prompt', 'auto');
  endpoint.searchParams.set('scope', 'activity:read');
  endpoint.searchParams.set('state', state);
  return json({ authorizationUrl: endpoint.toString() });
}

async function callback(request: Request, settings: ServerConfig): Promise<Response> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const stateValue = requestUrl.searchParams.get('state');
  const failureUrl = new URL('/settings?strava=failed', appOrigin(settings));
  if (!code || !stateValue) return Response.redirect(failureUrl, 302);
  try {
    const state = decryptState(stateValue, settings.stateSecret);
    const user = await authenticatedUser(state.accessToken, settings);
    const token = await exchangeToken(new URLSearchParams({ grant_type: 'authorization_code', code }), settings);
    await saveConnection(user.id, asStoredConnection(token, undefined), state.accessToken, settings);
    return Response.redirect(new URL('/settings?strava=connected', appOrigin(settings)), 302);
  } catch {
    return Response.redirect(failureUrl, 302);
  }
}

async function status(request: Request, settings: ServerConfig): Promise<Response> {
  const accessToken = bearerToken(request);
  const user = await authenticatedUser(accessToken, settings);
  const connection = await readConnection(user.id, accessToken, settings);
  return json({ connected: connection !== null });
}

async function activities(request: Request, settings: ServerConfig): Promise<Response> {
  const accessToken = bearerToken(request);
  const user = await authenticatedUser(accessToken, settings);
  const saved = await readConnection(user.id, accessToken, settings);
  if (!saved) return json({ error: 'Сначала подключи Strava в настройках.' }, 409);
  const connection = await refreshedConnection(saved, user.id, accessToken, settings);
  const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=20&page=1', {
    headers: { authorization: `Bearer ${connection.access_token}` },
  });
  if (!response.ok) return json({ error: 'Strava не дал загрузить тренировки. Попробуй позже.' }, response.status === 429 ? 429 : 502);
  const source = await response.json() as StravaActivity[];
  return json({ activities: source.map((activity) => ({
    id: activity.id,
    name: activity.name,
    startDate: activity.start_date,
    distanceKm: activity.distance / 1000,
    elevationGainM: activity.total_elevation_gain,
    durationSeconds: activity.moving_time,
    summaryPolyline: activity.map?.summary_polyline ?? null,
  })) });
}

async function handler(request: Request): Promise<Response> {
  try {
    const settings = config();
    const action = new URL(request.url).pathname.split('/').pop();
    if (action === 'authorize' && request.method === 'GET') return authorize(request, settings);
    if (action === 'callback' && request.method === 'GET') return callback(request, settings);
    if (action === 'status' && request.method === 'GET') return status(request, settings);
    if (action === 'activities' && request.method === 'GET') return activities(request, settings);
    return json({ error: 'Маршрут не найден.' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Внутренняя ошибка сервера.';
    return json({ error: message }, message === 'Нужна авторизация.' ? 401 : 500);
  }
}

export default { fetch: handler };
