import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generarEmailInterno } from '@/lib/login-pin';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// POST /api/admin/rrhh/importar-masivo
// Body: { empleados: EmpleadoImport[], institucion_id: string, institucion_nombre_corto: string }
export async function POST(req: NextRequest) {
  try {
    const sb = getAdmin();
    const { empleados, institucion_id, institucion_nombre_corto } = await req.json();

    if (!Array.isArray(empleados) || !empleados.length || !institucion_id) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
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
      const fila = i + 2; // Excel row (1=header)

      const nombres = (emp.nombres ?? '').trim();
      const apellidos = (emp.apellidos ?? '').trim();

      if (!nombres || !apellidos) {
        resultados.push({ fila, nombre: `Fila ${fila}`, estado: 'error', mensaje: 'Nombres y apellidos son obligatorios' });
        continue;
      }

      // Auto-generate username if not provided: first letter of nombre + apellido (slugified)
      const rawUsername = (emp.username ?? `${nombres[0]}${apellidos.split(' ')[0]}`).toLowerCase().replace(/[^a-z0-9_]/g, '');
      const username = rawUsername || `emp${fila}`;

      try {
        // Check for existing personal with same cedula or username
        const { data: existing } = await sb
          .from('personal')
          .select('id, username')
          .eq('institucion_id', institucion_id)
          .or(`username.eq.${username},cedula.eq.${emp.cedula ?? ''}`)
          .maybeSingle();

        if (existing) {
          resultados.push({ fila, nombre: `${nombres} ${apellidos}`, estado: 'duplicado', username: existing.username ?? username, mensaje: 'Ya existe un empleado con ese username o cédula' });
          continue;
        }

        // Insert into personal (no auth yet — PIN will be set later)
        const { data: personalData, error: personalError } = await sb
          .from('personal')
          .insert([{
            institucion_id,
            nombres,
            apellidos,
            cedula: emp.cedula?.toString().trim() || null,
            correo: emp.correo?.trim() || null,
            telefono: emp.telefono?.toString().trim() || null,
            cargo: emp.cargo?.trim() || null,
            rol: emp.rol?.toLowerCase().trim() || 'docente',
            username,
            activo: true,
          }])
          .select('id, username')
          .single();

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
