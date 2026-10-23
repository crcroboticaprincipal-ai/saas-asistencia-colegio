import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AdminClient = SupabaseClient<any, any, any>;

let cached: AdminClient | null = null;

/**
 * Cliente Supabase con service_role (salta RLS). SOLO para código de servidor.
 * Única fuente de verdad: reemplaza las ~25 copias de getAdmin()/getSupabaseAdmin() y el
 * antiguo fallback que leía `.env.local` del disco o caía silenciosamente a la anon key.
 *
 * IMPORTANTE: como salta RLS, toda ruta que lo use DEBE validar sesión con `requireSession`
 * y filtrar por `institucion_id` de la sesión.
 */
export function getSupabaseAdmin(): AdminClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Configuración de servidor incompleta (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}
