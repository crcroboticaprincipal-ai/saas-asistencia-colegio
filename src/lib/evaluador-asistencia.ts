// ================================================================
// QRONO — Motor Evaluador de Asistencia de Personal
// Soporte: Horario Fijo, Medio Turno, Fraccionado con Horas Huecas
// ================================================================
import { parseISO, parse, differenceInMinutes } from 'date-fns';
import type { HorarioBloque, EstadoEvaluacion, ResultadoEvaluacion } from './types';

/**
 * Convierte un string de tiempo "HH:mm:ss" o "HH:mm" a minutos desde medianoche
 */
function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/**
 * Encuentra el bloque horario activo para una fecha/hora dada.
 * Ignora bloques marcados como "hora hueca".
 */
function encontrarBloqueActivo(
  bloques: HorarioBloque[],
  diaSemana: number,
  horaActualMin: number
): HorarioBloque | null {
  const bloquesDelDia = bloques
    .filter(b => b.dia_semana === diaSemana && !b.es_hora_hueca)
    .sort((a, b) => timeStringToMinutes(a.hora_entrada_esperada) - timeStringToMinutes(b.hora_entrada_esperada));

  for (const bloque of bloquesDelDia) {
    const entradaMin = timeStringToMinutes(bloque.hora_entrada_esperada);
    const salidaMin = timeStringToMinutes(bloque.hora_salida_esperada);
    
    // Ventana de evaluación: 30 min antes de entrada hasta 30 min después de salida
    const ventanaInicio = entradaMin - 30;
    const ventanaFin = salidaMin + 30;

    if (horaActualMin >= ventanaInicio && horaActualMin <= ventanaFin) {
      return bloque;
    }
  }
  return null;
}

/**
 * Evaluador principal de asistencia de personal.
 * Determina si un registro es Puntual, Retardo o Salida Temprana
 * con los minutos exactos de diferencia.
 */
export function evaluarAsistenciaPersonal(
  tipo: 'ENTRADA' | 'SALIDA',
  horaRegistrada: string,   // "07:15:00"
  bloques: HorarioBloque[],
  diaSemana: number         // 1=Lunes, 7=Domingo
): ResultadoEvaluacion {
  const horaActualMin = timeStringToMinutes(horaRegistrada);
  const bloqueActivo = encontrarBloqueActivo(bloques, diaSemana, horaActualMin);

  if (!bloqueActivo) {
    return {
      estado: 'Sin Evaluar',
      minutos_diferencia: 0,
      bloque_id: null,
      descripcion: 'No hay bloque horario activo para este momento',
    };
  }

  if (tipo === 'ENTRADA') {
    const entradaEsperadaMin = timeStringToMinutes(bloqueActivo.hora_entrada_esperada);
    const diferencia = horaActualMin - entradaEsperadaMin;
    const tolerancia = bloqueActivo.tolerancia_entrada_min ?? 10;

    if (diferencia <= tolerancia) {
      return {
        estado: 'Puntual',
        minutos_diferencia: diferencia,
        bloque_id: bloqueActivo.id,
        descripcion: diferencia <= 0
          ? `Llegó ${Math.abs(diferencia)} min antes de lo esperado`
          : `Dentro del margen de tolerancia (${diferencia} min)`,
      };
    } else {
      return {
        estado: 'Retardo',
        minutos_diferencia: diferencia,
        bloque_id: bloqueActivo.id,
        descripcion: `Retardo de ${diferencia} minutos (tolerancia: ${tolerancia} min)`,
      };
    }
  } else {
    // SALIDA
    const salidaEsperadaMin = timeStringToMinutes(bloqueActivo.hora_salida_esperada);
    const diferencia = salidaEsperadaMin - horaActualMin;
    const tolerancia = bloqueActivo.tolerancia_salida_min ?? 15;

    if (diferencia > tolerancia) {
      return {
        estado: 'Salida Temprana',
        minutos_diferencia: diferencia,
        bloque_id: bloqueActivo.id,
        descripcion: `Salida ${diferencia} min antes del horario esperado`,
      };
    } else {
      return {
        estado: 'Puntual',
        minutos_diferencia: diferencia <= 0 ? 0 : diferencia,
        bloque_id: bloqueActivo.id,
        descripcion: diferencia <= 0
          ? `Salida en tiempo o posterior al horario`
          : `Dentro del margen de salida (${diferencia} min restantes)`,
      };
    }
  }
}

/**
 * Obtiene el número de día de semana ISO de una fecha
 * 1=Lunes, 2=Martes ... 7=Domingo
 */
export function getDiaSemanaISO(fecha: Date): number {
  const day = fecha.getDay(); // 0=Sunday, 1=Monday...
  return day === 0 ? 7 : day;
}

/**
 * Formatea minutos de diferencia para mostrar en UI
 */
export function formatearDiferencia(minutos: number, estado: EstadoEvaluacion): string {
  if (estado === 'Sin Evaluar') return '—';
  if (minutos === 0) return 'En punto';
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const tiempo = h > 0 ? `${h}h ${m}m` : `${m} min`;
  return estado === 'Puntual' ? `✓ ${tiempo}` : `${tiempo}`;
}
