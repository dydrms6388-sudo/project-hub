"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "motion/react";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorker } from "./service-worker";

export function Providers({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <MotionConfig reducedMotion="user" nonce={nonce}>
        {children}
      </MotionConfig>
      <Toaster position="top-center" richColors closeButton />
      <ServiceWorker />
    </QueryClientProvider>
  );
}
