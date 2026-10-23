import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';
import { sanitizeSearch } from '@/lib/validation';

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const { empleados, institucion_id } = await req.json();

    if (!Array.isArray(empleados) || !empleados.length) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId;

    if (!targetInstitucionId) {
      return NextResponse.json({ error: 'Institución obligatoria' }, { status: 400 });
    }

    const resultados: {
      fila: number;
      nombre: string;
      estado: 'creado' | 'duplicado' | 'error';
      username?: string;
      mensaje?: string;
    }[] = [];

    for (let i = 0; i < empleados.length; i++) {
      const emp = empleados[i];
      const fila = i + 2;

      const nombres = sanitizeSearch(emp.nombres ?? '');
      const apellidos = sanitizeSearch(emp.apellidos ?? '');

      if (!nombres || !apellidos) {
        resultados.push({ fila, nombre: `Fila ${fila}`, estado: 'error', mensaje: 'Nombres y apellidos son obligatorios' });
        continue;
      }

      const rawUsername = (emp.username ?? `${nombres[0]}${apellidos.split(' ')[0]}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
      const username = rawUsername || `emp${fila}`;

      try {
        const { data: existing } = await sb
          .from('personal')
          .select('id, username')
          .eq('institucion_id', targetInstitucionId)
          .or(`username.eq.${username},cedula.eq.${emp.cedula ?? ''}`)
          .maybeSingle();

        if (existing) {
          resultados.push({ fila, nombre: `${nombres} ${apellidos}`, estado: 'duplicado', username: existing.username ?? username, mensaje: 'Ya existe un empleado con ese username o cédula' });
          continue;
        }

        const { error: personalError } = await sb
          .from('personal')
          .insert([
            {
              institucion_id: targetInstitucionId,
              nombres,
              apellidos,
              cedula: emp.cedula ? String(emp.cedula).trim() : null,
              correo: emp.correo ? String(emp.correo).trim().toLowerCase() : null,
              telefono: emp.telefono ? String(emp.telefono).trim() : null,
              cargo: emp.cargo ? String(emp.cargo).trim() : null,
              rol: emp.rol ? String(emp.rol).toLowerCase().trim() : 'docente',
              username,
              activo: true,
            },
          ]);

        if (personalError) throw new Error(personalError.message);

        resultados.push({ fila, nombre: `${nombres} ${apellidos}`, estado: 'creado', username });
      } catch (err: unknown) {
        resultados.push({ fila, nombre: `${nombres} ${apellidos}`, estado: 'error', mensaje: err instanceof Error ? err.message : 'Error interno' });
      }
    }

    const creados = resultados.filter((r) => r.estado === 'creado').length;
    const errores = resultados.filter((r) => r.estado === 'error').length;
    const duplicados = resultados.filter((r) => r.estado === 'duplicado').length;

    return NextResponse.json({ ok: true, creados, errores, duplicados, resultados });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
