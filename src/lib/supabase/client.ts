import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Variables de entorno no configuradas. Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local');
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;

  const client = createSupabaseClient();
  if (!client) {
    // Return a no-op stub that won't crash when methods are called
    // This is safe for dev/build time when no env vars are set
    return createNoopClient();
  }

  supabaseInstance = client;
  return supabaseInstance;
}

/**
 * Creates a no-op supabase client that returns empty data for all operations.
 * This prevents crashes when env vars are not set.
 */
function createNoopClient(): SupabaseClient {
  const noopQueryBuilder: any = new Proxy({}, {
    get() {
      // Every method on the query builder returns itself (chaining) 
      // except terminal methods that return a promise with empty data
      return (..._args: any[]) => {
        return new Proxy({}, {
          get(_t, innerProp) {
            if (innerProp === 'then') {
              // Make it thenable — resolve with empty result
              return (resolve: any) => resolve({ data: [], error: null, count: 0 });
            }
            // For chained methods like .select().eq().order() etc
            return (..._innerArgs: any[]) => noopQueryBuilder;
          }
        });
      };
    }
  });

  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      if (prop === 'from') return () => noopQueryBuilder;
      if (prop === 'channel') return () => ({
        on: () => ({ subscribe: () => ({}) }),
        subscribe: () => ({}),
      });
      if (prop === 'removeChannel') return () => {};
      // Default: return a no-op function
      return () => {};
    }
  });
}

// Lazy proxy: only initializes when a property is actually accessed at runtime
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});
