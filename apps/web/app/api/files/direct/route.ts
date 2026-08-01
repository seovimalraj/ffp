import { NextRequest } from 'next/server';

import { buildProxyResponse, resolveApiUrl } from '@/app/api/_lib/backend';
import { proxyFetch } from '@/app/api/_lib/proxyFetch';

export async function POST(request: NextRequest) {
  // Pass through the entire multipart/form-data body to the backend
  const formData = await request.formData();
  
  const upstream = await proxyFetch(request, resolveApiUrl('/files/direct'), {
    method: 'POST',
    body: formData,
  });

  return buildProxyResponse(upstream);
}
