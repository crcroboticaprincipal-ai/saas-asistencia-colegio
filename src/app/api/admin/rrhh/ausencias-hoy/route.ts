import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const sb = getAdmin();
    const todayStr = new Date().toISOString().split('T')[0];
    // Day of week: 0=Sun, 1=Mon...6=Sat  → match horario_bloques.dia_semana (1=Lun...7=Dom in some DBs)
    const jsDay = new Date().getDay(); // 0=Sun...
    // Convert to ISO weekday (1=Mon...7=Sun)
    const isoDay = jsDay === 0 ? 7 : jsDay;

    // Get all personal who have an active horario bloque scheduled for today
    const { data: personalConHorario, error: horErr } = await sb
      .from('horario_bloques')
      .select(`
        plantilla_id,
        dia_semana,
        horario_plantillas!inner (
          personal_id,
          activo,
          personal (
            id, nombres, apellidos, cargo, rol
          )
        )
      `)
      .eq('dia_semana', isoDay)
      .eq('horario_plantillas.activo', true);

    if (horErr) {
      // Fallback: return all active personal if horario table fails
      const { data: allPersonal } = await sb
        .from('personal')
        .select('id, nombres, apellidos, cargo, rol')
        .eq('activo', true);

      // Get who scanned today
      const { data: escaneadosHoy } = await sb
        .from('asistencia_personal')
        .select('personal_id')
        .eq('fecha', todayStr)
        .eq('tipo', 'ENTRADA');

      const escaneadosSet = new Set((escaneadosHoy ?? []).map((e: { personal_id: string }) => e.personal_id));
      const ausentes = (allPersonal ?? []).filter((p: { id: string }) => !escaneadosSet.has(p.id));

      return NextResponse.json({
        ok: true,
        total_con_horario: allPersonal?.length ?? 0,
        total_escaneados: escaneadosSet.size,
        ausentes_count: ausentes.length,
        ausentes: ausentes.slice(0, 20),
        fecha: todayStr,
        fallback: true,
      });
    }

    // Deduplicate personal who have horario today
    // Note: Supabase infers joined relations as arrays even with !inner — we cast explicitly
    interface PersonalInfo { id: string; nombres: string; apellidos: string; cargo: string | null; rol: string }
    interface RawBloque {
      plantilla_id: unknown;
      dia_semana: unknown;
      horario_plantillas: Array<{
        personal_id: string;
        activo: boolean;
        personal: PersonalInfo[];
      }>;
    }
    const personalMap = new Map<string, PersonalInfo>();
    ((personalConHorario ?? []) as unknown as RawBloque[]).forEach((b) => {
      const plantillas = Array.isArray(b.horario_plantillas) ? b.horario_plantillas : [b.horario_plantillas];
      plantillas.forEach((pt) => {
        if (!pt) return;
        const persArr = Array.isArray(pt.personal) ? pt.personal : [pt.personal];
        persArr.forEach((pers) => {
          if (pers && !personalMap.has(pers.id)) {
            personalMap.set(pers.id, pers);
          }
        });
      });
    });

    // Get who already scanned today
    const { data: escaneadosHoy } = await sb
      .from('asistencia_personal')
      .select('personal_id')
      .eq('fecha', todayStr)
      .eq('tipo', 'ENTRADA');

    const escaneadosSet = new Set((escaneadosHoy ?? []).map((e: { personal_id: string }) => e.personal_id));

    const personalConHorarioArr = Array.from(personalMap.values());
    const ausentes = personalConHorarioArr.filter((p) => !escaneadosSet.has(p.id));

    return NextResponse.json({
      ok: true,
      total_con_horario: personalConHorarioArr.length,
      total_escaneados: escaneadosSet.size,
      ausentes_count: ausentes.length,
      ausentes: ausentes.slice(0, 20),
      fecha: todayStr,
    });
  } catch (err: unknown) {
    console.error('[ausencias-hoy]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
