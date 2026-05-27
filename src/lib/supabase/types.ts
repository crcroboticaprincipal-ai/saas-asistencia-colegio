// ================================================================
// ASISTO — Tipos TypeScript completos del esquema de base de datos
// ================================================================

export type Rol = 'superadmin' | 'staff_qrono' | 'director' | 'coordinador' | 'docente' | 'porteria' | 'administrativo' | 'obrero';
export type NivelEducativo = 'basica' | 'media' | 'completa';
export type PlanSuscripcion = 'starter' | 'professional' | 'enterprise';
export type TipoHorario = 'fijo' | 'medio_turno' | 'fraccionado';
export type EstadoEvaluacion = 'Puntual' | 'Retardo' | 'Salida Temprana' | 'Sin Evaluar';
export type EstadoAsistenciaMateria = 'Presente' | 'Tardanza' | 'Ausente' | 'Justificado';

export interface ConfiguracionAcademica {
  hora_entrada: string;            // "07:00"
  hora_salida: string;             // "14:00"
  tolerancia_minutos: number;      // 10
  notificar_porteria: boolean;
  notificar_asistencia_materia: boolean;
  dias_laborables: number[];       // [1, 2, 3, 4, 5] (lunes a viernes)
}

export interface Institucion {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  nivel_educativo: NivelEducativo;
  plan_suscripcion: PlanSuscripcion;
  configuracion_academica: ConfiguracionAcademica;
  logo_url: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Estudiante {
  id: string;
  institucion_id: string;
  cedula: string;
  nombre_completo: string;
  grado: string;
  seccion: string;
  nombre_representante: string;
  correo_representante: string;
  qr_code: string;
  created_at: string;
  estado: 'Activo' | 'Retirado' | 'Graduado';
}

export interface Asistencia {
  id: string;
  institucion_id: string;
  estudiante_id: string;
  tipo: 'ENTRADA' | 'SALIDA';
  fecha: string;
  hora: string;
  created_at: string;
  estudiantes?: Estudiante;
}

export interface Personal {
  id: string;
  institucion_id: string;
  auth_user_id: string | null;
  nombres: string;
  apellidos: string;
  cedula: string | null;
  correo: string | null;
  telefono: string | null;
  cargo: string | null;
  rol: Rol;
  username: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface HorarioPlantilla {
  id: string;
  institucion_id: string;
  personal_id: string;
  nombre: string;
  tipo: TipoHorario;
  activo: boolean;
  vigente_desde: string;
  vigente_hasta: string | null;
  created_at: string;
}

export interface HorarioBloque {
  id: string;
  plantilla_id: string;
  dia_semana: number;
  hora_entrada_esperada: string;
  hora_salida_esperada: string;
  tolerancia_entrada_min: number;
  tolerancia_salida_min: number;
  es_hora_hueca: boolean;
  descripcion: string | null;
  created_at: string;
}

export interface AsistenciaPersonal {
  id: string;
  institucion_id: string;
  personal_id: string;
  bloque_id: string | null;
  tipo: 'ENTRADA' | 'SALIDA';
  fecha: string;
  hora: string;
  estado_evaluacion: EstadoEvaluacion;
  minutos_diferencia: number | null;
  notas: string | null;
  created_at: string;
}

export interface Materia {
  id: string;
  institucion_id: string;
  nombre: string;
  codigo: string | null;
  nivel: string | null;
  created_at: string;
}

export interface ProfesorAsignacion {
  id: string;
  institucion_id: string;
  personal_id: string;
  materia_id: string;
  grado: string;
  seccion: string;
  dia_semana: number | null;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
  periodo_escolar: string;
  created_at: string;
  // Joins opcionales
  materia?: Materia;
  personal?: Personal;
}

export interface AsistenciaMateria {
  id: string;
  institucion_id: string;
  asignacion_id: string;
  estudiante_id: string;
  fecha: string;
  hora_escaneo: string | null;
  estado: EstadoAsistenciaMateria;
  notificacion_enviada: boolean;
  created_at: string;
  // Joins opcionales
  estudiante?: Estudiante;
  asignacion?: ProfesorAsignacion;
}

export interface AuditLog {
  id: number;
  tabla: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  registro_id: string | null;
  user_id: string | null;
  institucion_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// ── Tipos de respuesta para el evaluador de asistencia ──
export interface ResultadoEvaluacion {
  estado: EstadoEvaluacion;
  minutos_diferencia: number;
  bloque_id: string | null;
  descripcion: string;
}

// ── Tipo para el Login PIN ──
export interface LoginPinPayload {
  username: string;
  pin: string;
  institucion_nombre_corto: string;
}
