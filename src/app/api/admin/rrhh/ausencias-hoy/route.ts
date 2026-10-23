import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const requestedInst = searchParams.get('institucion_id');

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    const todayStr = new Date().toISOString().split('T')[0];
    const jsDay = new Date().getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    let queryHorario = sb
      .from('horario_bloques')
      .select(`
        plantilla_id,
        dia_semana,
        horario_plantillas!inner (
          personal_id,
          activo,
          personal (
            id, nombres, apellidos, cargo, rol, institucion_id
          )
        )
      `)
      .eq('dia_semana', isoDay)
      .eq('horario_plantillas.activo', true);

    const { data: personalConHorario, error: horErr } = await queryHorario;

    if (horErr) {
      let qPersonal = sb.from('personal').select('id, nombres, apellidos, cargo, rol').eq('activo', true);
      if (institucionId) qPersonal = qPersonal.eq('institucion_id', institucionId);
      const { data: allPersonal } = await qPersonal;

      let qEsc = sb.from('asistencia_personal').select('personal_id').eq('fecha', todayStr).eq('tipo', 'ENTRADA');
      if (institucionId) qEsc = qEsc.eq('institucion_id', institucionId);
      const { data: escaneadosHoy } = await qEsc;

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

    interface PersonalInfo { id: string; nombres: string; apellidos: string; cargo: string | null; rol: string; institucion_id: string }
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
            if (!institucionId || pers.institucion_id === institucionId) {
              personalMap.set(pers.id, pers);
            }
          }
        });
      });
    });

    let qEsc = sb.from('asistencia_personal').select('personal_id').eq('fecha', todayStr).eq('tipo', 'ENTRADA');
    if (institucionId) qEsc = qEsc.eq('institucion_id', institucionId);
    const { data: escaneadosHoy } = await qEsc;

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
