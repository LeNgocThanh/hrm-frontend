'use client';

import { PropsWithChildren, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// (tùy chọn) Devtools:
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

export default function QueryProvider({ children }: PropsWithChildren) {
  // tạo 1 client duy nhất trên client để tránh re-create
  const [client] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={client}>
      {children}
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}
    </QueryClientProvider>
  );
}