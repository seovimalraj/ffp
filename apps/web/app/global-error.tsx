'use client';

import Error from 'next/error';

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  console.error('Global error:', error);

  return (
    <html>
      <body>
        <Error statusCode={500} />
      </body>
    </html>
  );
}
