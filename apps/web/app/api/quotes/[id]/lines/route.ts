import { NextRequest } from 'next/server';
import { z } from 'zod';

import { buildProxyResponse, resolveApiUrl } from '@/app/api/_lib/backend';
import { proxyFetch } from '@/app/api/_lib/proxyFetch';

const AddLineSchema = z
  .object({
    fileId: z.string().min(1, 'fileId is required'),
    fileName: z.string().optional(),
    fileSize: z.number().int().nonnegative().optional(),
    contentType: z.string().optional(),
  })
  .catchall(z.unknown());

const mapFileToPart = (file: z.infer<typeof AddLineSchema>) => ({
  file_id: file.fileId,
  process_type: 'cnc_milling',
  material_id: 'best_available',
  finish_ids: [] as string[],
  quantities: [1],
  selected_quantity: 1,
  lead_time_option: 'standard',
  inspection_level: 'basic',
});

const buildErrorResponse = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  let parsed: z.infer<typeof AddLineSchema>;

  try {
    const body = await request.json();
    parsed = AddLineSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => issue.message).join('; ');
      return buildErrorResponse(issues);
    }
    return buildErrorResponse('Invalid JSON payload');
  }

  const part = mapFileToPart(parsed);
  const payload = { parts: [part] };

  const upstream = await proxyFetch(request, resolveApiUrl(`/quotes/${encodeURIComponent(context.params.id)}/parts`), {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
  });

  return buildProxyResponse(upstream);
}
