const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// 1. Datos de ejemplo para la Hoja de Cobranza
const datosCobranza = [
  {
    cedula: 'V-32145678',
    nombre_estudiante: 'GARCÍA PÉREZ ANDRÉS FELIPE',
    seccion: '1er Grado A',
    nombre_representante: 'CARLOS GARCÍA',
    representante_correo: 'carlos.garcia@email.com',
    mes_vencido: 'Octubre 2026',
    deuda_dolares: 45.00,
    mora: 0.00,
  },
  {
    cedula: 'V-33987654',
    nombre_estudiante: 'RODRÍGUEZ HERNÁNDEZ VALENTINA',
    seccion: '2do Grado B',
    nombre_representante: 'PATRICIA HERNÁNDEZ',
    representante_correo: 'patricia.hernandez@email.com',
    mes_vencido: 'Septiembre y Octubre 2026',
    deuda_dolares: 90.00,
    mora: 5.00,
  },
  {
    cedula: 'V-30876543',
    nombre_estudiante: 'MARTÍNEZ LÓPEZ SEBASTIÁN',
    seccion: '4to Año A',
    nombre_representante: 'ROBERTO MARTÍNEZ',
    representante_correo: '', // Ejemplo sin correo para ilustrar cómo el sistema lo destaca
    mes_vencido: 'Octubre 2026',
    deuda_dolares: 50.00,
    mora: 0.00,
  },
  {
    cedula: 'V-31234567-H1',
    nombre_estudiante: 'MENDOZA CASTILLO ISABELLA',
    seccion: 'Inicial B',
    nombre_representante: 'MARIANA CASTILLO',
    representante_correo: 'mariana.castillo@email.com',
    mes_vencido: 'Matrícula Escolar 2026-2027',
    deuda_dolares: 60.00,
    mora: 0.00,
  },
  {
    cedula: 'V-31234567-H2',
    nombre_estudiante: 'MENDOZA CASTILLO SANTIAGO',
    seccion: '3er Grado A',
    nombre_representante: 'MARIANA CASTILLO',
    representante_correo: 'mariana.castillo@email.com',
    mes_vencido: 'Matrícula Escolar 2026-2027',
    deuda_dolares: 60.00,
    mora: 0.00,
  },
];

// Crear hoja de cálculo de Cobranza
const wsCobranza = XLSX.utils.json_to_sheet(datosCobranza, {
  header: [
    'cedula',
    'nombre_estudiante',
    'seccion',
    'nombre_representante',
    'representante_correo',
    'mes_vencido',
    'deuda_dolares',
    'mora',
  ],
});

// Ancho de columnas optimizado
wsCobranza['!cols'] = [
  { wch: 16 }, // cedula
  { wch: 34 }, // nombre_estudiante
  { wch: 18 }, // seccion
  { wch: 28 }, // nombre_representante
  { wch: 32 }, // representante_correo
  { wch: 28 }, // mes_vencido
  { wch: 16 }, // deuda_dolares
  { wch: 12 }, // mora
];

// 2. Hoja de Instrucciones para el Departamento de Cobranzas
const instruccionesData = [
  ['SISTEMA ASISTO — PLANTILLA OFICIAL DE COBRANZAS INSTITUCIONALES'],
  ['Guía para el Departamento de Cobranzas y Administración Escolar'],
  [''],
  ['COLUMNA', 'DESCRIPCIÓN', 'OBLIGATORIO', 'EJEMPLO Y RECOMENDACIÓN'],
  ['cedula', 'Cédula o Cédula Escolar (OPCIONAL: el sistema cruza por nombres sin requerir cédula)', 'OPCIONAL', 'V-32145678 o dejar vacía si no se tiene.'],
  ['nombre_estudiante', 'Nombres y apellidos completos del estudiante', 'SÍ (OBLIGATORIO)', 'GARCÍA PÉREZ ANDRÉS FELIPE. Permite el cruce automático con la nómina escolar.'],
  ['seccion', 'Grado / Año y Sección del estudiante', 'SÍ (OBLIGATORIO)', '1er Grado A, 2do Grado B, 4to Año A, Inicial B, etc.'],
  ['nombre_representante', 'Nombre del padre, madre o representante', 'OPCIONAL', 'CARLOS GARCÍA (si se omite, el sistema usará el registrado en la ficha del alumno).'],
  ['representante_correo', 'Correo del representante para la notificación', 'OPCIONAL', 'correo@ejemplo.com. Si no se tiene, déjelo vacío; el sistema lo destacará para agregarlo.'],
  ['mes_vencido', 'Concepto, mes o cuotas adeudadas', 'SÍ (OBLIGATORIO)', 'Octubre 2026, Septiembre y Octubre, Matrícula 2026-2027, etc.'],
  ['deuda_dolares', 'Monto subtotal de la cuota en dólares ($ USD)', 'SÍ (OBLIGATORIO)', '45.00 (solo número decimal, sin símbolo de moneda).'],
  ['mora', 'Recargo o intereses de mora en dólares ($ USD)', 'OPCIONAL', '5.00 o 0.00 si no aplica recargo.'],
  [''],
  ['FUNCIONAMIENTO INTELIGENTE DE ASISTO EN COBRANZAS:'],
  ['1. CRUCE AUTOMÁTICO:', 'El sistema cruza cada fila con los estudiantes activos de la institución y extrae automáticamente el correo si ya está en el sistema.'],
  ['2. ALUMNOS NO REGISTRADOS:', 'Si un alumno de esta lista no aparece en el sistema escolar, Asisto lo registra automáticamente en la base de datos.'],
  ['3. ALUMNOS SIN CORREO:', 'El sistema destacará en color ámbar a los estudiantes que no tengan correo asociado para que administración pueda escribirlo.'],
  ['4. SEGURIDAD Y PRIVACIDAD:', 'El archivo se procesa únicamente en memoria volátil temporal (Cero Residuos en disco) y no se guardan datos bancarios en las plantillas.'],
  [''],
  ['IMPORTANTE:', 'NO modifiques los nombres de los encabezados de la fila 1 de la hoja "Cobranza_Alumnos". Puedes borrar las filas de ejemplo antes de pegar tus datos reales.'],
];

const wsInstrucciones = XLSX.utils.aoa_to_sheet(instruccionesData);
wsInstrucciones['!cols'] = [
  { wch: 25 },
  { wch: 45 },
  { wch: 18 },
  { wch: 65 },
];

// Crear el libro con ambas hojas
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsCobranza, 'Cobranza_Alumnos');
XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'INSTRUCCIONES');

// Guardar archivo en public/
const destPublic = path.join(__dirname, '..', 'public', 'Plantilla_Oficial_Cobranzas_Asisto.xlsx');
XLSX.writeFile(wb, destPublic);
console.log('Plantilla generada exitosamente en:', destPublic);
