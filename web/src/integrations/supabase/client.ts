// Supabase stub — app migrado para API própria (Fastify + Prisma)
import type { Database } from './types';

export const dynamicHeaders: Record<string, string> = {};

const resolved = Promise.resolve({ data: null, error: null });

// noopChain: Proxy sobre uma função → suporta tanto .prop como prop()
const noopFn = () => resolved;
const noopChain: any = new Proxy(noopFn, {
  get: (_t, prop) => {
    // Não interceptar propriedades de Promise para evitar confusão com await
    if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined;
    return noopChain;
  },
  apply: () => resolved,
});

export const supabase = {
  from: (_table: string) => noopChain,
  rpc: (_fn: string, _args?: unknown) => resolved,
  functions: {
    invoke: (_fn: string, _opts?: unknown) => resolved,
  },
  auth: {
    getSession: () => resolved,
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: () => resolved,
  },
  channel: (_name: string) => ({
    on: () => noopChain,
    subscribe: () => ({ unsubscribe: () => {} }),
    unsubscribe: () => resolved,
  }),
  removeChannel: () => resolved,
} as any;
