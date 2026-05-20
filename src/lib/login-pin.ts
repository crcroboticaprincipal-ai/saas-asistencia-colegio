// ================================================================
// ASISTO — Sistema de Login Rápido (PIN)
// Convierte username + PIN en credenciales Supabase Auth válidas
// ================================================================

import type { LoginPinPayload } from '@/lib/supabase/types';

/**
 * Genera el correo interno a partir del username del empleado.
 * Ej: "profe_juan" + "crc" → "profe_juan@crc.asisto.local"
 */
export function generarEmailInterno(username: string, nombreCortoInstitucion: string): string {
  const slug = nombreCortoInstitucion.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${username.toLowerCase().trim()}@${slug}.asisto.local`;
}

/**
 * Valida que el PIN tenga entre 4 y 6 dígitos numéricos
 */
export function validarPin(pin: string): { valido: boolean; error?: string } {
  if (!/^\d{4,6}$/.test(pin)) {
    return { valido: false, error: 'El PIN debe contener entre 4 y 6 dígitos numéricos' };
  }
  return { valido: true };
}

/**
 * Resuelve las credenciales de Supabase Auth a partir de username + PIN.
 * Esta función se usa en el Route Handler de login para no exponer la lógica al cliente.
 */
export function resolverCredencialesLogin(payload: LoginPinPayload): {
  email: string;
  password: string;
} {
  const validacion = validarPin(payload.pin);
  if (!validacion.valido) {
    throw new Error(validacion.error);
  }

  return {
    email: generarEmailInterno(payload.username, payload.institucion_nombre_corto),
    password: payload.pin,
  };
}
