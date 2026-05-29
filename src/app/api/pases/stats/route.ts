import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuración incompleta' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'dia';
    const institucion_id = searchParams.get('institucion_id');

    // Calcular fechas
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }));
    const hoy = now.toISOString().split('T')[0];

    let fechaDesde = hoy;
    if (period === 'semana') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Lunes
      fechaDesde = startOfWeek.toISOString().split('T')[0];
    } else if (period === 'mes') {
      fechaDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }

    // Query base
    let query = supabaseAdmin
      .from('pases')
      .select(`
        id,
        tipo_pase,
        motivo,
        fecha,
        hora_pase,
        estudiante_id,
        estudiantes (nombre_completo, grado, seccion, foto_url)
      `)
      .gte('fecha', fechaDesde)
      .lte('fecha', hoy)
      .order('created_at', { ascending: false });

    if (institucion_id) {
      query = query.eq('institucion_id', institucion_id);
    }

    const { data: pases, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Error al obtener pases' }, { status: 500 });
    }

    const total = pases?.length || 0;

    // Agrupar pases por tipo
    const porTipo = {
      ENTRADA: pases?.filter(p => p.tipo_pase === 'ENTRADA').length || 0,
      SALIDA: pases?.filter(p => p.tipo_pase === 'SALIDA').length || 0,
      ESPECIAL: pases?.filter(p => p.tipo_pase === 'ESPECIAL').length || 0,
    };

    // Ranking de alumnos con más pases en el MES
    const mesDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    let queryMes = supabaseAdmin
      .from('pases')
      .select(`
        estudiante_id,
        estudiantes (nombre_completo, grado, seccion, foto_url)
      `)
      .gte('fecha', mesDesde)
      .lte('fecha', hoy);

    if (institucion_id) {
      queryMes = queryMes.eq('institucion_id', institucion_id);
    }

    const { data: pasesMes } = await queryMes;

    // Contar por estudiante
    const conteoEstudiante: Record<string, {
      nombre: string;
      grado: string;
      seccion: string;
      foto_url: string | null;
      total: number;
      alerta: boolean;
    }> = {};

    for (const p of (pasesMes || [])) {
      const id = p.estudiante_id;
      const est = p.estudiantes as any;
      if (!conteoEstudiante[id]) {
        conteoEstudiante[id] = {
          nombre: est?.nombre_completo || 'Desconocido',
          grado: est?.grado || '',
          seccion: est?.seccion || '',
          foto_url: est?.foto_url || null,
          total: 0,
          alerta: false,
        };
      }
      conteoEstudiante[id].total++;
    }

    // Marcar alerta si > 3 pases en el mes
    const ranking = Object.entries(conteoEstudiante)
      .map(([estudiante_id, data]) => ({
        estudiante_id,
        ...data,
        alerta: data.total >= 3,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    return NextResponse.json({
      period,
      total,
      porTipo,
      pases: pases || [],
      ranking_mes: ranking,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
