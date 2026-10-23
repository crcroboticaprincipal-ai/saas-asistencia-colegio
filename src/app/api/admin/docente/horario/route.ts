import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin, resolveInstitucion } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const { searchParams } = new URL(request.url);
    const personal_id = searchParams.get('personal_id');
    const requestedInst = searchParams.get('institucion_id');

    if (!personal_id) return NextResponse.json({ error: 'personal_id requerido' }, { status: 400 });

    const instResult = resolveInstitucion(session, requestedInst);
    if (!instResult.ok) return instResult.response;
    const institucionId = instResult.institucionId;

    const sb = getSupabaseAdmin();

    let qPlantillas = sb
      .from('horarios_plantillas')
      .select('*, horarios_bloques(*)')
      .eq('personal_id', personal_id)
      .order('created_at');

    if (institucionId) qPlantillas = qPlantillas.eq('institucion_id', institucionId);

    const { data: plantillas, error: ePlant } = await qPlantillas;
    if (ePlant) throw new Error(ePlant.message);

    let qAsig = sb
      .from('profesores_asignaciones')
      .select('*, materia:materias(id, nombre, codigo)')
      .eq('personal_id', personal_id)
      .eq('activo', true)
      .order('hora_inicio');

    if (institucionId) qAsig = qAsig.eq('institucion_id', institucionId);

    const { data: asignaciones, error: eAsig } = await qAsig;
    if (eAsig) throw new Error(eAsig.message);

    let qMat = sb
      .from('materias')
      .select('id, nombre, codigo')
      .order('nombre');

    if (institucionId) qMat = qMat.eq('institucion_id', institucionId);

    const { data: materias, error: eMat } = await qMat;
    if (eMat) throw new Error(eMat.message);

    return NextResponse.json({ ok: true, plantillas: plantillas ?? [], asignaciones: asignaciones ?? [], materias: materias ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;

  try {
    const body = await request.json();
    const { personal_id, institucion_id, plantilla, bloques, asignaciones } = body;

    if (!personal_id) {
      return NextResponse.json({ error: 'personal_id es requerido' }, { status: 400 });
    }

    const instResult = resolveInstitucion(session, institucion_id);
    if (!instResult.ok) return instResult.response;
    const targetInstitucionId = instResult.institucionId;

    if (!targetInstitucionId) {
      return NextResponse.json({ error: 'Institución obligatoria' }, { status: 400 });
    }

    const sb = getSupabaseAdmin();

    if (plantilla && bloques?.length > 0) {
      await sb.from('horarios_plantillas').update({ activo: false }).eq('personal_id', personal_id).eq('institucion_id', targetInstitucionId);

      const { data: nuevaPlantilla, error: ePlant } = await sb
        .from('horarios_plantillas')
        .insert([
          {
            personal_id,
            institucion_id: targetInstitucionId,
            nombre: plantilla.nombre || 'Horario Principal',
            tipo: plantilla.tipo || 'fijo',
            activo: true,
            vigente_desde: new Date().toISOString().split('T')[0],
          },
        ])
        .select()
        .single();

      if (ePlant || !nuevaPlantilla) throw new Error(ePlant?.message || 'Error creando plantilla');

      const bloquesInsert = bloques.map((b: {
        dia_semana: number;
        hora_entrada_esperada: string;
        hora_salida_esperada: string;
        tolerancia_entrada_min?: number;
        tolerancia_salida_min?: number;
        descripcion?: string;
      }) => ({
        plantilla_id: nuevaPlantilla.id,
        dia_semana: b.dia_semana,
        hora_entrada_esperada: b.hora_entrada_esperada,
        hora_salida_esperada: b.hora_salida_esperada,
        tolerancia_entrada_min: b.tolerancia_entrada_min ?? 10,
        tolerancia_salida_min: b.tolerancia_salida_min ?? 15,
        descripcion: b.descripcion ?? null,
      }));

      const { error: eBloques } = await sb.from('horarios_bloques').insert(bloquesInsert);
      if (eBloques) throw new Error(eBloques.message);
    }

    if (asignaciones && Array.isArray(asignaciones)) {
      await sb.from('profesores_asignaciones').update({ activo: false }).eq('personal_id', personal_id).eq('institucion_id', targetInstitucionId);

      if (asignaciones.length > 0) {
        const asigInsert = asignaciones.map((a: {
          materia_id: string;
          grado: string;
          seccion: string;
          dia_semana?: number;
          hora_inicio: string;
          hora_fin: string;
          periodo_escolar?: string;
        }) => ({
          personal_id,
          institucion_id: targetInstitucionId,
          materia_id: a.materia_id,
          grado: a.grado,
          seccion: a.seccion,
          dia_semana: a.dia_semana ?? null,
          hora_inicio: a.hora_inicio,
          hora_fin: a.hora_fin,
          activo: true,
          periodo_escolar: a.periodo_escolar || '2026-2027',
        }));

        const { error: eAsig } = await sb.from('profesores_asignaciones').insert(asigInsert);
        if (eAsig) throw new Error(eAsig.message);
      }
    }

    return NextResponse.json({ ok: true, message: 'Configuración del docente guardada exitosamente' });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}
