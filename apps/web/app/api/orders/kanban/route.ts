import { KanbanBoardVNextSchema } from '@cnc-quote/shared/contracts/vnext';

import { forwardJsonWithSchema, proxyFetch } from '@/app/api/_lib/proxyFetch';

const ensureBase = (): string => {
  const base = process.env.NEST_BASE;
  if (!base) {
    throw new Error('NEST_BASE is not configured for admin kanban proxy');
  }
  return base.replace(/\/$/, '');
};

const buildBoardUrl = (request: Request): string => {
  const target = new URL('/admin/kanban/board', ensureBase());
  const incoming = new URL(request.url);
  incoming.searchParams.forEach((value, key) => {
    if (value !== null) {
      target.searchParams.set(key, value);
    }
  });
  target.searchParams.set('view', 'vnext');
  return target.toString();
};

const buildMutationUrl = (): string => new URL('/admin/kanban/orders', ensureBase()).toString();

const extractBody = async (request: Request): Promise<string | undefined> => {
  const text = await request.text();
  return text.length > 0 ? text : undefined;
};

export async function GET(request: Request) {
  const upstream = await proxyFetch(request, buildBoardUrl(request), { method: 'GET' });
  return forwardJsonWithSchema(upstream, KanbanBoardVNextSchema);
}

export async function POST(request: Request) {
  const body = await extractBody(request);
  const headers = body ? { 'content-type': request.headers.get('content-type') ?? 'application/json' } : undefined;
  const upstream = await proxyFetch(request, buildMutationUrl(), {
    method: 'POST',
    body,
    headers,
  });
  return upstream;
}

export async function PATCH(request: Request) {
  const body = await extractBody(request);
  const headers = body ? { 'content-type': request.headers.get('content-type') ?? 'application/json' } : undefined;
  const upstream = await proxyFetch(request, buildMutationUrl(), {
    method: 'PATCH',
    body,
    headers,
  });
  return upstream;
}
