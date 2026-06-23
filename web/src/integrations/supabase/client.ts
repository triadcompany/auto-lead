// Supabase stub — app migrado para API própria (Fastify + Prisma)
// Mantido para compatibilidade com hooks ainda não migrados.
import type { Database } from './types';

export const dynamicHeaders: Record<string, string> = {};

const noop = () => Promise.resolve({ data: null, error: null });
const noopChain: any = new Proxy({}, {
  get: () => noopChain,
  apply: () => Promise.resolve({ data: null, error: null }),
});

export const supabase = {
  from: (_table: string) => noopChain,
  rpc: (_fn: string, _args?: unknown) => Promise.resolve({ data: null, error: null }),
  auth: {
    getSession: noop,
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: noop,
  },
  channel: (_name: string) => ({
    on: () => noopChain,
    subscribe: () => noopChain,
    unsubscribe: noop,
  }),
  removeChannel: noop,
} as any;
