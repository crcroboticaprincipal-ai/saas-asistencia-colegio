import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

async function generatePDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Colors
  const primaryColor = [15, 23, 42];    // Dark Slate #0F172A
  const accentColor = [99, 102, 241];   // Indigo #6366F1
  const textColor = [51, 65, 85];       // Slate 700
  const lightBg = [248, 250, 252];      // Slate 50
  const boxBorder = [226, 232, 240];    // Slate 200

  // Helper functions
  const checkPageBreak = (needed = 15) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin + 10;
      addHeaderFooter();
    }
  };

  const addHeaderFooter = () => {
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('SISTEMA ASISTO — MANUAL DE CAPACITACIÓN 2026-2027', margin, 10);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, pageWidth - margin, 12);

      // Footer
      doc.setFont('helvetica', 'normal');
      doc.text(`Página ${i} de ${pages}`, pageWidth - margin - 20, pageHeight - 8);
      doc.text('Documento de Uso Interno — Colegio Rafael Castillo', margin, pageHeight - 8);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    }
  };

  // Title Banner
  doc.setFillColor(...primaryColor);
  doc.rect(margin, y, contentWidth, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('MANUAL DE CAPACITACIÓN Y CARGA DE DATOS', margin + 8, y + 11);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(199, 210, 254);
  doc.text('Sistema Asisto • Configuración del Año Escolar 2026-2027', margin + 8, y + 20);

  y += 35;

  // Introduction Box
  doc.setFillColor(...lightBg);
  doc.setDrawColor(...boxBorder);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...accentColor);
  doc.text('OBJETIVO DEL MANUAL:', margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  const introText = 'Guía práctica estructurada para capacitar al equipo administrativo en la carga ordenada de Materias, Profesores, Horarios y Matrícula de Alumnos, garantizando la vinculación de datos sin inconsistencias.';
  const splitIntro = doc.splitTextToSize(introText, contentWidth - 10);
  doc.text(splitIntro, margin + 5, y + 13);

  y += 28;

  // Section 1: Flujo Secuencial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('1. ORDEN LÓGICO DE CARGA DE DATOS (CRÍTICO)', margin, y);
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.8);
  doc.line(margin, y + 2, margin + 80, y + 2);
  y += 8;

  const steps = [
    { num: 'Paso 1', title: 'Configuración Institucional', desc: 'Horas globales de entrada/salida y tolerancia en /admin' },
    { num: 'Paso 2', title: 'Registro del Personal', desc: 'Creación de docentes y portería con su PIN inicial en /admin/rrhh' },
    { num: 'Paso 3', title: 'Catálogo de Materias', desc: 'Registro de asignaturas por grado en /admin/materias' },
    { num: 'Paso 4', title: 'Asignación Docente y Horarios', desc: 'Cruce: Profesor + Materia + Grado/Sección + Bloque de Hora' },
    { num: 'Paso 5', title: 'Matrícula de Estudiantes', desc: 'Importación Excel de alumnos (2026-2027) y carnetización QR' },
    { num: 'Paso 6', title: 'Operación en Vivo', desc: 'Escaneo en portería (/escaner) y pase de lista (/aula/pasar-lista)' }
  ];

  steps.forEach((s) => {
    checkPageBreak(14);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...accentColor);
    doc.text(s.num, margin + 4, y + 7);

    doc.setTextColor(...primaryColor);
    doc.text(s.title + ':', margin + 22, y + 7);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(s.desc, margin + 70, y + 7);

    y += 13;
  });

  y += 5;

  // Section 2: Modulo 1 - Configuracion
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('2. MÓDULO 1: CONFIGURACIÓN INSTITUCIONAL', margin, y);
  doc.line(margin, y + 2, margin + 70, y + 2);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textColor);
  const m1Text = [
    '• Acceso: Iniciar sesión en el Panel Administrador (/admin).',
    '• Hora de Entrada Oficial: Hora límite fijada para la portería (ej: 07:00 AM).',
    '• Hora de Salida Oficial: Hora regular de salida (ej: 14:00 PM / 02:00 PM).',
    '• Tolerancia en Minutos: Tiempo de holgura antes de marcar "Retardo" (ej: 10 minutos).',
    '• Notificaciones: Verificar que las notificaciones automáticas por correo a representantes estén activas.'
  ];
  m1Text.forEach(line => {
    checkPageBreak(6);
    doc.text(line, margin + 2, y);
    y += 5.5;
  });

  y += 4;

  // Section 3: Modulo 2 - Personal
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('3. MÓDULO 2: REGISTRO DEL PERSONAL (DOCENTES Y OPERATIVOS)', margin, y);
  doc.line(margin, y + 2, margin + 95, y + 2);
  y += 8;

  const m2Text = [
    '• Acceso: Ir al panel de Recursos Humanos (/admin/rrhh).',
    '• Registro: Hacer clic en "+ Nuevo Personal" o "Importar Excel".',
    '• Datos Clave: Cédula, Nombres Completo, Correo Electrónico y Rol (docente, porteria, coordinador).',
    '• PIN de Acceso: Asignar PIN de 4 dígitos inicial (ej: 1234) para que el profesor ingrese desde su tablet o teléfono.',
    '• Reseteo de PIN: En caso de olvido, el administrador puede blanquear el PIN a 1234 con un clic desde /admin/rrhh.'
  ];
  m2Text.forEach(line => {
    checkPageBreak(6);
    doc.text(line, margin + 2, y);
    y += 5.5;
  });

  y += 4;

  // Section 4: Modulo 3 - Materias
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('4. MÓDULO 3: CATÁLOGO DE MATERIAS', margin, y);
  doc.line(margin, y + 2, margin + 60, y + 2);
  y += 8;

  const m3Text = [
    '• Acceso: Ir a Catálogo de Materias (/admin/materias).',
    '• Crear Materia: Hacer clic en "+ Nueva Materia".',
    '• Nombre de la Materia: Nombre formal (ej: Matemáticas, Física, Castellano, Química).',
    '• Código (Opcional): Abreviatura de 3 letras (ej: MAT, FIS, CAS, QUI).',
    '• Nivel / Grado: Seleccionar el año correspondiente (ej: 7mo / 1er Año, 8vo / 2do Año, General).',
    '• Regla de Nombres: Usar nombres estandarizados y limpios para evitar duplicados.'
  ];
  m3Text.forEach(line => {
    checkPageBreak(6);
    doc.text(line, margin + 2, y);
    y += 5.5;
  });

  y += 4;

  // Section 5: Modulo 4 - Vinculación Estrella (Horarios y Clases)
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('5. MÓDULO 4: VINCULACIÓN ESTRELLA (PROFESOR + MATERIA + SECCIÓN + HORARIO)', margin, y);
  doc.line(margin, y + 2, margin + 130, y + 2);
  y += 8;

  const m4Text = [
    '1. Ir a Recursos Humanos (/admin/rrhh), ubicar al docente y pulsar en el botón "Horarios & Clases".',
    '2. Plantilla Laboral: Definir los días de trabajo (Lunes a Viernes) y hora de llegada/salida esperada del empleado.',
    '3. Asignación de Clases Académicas (Paso Crítico):',
    '   - Seleccionar Materia creada en el Módulo 3 (ej. Física).',
    '   - Seleccionar Grado (ej. 4to Año) y Sección exacta ("A" o "B").',
    '   - Seleccionar el Día de la semana (Lunes a Viernes).',
    '   - Especificar Hora de Inicio (ej: 07:15 AM) y Hora de Fin (ej: 08:45 AM).',
    '4. Hacer clic en "Guardar Configuración del Docente".',
    '• EFECTO AUTOMÁTICO: Cuando el docente entre a /aula/pasar-lista con su PIN, el sistema sabrá exactamente qué clase le toca dictar a esa hora y mostrará a los alumnos de esa sección.'
  ];
  m4Text.forEach(line => {
    checkPageBreak(6);
    doc.setFont('helvetica', line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.') || line.startsWith('4.') ? 'bold' : 'normal');
    doc.text(line, margin + (line.startsWith('   -') ? 6 : 2), y);
    y += 5.5;
  });

  y += 4;

  // Section 6: Modulo 5 - Matrícula Estudiantil
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('6. MÓDULO 5: MATRÍCULA ESTUDIANTIL Y CARNETS QR', margin, y);
  doc.line(margin, y + 2, margin + 90, y + 2);
  y += 8;

  const m5Text = [
    '• Carga Masiva Excel: Dirigirse a /admin/importar y descargar la plantilla Excel.',
    '• Columnas requeridas: cedula, nombre_completo, grado (ej: 1er Año), seccion (A o B), nombre_representante, correo_representante.',
    '• Período 2026-2027: Los alumnos quedarán registrados activamente en el nuevo periodo.',
    '• Carnets con QR: En /admin/estudiantes se generan automáticamente los carnets QR listos para imprimir en PDF.'
  ];
  m5Text.forEach(line => {
    checkPageBreak(6);
    doc.setFont('helvetica', 'normal');
    doc.text(line, margin + 2, y);
    y += 5.5;
  });

  y += 4;

  // Section 7: Checklist de Carga
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('7. CHECKLIST DE VERIFICACIÓN PARA EL EQUIPO', margin, y);
  doc.line(margin, y + 2, margin + 85, y + 2);
  y += 8;

  const checklist = [
    '[  ] Configuración institucional verificada en /admin (Entrada 07:00 / Salida 14:00).',
    '[  ] Todo el personal docente y de portería creado en /admin/rrhh con PIN.',
    '[  ] Catálogo de materias de todos los grados ingresado en /admin/materias.',
    '[  ] Clases, secciones (A/B) y bloques asignados a cada profesor en /admin/rrhh.',
    '[  ] Nómina de estudiantes cargada vía Excel en /admin/importar (Año 2026-2027).',
    '[  ] Carnets QR impresos y prueba de escaneo exitosa en /escaner.'
  ];

  checklist.forEach(item => {
    checkPageBreak(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text(item, margin + 2, y);
    y += 5.5;
  });

  // Apply Headers and Footers to all pages
  addHeaderFooter();

  // Save PDF file
  const pdfPath = path.join(process.cwd(), 'public', 'Manual_Capacitacion_Asisto_2026-2027.pdf');
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`PDF generado con éxito en: ${pdfPath}`);
}

generatePDF().catch(console.error);
