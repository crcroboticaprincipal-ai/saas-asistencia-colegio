import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/admin/docente/horario?personal_id=xxx
// Devuelve plantillas + bloques + asignaciones del docente
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const personal_id = searchParams.get('personal_id');
    if (!personal_id) return NextResponse.json({ error: 'personal_id requerido' }, { status: 400 });

    const sb = getAdmin();

    // Plantillas con sus bloques
    const { data: plantillas, error: ePlant } = await sb
      .from('horarios_plantillas')
      .select('*, horarios_bloques(*)')
      .eq('personal_id', personal_id)
      .order('created_at');
    if (ePlant) throw new Error(ePlant.message);

    // Asignaciones con materia
    const { data: asignaciones, error: eAsig } = await sb
      .from('profesores_asignaciones')
      .select('*, materia:materias(id, nombre, codigo)')
      .eq('personal_id', personal_id)
      .eq('activo', true)
      .order('hora_inicio');
    if (eAsig) throw new Error(eAsig.message);

    // Materias disponibles
    const { data: materias, error: eMat } = await sb
      .from('materias')
      .select('id, nombre, codigo')
      .order('nombre');
    if (eMat) throw new Error(eMat.message);

    return NextResponse.json({ ok: true, plantillas: plantillas ?? [], asignaciones: asignaciones ?? [], materias: materias ?? [] });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error interno' }, { status: 500 });
  }
}

// POST /api/admin/docente/horario
// Body: { personal_id, institucion_id, plantilla: { nombre, tipo, dias }, asignaciones: [...] }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personal_id, institucion_id, plantilla, bloques, asignaciones } = body;

    if (!personal_id || !institucion_id) {
      return NextResponse.json({ error: 'personal_id e institucion_id son requeridos' }, { status: 400 });
    }

    const sb = getAdmin();

    // ── 1. Crear / reemplazar plantilla ──
    if (plantilla && bloques?.length > 0) {
      // Desactivar plantillas anteriores
      await sb.from('horarios_plantillas').update({ activo: false }).eq('personal_id', personal_id);

      const { data: nuevaPlantilla, error: ePlant } = await sb
        .from('horarios_plantillas')
        .insert([{
          personal_id,
          institucion_id,
          nombre: plantilla.nombre || 'Horario Principal',
          tipo: plantilla.tipo || 'fijo',
          activo: true,
          vigente_desde: new Date().toISOString().split('T')[0],
        }])
        .select()
        .single();

      if (ePlant || !nuevaPlantilla) throw new Error(ePlant?.message || 'Error creando plantilla');

      // Insertar bloques
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

    // ── 2. Reemplazar asignaciones académicas ──
    if (asignaciones && Array.isArray(asignaciones)) {
      // Desactivar anteriores
      await sb.from('profesores_asignaciones').update({ activo: false }).eq('personal_id', personal_id);

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
          institucion_id,
          materia_id: a.materia_id,
          grado: a.grado,
          seccion: a.seccion,
          dia_semana: a.dia_semana ?? null,
          hora_inicio: a.hora_inicio,
          hora_fin: a.hora_fin,
          activo: true,
          periodo_escolar: a.periodo_escolar || '2025-2026',
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
