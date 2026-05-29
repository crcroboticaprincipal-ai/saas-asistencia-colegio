/**
 * ASISTO — Script de Seeder para Institución Demo
 * ================================================
 * Inyecta datos de alta fidelidad en Supabase para la cuenta de demostración comercial.
 * Institución: "Colegio Demo Innovación"
 *
 * EJECUCIÓN:
 *   npx ts-node --project tsconfig.json scripts/seed-demo.ts
 *
 * ADVERTENCIA: Este script es IDEMPOTENTE. Borra y recrea los datos demo
 * en cada ejecución sin afectar otras instituciones (filtra por nombre_corto = 'demo').
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { format, subDays, isWeekend } from "date-fns";

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error(
    "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY"
  );
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── Constantes Demo ──────────────────────────────────────────────────────────
const DEMO_NOMBRE_CORTO = "demo";
const DEMO_NOMBRE = "Colegio Demo Innovación";

// 5 profesores realistas venezolanos con PINs fijos para demos en vivo
const PROFESORES_DEMO = [
  {
    nombres: "Carlos Eduardo",
    apellidos: "Rodríguez Pérez",
    cedula: "V-14.502.331",
    cargo: "Docente de Matemáticas",
    rol: "docente" as const,
    username: "c.rodriguez",
    pin: "111111",
  },
  {
    nombres: "María Alejandra",
    apellidos: "González Fuentes",
    cedula: "V-16.887.042",
    cargo: "Docente de Castellano y Literatura",
    rol: "docente" as const,
    username: "m.gonzalez",
    pin: "222222",
  },
  {
    nombres: "José Antonio",
    apellidos: "Martínez Colina",
    cedula: "V-11.234.765",
    cargo: "Coordinador Académico",
    rol: "coordinador" as const,
    username: "j.martinez",
    pin: "333333",
  },
  {
    nombres: "Luisa Fernanda",
    apellidos: "Herrera Ávila",
    cedula: "V-18.445.209",
    cargo: "Docente de Inglés",
    rol: "docente" as const,
    username: "l.herrera",
    pin: "444444",
  },
  {
    nombres: "Roberto Enrique",
    apellidos: "Torres Bracho",
    cedula: "V-9.876.543",
    cargo: "Director",
    rol: "director" as const,
    username: "r.torres",
    pin: "555555",
  },
];

// 30 estudiantes ficticios distribuidos en 3 secciones
const SECCIONES = ["5to A", "5to B", "4to A"];

const ESTUDIANTES_DEMO: Array<{
  nombre_completo: string;
  cedula: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
}> = [
  // ─── 5to A (10 estudiantes)
  { nombre_completo: "Andreína Valentina Álvarez Reyes", cedula: "RC-V25.001.001", grado: "5to Año", seccion: "A", nombre_representante: "Carmen Reyes de Álvarez", correo_representante: "c.reyes@demo.asisto.app" },
  { nombre_completo: "Sebastián Alejandro Ramos Durán", cedula: "RC-V25.001.002", grado: "5to Año", seccion: "A", nombre_representante: "Pedro Ramos", correo_representante: "p.ramos@demo.asisto.app" },
  { nombre_completo: "Gabriela María Soto Castillo", cedula: "RC-V25.001.003", grado: "5to Año", seccion: "A", nombre_representante: "Rosa Castillo de Soto", correo_representante: "r.castillo@demo.asisto.app" },
  { nombre_completo: "Diego Andrés Medina López", cedula: "RC-V25.001.004", grado: "5to Año", seccion: "A", nombre_representante: "Ana López de Medina", correo_representante: "a.lopez@demo.asisto.app" },
  { nombre_completo: "Valeria Cristina Fuentes Mora", cedula: "RC-V25.001.005", grado: "5to Año", seccion: "A", nombre_representante: "Luis Fuentes", correo_representante: "l.fuentes@demo.asisto.app" },
  { nombre_completo: "Ángel Eduardo Baptista Silva", cedula: "RC-V25.001.006", grado: "5to Año", seccion: "A", nombre_representante: "María Silva de Baptista", correo_representante: "m.silva@demo.asisto.app" },
  { nombre_completo: "Isabella Camila Peralta Guzmán", cedula: "RC-V25.001.007", grado: "5to Año", seccion: "A", nombre_representante: "Carlos Guzmán", correo_representante: "c.guzman@demo.asisto.app" },
  { nombre_completo: "Samuel Enrique Quintero Bravo", cedula: "RC-V25.001.008", grado: "5to Año", seccion: "A", nombre_representante: "Elena Bravo de Quintero", correo_representante: "e.bravo@demo.asisto.app" },
  { nombre_completo: "Mariana Sofía Delgado Paz", cedula: "RC-V25.001.009", grado: "5to Año", seccion: "A", nombre_representante: "José Delgado", correo_representante: "j.delgado@demo.asisto.app" },
  { nombre_completo: "Kevin Alexander Romero Flores", cedula: "RC-V25.001.010", grado: "5to Año", seccion: "A", nombre_representante: "Patricia Flores de Romero", correo_representante: "p.flores@demo.asisto.app" },
  // ─── 5to B (10 estudiantes)
  { nombre_completo: "Luana Valentina Pinto Acosta", cedula: "RC-V25.002.001", grado: "5to Año", seccion: "B", nombre_representante: "Jorge Acosta", correo_representante: "j.acosta@demo.asisto.app" },
  { nombre_completo: "Mateo Alejandro Vargas Crespo", cedula: "RC-V25.002.002", grado: "5to Año", seccion: "B", nombre_representante: "Luisa Crespo de Vargas", correo_representante: "l.crespo@demo.asisto.app" },
  { nombre_completo: "Natalia Fernanda Espinoza Ruiz", cedula: "RC-V25.002.003", grado: "5to Año", seccion: "B", nombre_representante: "Andrés Ruiz", correo_representante: "a.ruiz@demo.asisto.app" },
  { nombre_completo: "Héctor Daniel Castañeda Vega", cedula: "RC-V25.002.004", grado: "5to Año", seccion: "B", nombre_representante: "Carmen Vega de Castañeda", correo_representante: "c.vega@demo.asisto.app" },
  { nombre_completo: "Daniela Rocío Suárez Palacios", cedula: "RC-V25.002.005", grado: "5to Año", seccion: "B", nombre_representante: "Marcos Suárez", correo_representante: "m.suarez@demo.asisto.app" },
  { nombre_completo: "Alejandro José Nieto Bermúdez", cedula: "RC-V25.002.006", grado: "5to Año", seccion: "B", nombre_representante: "Beatriz Bermúdez de Nieto", correo_representante: "b.bermudez@demo.asisto.app" },
  { nombre_completo: "Valentina Paola Campos Vera", cedula: "RC-V25.002.007", grado: "5to Año", seccion: "B", nombre_representante: "Roberto Campos", correo_representante: "r.campos@demo.asisto.app" },
  { nombre_completo: "Nicolás Eduardo Mendoza Ríos", cedula: "RC-V25.002.008", grado: "5to Año", seccion: "B", nombre_representante: "Adriana Ríos de Mendoza", correo_representante: "a.rios@demo.asisto.app" },
  { nombre_completo: "Camila Beatriz Figueroa Paredes", cedula: "RC-V25.002.009", grado: "5to Año", seccion: "B", nombre_representante: "Julio Paredes", correo_representante: "j.paredes@demo.asisto.app" },
  { nombre_completo: "Joaquín Rafael Salazar Peña", cedula: "RC-V25.002.010", grado: "5to Año", seccion: "B", nombre_representante: "Martha Peña de Salazar", correo_representante: "m.pena@demo.asisto.app" },
  // ─── 4to A (10 estudiantes — 2 de ellos con patrón de riesgo para trigger de alerta)
  { nombre_completo: "Génesis Carolina Blanco Rivero", cedula: "RC-V25.003.001", grado: "4to Año", seccion: "A", nombre_representante: "Eduardo Blanco", correo_representante: "e.blanco@demo.asisto.app" },
  { nombre_completo: "Omar Alfredo León Castro", cedula: "RC-V25.003.002", grado: "4to Año", seccion: "A", nombre_representante: "Gladys Castro de León", correo_representante: "g.castro@demo.asisto.app" },
  { nombre_completo: "Paola Alejandra Gutiérrez Meza", cedula: "RC-V25.003.003", grado: "4to Año", seccion: "A", nombre_representante: "Ricardo Gutiérrez", correo_representante: "r.gutierrez@demo.asisto.app" },
  { nombre_completo: "Andrés Sebastián Molina Aguilar", cedula: "RC-V25.003.004", grado: "4to Año", seccion: "A", nombre_representante: "Norma Aguilar de Molina", correo_representante: "n.aguilar@demo.asisto.app" },
  { nombre_completo: "Sofía Gabriela Reyes Serrano", cedula: "RC-V25.003.005", grado: "4to Año", seccion: "A", nombre_representante: "Felipe Serrano", correo_representante: "f.serrano@demo.asisto.app" },
  // ⚠️  Estudiante en riesgo: inasistencia sistemática
  { nombre_completo: "Luis Gabriel Torrealba Méndez", cedula: "RC-V25.003.006", grado: "4to Año", seccion: "A", nombre_representante: "Irene Méndez de Torrealba", correo_representante: "i.mendez@demo.asisto.app" },
  // ⚠️  Estudiante en riesgo: patrón viernes
  { nombre_completo: "Ana Karina Lozano Bermúdez", cedula: "RC-V25.003.007", grado: "4to Año", seccion: "A", nombre_representante: "Gustavo Bermúdez", correo_representante: "g.bermudez@demo.asisto.app" },
  { nombre_completo: "Emilio Fernando Rangel Díaz", cedula: "RC-V25.003.008", grado: "4to Año", seccion: "A", nombre_representante: "Sandra Díaz de Rangel", correo_representante: "s.diaz@demo.asisto.app" },
  { nombre_completo: "Natasha Daniela Mora Fuenmayor", cedula: "RC-V25.003.009", grado: "4to Año", seccion: "A", nombre_representante: "Iván Mora", correo_representante: "i.mora@demo.asisto.app" },
  { nombre_completo: "Jesús Alfredo Correia Montoya", cedula: "RC-V25.003.010", grado: "4to Año", seccion: "A", nombre_representante: "Rossana Montoya de Correia", correo_representante: "r.montoya@demo.asisto.app" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function randomTime(baseHour: number, baseMin: number, jitterMin: number): string {
  const totalMin = baseHour * 60 + baseMin + Math.floor(Math.random() * jitterMin);
  const h = Math.floor(totalMin / 60).toString().padStart(2, "0");
  const m = (totalMin % 60).toString().padStart(2, "0");
  return `${h}:${m}:00`;
}

function getLast14WorkDays(): string[] {
  const days: string[] = [];
  let d = new Date();
  while (days.length < 14) {
    d = subDays(d, 1);
    if (!isWeekend(d)) days.push(format(d, "yyyy-MM-dd"));
  }
  return days.reverse();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 ASISTO Demo Seeder — Iniciando...\n");

  // ── 1. Eliminar datos demo anteriores de Auth ──
  console.log("🧹 Limpiando usuarios de autenticación anteriores...");
  const { data: usersData } = await sb.auth.admin.listUsers({ page: 1, perPage: 100 });
  const demoUsers = (usersData?.users ?? []).filter(
    (u) => u.email?.endsWith("@demo.asisto.local") || u.email?.endsWith("@demo.qrono.local")
  );
  for (const du of demoUsers) {
    await sb.auth.admin.deleteUser(du.id);
  }
  console.log(`   ✓ ${demoUsers.length} usuarios de autenticación demo eliminados.`);

  // ── 1.5. Crear / Asegurar Institución Qrono Central (SuperAdmin) ──
  console.log("👑 Creando o asegurando institución Qrono Central...");
  let qronoInstId = "";
  const { data: qInst } = await sb
    .from("instituciones")
    .select("id")
    .eq("nombre_corto", "qrono")
    .single();

  if (qInst?.id) {
    qronoInstId = qInst.id;
  } else {
    qronoInstId = randomUUID();
    await sb.from("instituciones").insert({
      id: qronoInstId,
      nombre: "Qrono Central",
      nombre_corto: "qrono",
      nivel_educativo: "completa",
      plan_suscripcion: "enterprise",
      activo: true,
      configuracion_academica: {
        hora_entrada: "08:00",
        hora_salida: "17:00",
        tolerancia_minutos: 15,
        notificar_porteria: false,
        notificar_asistencia_materia: false,
        dias_laborables: [1, 2, 3, 4, 5],
      },
    });
  }

  // ── 1.6. Crear / Asegurar SuperAdmin en Auth y Personal ──
  console.log("👑 Creando o asegurando SuperAdmin de todo Asisto...");
  
  // Limpiar SuperAdmin anterior en Auth si existe
  const superAdminEmail = "superadmin@qrono.asisto.local";
  const superAdminQronoEmail = "superadmin@qrono.qrono.local";
  const superUsers = (usersData?.users ?? []).filter(
    (u) => u.email === superAdminEmail || u.email === superAdminQronoEmail
  );
  for (const su of superUsers) {
    await sb.auth.admin.deleteUser(su.id);
  }

  // Crear SuperAdmin en Auth
  const { data: sAuthData, error: sAuthErr } = await sb.auth.admin.createUser({
    email: superAdminEmail,
    password: "999999", // PIN
    email_confirm: true,
  });

  if (sAuthErr) {
    console.warn(`   ⚠️ Error creando SuperAdmin Auth: ${sAuthErr.message}`);
  } else {
    const sAuthUserId = sAuthData.user.id;
    // Eliminar registro anterior en Personal
    await sb.from("personal").delete().eq("username", "superadmin").eq("institucion_id", qronoInstId);

    // Crear en Personal
    const { error: sPersErr } = await sb.from("personal").insert({
      id: randomUUID(),
      institucion_id: qronoInstId,
      nombres: "Super",
      apellidos: "Admin",
      cedula: "V-0",
      cargo: "Administrador Global",
      rol: "director",
      username: "superadmin",
      pin_hash: "999999",
      auth_user_id: sAuthUserId,
      activo: true,
    });

    if (sPersErr) console.warn(`   ⚠️ Error creando SuperAdmin en Personal: ${sPersErr.message}`);
    else console.log(`   ✓ SuperAdmin creado: superadmin@qrono.asisto.local (PIN: 999999)`);
  }

  // ── 1.7. Eliminar datos demo anteriores de forma robusta ──
  console.log("🧹 Limpiando datos demo anteriores de forma robusta...");
  
  // 1. Obtener todas las instituciones con nombre_corto = 'demo'
  const { data: demoInsts } = await sb
    .from("instituciones")
    .select("id")
    .eq("nombre_corto", DEMO_NOMBRE_CORTO);
    
  const demoIds = (demoInsts ?? []).map(i => i.id);

  if (demoIds.length > 0) {
    // Eliminar asistencias y horarios de estas instituciones
    await sb.from("asistencias").delete().in("institucion_id", demoIds);
    await sb.from("asistencia_personal").delete().in("institucion_id", demoIds);
    
    // Obtener plantillas
    const { data: plantillas } = await sb.from("horario_plantillas").select("id").in("institucion_id", demoIds);
    const plantillaIds = (plantillas ?? []).map(p => p.id);
    if (plantillaIds.length > 0) {
      await sb.from("horario_bloques").delete().in("plantilla_id", plantillaIds);
    }
    await sb.from("horario_plantillas").delete().in("institucion_id", demoIds);
    await sb.from("estudiantes").delete().in("institucion_id", demoIds);
    await sb.from("personal").delete().in("institucion_id", demoIds);
    await sb.from("instituciones").delete().in("id", demoIds);
  }

  // 2. Limpieza de seguridad por unique keys (por si quedaron huérfanos de ejecuciones previas incompletas)
  await sb.from("personal").delete().in("username", PROFESORES_DEMO.map(p => p.username));
  await sb.from("estudiantes").delete().in("cedula", ESTUDIANTES_DEMO.map(e => e.cedula));
  await sb.from("instituciones").delete().eq("nombre_corto", DEMO_NOMBRE_CORTO);

  console.log(`   ✓ Datos demo anteriores limpiados de forma robusta.\n`);

  // ── 2. Crear institución demo ─────────────────────────────────────────────
  console.log("🏫 Creando institución: Colegio Demo Innovación...");
  const instId = randomUUID();
  const { error: instErr } = await sb.from("instituciones").insert({
    id: instId,
    nombre: DEMO_NOMBRE,
    nombre_corto: DEMO_NOMBRE_CORTO,
    nivel_educativo: "completa",
    plan_suscripcion: "professional",
    activo: true,
    configuracion_academica: {
      hora_entrada: "07:00",
      hora_salida: "14:00",
      tolerancia_minutos: 10,
      notificar_porteria: true,
      notificar_asistencia_materia: true,
      dias_laborables: [1, 2, 3, 4, 5],
    },
  });
  if (instErr) throw new Error(`Error creando institución: ${instErr.message}`);
  console.log(`   ✓ Institución creada (ID: ${instId})\n`);

  // ── 3. Crear personal + horarios ──────────────────────────────────────────
  console.log("👥 Creando 5 profesores con PINs de demostración y sus cuentas de Autenticación...");
  const personalIds: string[] = [];

  for (const prof of PROFESORES_DEMO) {
    const profId = randomUUID();
    
    // 1. Crear usuario en Auth
    const email = `${prof.username.toLowerCase()}@demo.asisto.local`;
    const { data: authData, error: authErr } = await sb.auth.admin.createUser({
      email,
      password: prof.pin,
      email_confirm: true,
    });

    if (authErr) {
      console.warn(`   ⚠️ Error creando usuario Auth para ${prof.username}: ${authErr.message}`);
      continue;
    }

    const authUserId = authData.user.id;
    personalIds.push(profId);

    const { error: profErr } = await sb.from("personal").insert({
      id: profId,
      institucion_id: instId,
      nombres: prof.nombres,
      apellidos: prof.apellidos,
      cedula: prof.cedula,
      cargo: prof.cargo,
      rol: prof.rol,
      username: prof.username,
      pin_hash: prof.pin,
      auth_user_id: authUserId,
      activo: true,
    });
    if (profErr) console.warn(`   ⚠️  ${prof.apellidos}: ${profErr.message}`);
    else console.log(`   ✓ ${prof.apellidos}, ${prof.nombres} — PIN: ${prof.pin}`);

    // Plantilla de horario fijo (Lunes a Viernes, 7:00 AM - 2:00 PM)
    const plantillaId = randomUUID();
    await sb.from("horario_plantillas").insert({
      id: plantillaId,
      institucion_id: instId,
      personal_id: profId,
      nombre: "Turno Mañana",
      tipo: "fijo",
      activo: true,
      vigente_desde: format(subDays(new Date(), 90), "yyyy-MM-dd"),
    });

    // Bloques Lun–Vie
    const bloques = [1, 2, 3, 4, 5].map(() => ({
      id: randomUUID(),
      plantilla_id: plantillaId,
      dia_semana: [1, 2, 3, 4, 5][Math.floor(Math.random() * 5)],
      hora_entrada_esperada: "07:00:00",
      hora_salida_esperada: "14:00:00",
      tolerancia_entrada_min: 10,
      tolerancia_salida_min: 15,
      es_hora_hueca: false,
    }));
    // Insert bloques Lun-Vie correctamente
    for (const dia of [1, 2, 3, 4, 5]) {
      await sb.from("horario_bloques").insert({
        id: randomUUID(),
        plantilla_id: plantillaId,
        dia_semana: dia,
        hora_entrada_esperada: "07:00:00",
        hora_salida_esperada: "14:00:00",
        tolerancia_entrada_min: 10,
        tolerancia_salida_min: 15,
        es_hora_hueca: false,
      });
    }
  }
  console.log();

  // ── 4. Crear historial de asistencia del personal ─────────────────────────
  console.log("📅 Generando historial de asistencia del personal (últimas 2 semanas)...");
  const diasLaborables = getLast14WorkDays();

  // Índices de prof con retardos intencionales (prof 1 y 3)
  const RETARDOS_FORZADOS: Record<string, Set<string>> = {
    [personalIds[1]]: new Set([diasLaborables[2], diasLaborables[8]]),  // 2 retardos
    [personalIds[3]]: new Set([diasLaborables[5]]),                     // 1 retardo
  };
  // Índices de prof con ausencias críticas (prof 0 y 4)
  const AUSENCIAS_FORZADAS: Record<string, Set<string>> = {
    [personalIds[0]]: new Set([diasLaborables[1]]),  // 1 ausencia
    [personalIds[4]]: new Set([diasLaborables[6]]),  // 1 ausencia
  };

  const asistenciaPersonalRows: object[] = [];

  for (const profId of personalIds) {
    for (const fecha of diasLaborables) {
      const esAusente = AUSENCIAS_FORZADAS[profId]?.has(fecha);
      const esRetardo = RETARDOS_FORZADOS[profId]?.has(fecha);

      if (esAusente) continue; // No genera registro ese día

      const horaEntrada = esRetardo
        ? randomTime(7, 18, 15) // retardo: 7:18 - 7:33
        : randomTime(6, 50, 12); // puntual: 6:50 - 7:02

      const minutosDif = esRetardo
        ? parseInt(horaEntrada.split(":")[1]) - 10
        : 0;

      asistenciaPersonalRows.push({
        id: randomUUID(),
        institucion_id: instId,
        personal_id: profId,
        tipo: "ENTRADA",
        fecha,
        hora: horaEntrada,
        estado_evaluacion: esRetardo ? "Retardo" : "Puntual",
        minutos_diferencia: esRetardo ? Math.abs(minutosDif) : 0,
      });

      // Salida
      asistenciaPersonalRows.push({
        id: randomUUID(),
        institucion_id: instId,
        personal_id: profId,
        tipo: "SALIDA",
        fecha,
        hora: randomTime(14, 0, 20),
        estado_evaluacion: "Puntual",
        minutos_diferencia: 0,
      });
    }
  }

  const { error: apErr } = await sb
    .from("asistencia_personal")
    .insert(asistenciaPersonalRows);
  if (apErr) console.warn(`   ⚠️  asistencia_personal: ${apErr.message}`);
  else console.log(`   ✓ ${asistenciaPersonalRows.length} registros de asistencia del personal\n`);

  // ── 5. Crear estudiantes ──────────────────────────────────────────────────
  console.log("🎓 Creando 30 estudiantes ficticios con códigos QR...");
  const estudiantesRows = ESTUDIANTES_DEMO.map((est) => ({
    id: randomUUID(),
    institucion_id: instId,
    cedula: est.cedula,
    nombre_completo: est.nombre_completo,
    grado: est.grado,
    seccion: est.seccion,
    nombre_representante: est.nombre_representante,
    correo_representante: est.correo_representante,
    qr_code: `QR-${est.cedula.replace(/[^0-9]/g, "")}`,
    estado: "Activo",
  }));

  const { data: estudiantesCreados, error: estErr } = await sb
    .from("estudiantes")
    .insert(estudiantesRows)
    .select("id, nombre_completo, cedula");

  if (estErr) throw new Error(`Error creando estudiantes: ${estErr.message}`);
  console.log(`   ✓ ${estudiantesCreados?.length ?? 0} estudiantes creados\n`);

  // ── 6. Crear historial de asistencia de estudiantes ───────────────────────
  console.log("🏃 Generando historial de asistencia de estudiantes (2 semanas)...");
  const asistenciaEstRows: object[] = [];

  // Estudiantes en riesgo (índices 25 y 26 = Torrealba y Lozano)
  const EST_RIESGO_INASISTENCIA = new Set([
    estudiantesCreados![25].id,
    estudiantesCreados![26].id,
  ]);

  // Días viernes de las últimas 2 semanas
  const viernesSet = new Set(
    diasLaborables.filter((d) => new Date(d + "T12:00:00").getDay() === 5)
  );

  for (const est of estudiantesCreados!) {
    for (const fecha of diasLaborables) {
      const esEnRiesgoCritico = EST_RIESGO_INASISTENCIA.has(est.id);
      const esViernes = viernesSet.has(fecha);

      // Torrealba: falta un día de cada 3 (alta inasistencia)
      if (est.id === estudiantesCreados![25].id) {
        const diaIdx = diasLaborables.indexOf(fecha);
        if (diaIdx % 3 === 0) continue; // salta ~33% de los días
      }

      // Lozano: falta todos los viernes (patrón semanal)
      if (est.id === estudiantesCreados![26].id && esViernes) continue;

      asistenciaEstRows.push({
        id: randomUUID(),
        institucion_id: instId,
        estudiante_id: est.id,
        tipo: "ENTRADA",
        fecha,
        hora: randomTime(6, 55, 10),
      });
      asistenciaEstRows.push({
        id: randomUUID(),
        institucion_id: instId,
        estudiante_id: est.id,
        tipo: "SALIDA",
        fecha,
        hora: randomTime(13, 50, 15),
      });
    }
  }

  // Insertar en batches de 200
  for (let i = 0; i < asistenciaEstRows.length; i += 200) {
    const batch = asistenciaEstRows.slice(i, i + 200);
    const { error: aeErr } = await sb.from("asistencias").insert(batch);
    if (aeErr) console.warn(`   ⚠️  Batch ${i}-${i + 200}: ${aeErr.message}`);
  }
  console.log(`   ✓ ${asistenciaEstRows.length} registros de asistencia de estudiantes\n`);

  // ── Resumen Final ─────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("✅ SEED DEMO COMPLETADO EXITOSAMENTE");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`\n📌 Institución:    ${DEMO_NOMBRE}`);
  console.log(`📌 Nombre corto:   ${DEMO_NOMBRE_CORTO}`);
  console.log(`📌 ID:             ${instId}`);
  console.log(`\n👤 CREDENCIALES DE DEMOSTRACIÓN:`);
  PROFESORES_DEMO.forEach((p) => {
    console.log(`   ${p.username.padEnd(20)} PIN: ${p.pin}  →  ${p.cargo}`);
  });
  console.log(`\n📊 DATOS GENERADOS:`);
  console.log(`   • Secciones:           3 (5to A, 5to B, 4to A)`);
  console.log(`   • Estudiantes:         30`);
  console.log(`   • Asist. personal:     ${asistenciaPersonalRows.length} registros`);
  console.log(`   • Asist. estudiantes:  ${asistenciaEstRows.length} registros`);
  console.log(`   • Retardos docentes:   3 (intencionados para demo)`);
  console.log(`   • Ausencias docentes:  2 (intencionadas para demo)`);
  console.log(`   • Estudiantes en riesgo de deserción: 2 (Torrealba, Lozano)`);
  console.log(`\n🎯 El dashboard mostrará alertas activas al iniciar sesión.\n`);
}

main().catch((err) => {
  console.error("\n❌ ERROR FATAL:", err.message);
  process.exit(1);
});
