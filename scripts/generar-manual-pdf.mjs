import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mdPath = path.join(__dirname, '..', 'docs', 'MANUAL_OPERATIVO_ASISTO.md');
const outPath = path.join(__dirname, '..', 'docs', 'MANUAL_OPERATIVO_ASISTO.pdf');
const publicPath = path.join(__dirname, '..', 'public', 'MANUAL_OPERATIVO_ASISTO.pdf');

const content = fs.readFileSync(mdPath, 'utf8');

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4',
});

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_X = 15;
const MARGIN_Y = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const MAX_Y = PAGE_HEIGHT - 20;

let currentY = MARGIN_Y;

function checkPageBreak(neededHeight = 10) {
  if (currentY + neededHeight > MAX_Y) {
    doc.addPage();
    currentY = MARGIN_Y + 10;
  }
}

// ── Header Component for pages > 1 ──
function drawPageDecorations() {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Top banner header
    doc.setFillColor(79, 70, 229); // Indigo #4F46E5
    doc.rect(0, 0, PAGE_WIDTH, 8, 'F');
    
    // Top bar text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('ASISTO · MANUAL OPERATIVO Y GUÍA DE CONFIGURACIÓN — U.E. COLEGIO RAFAEL CASTILLO', MARGIN_X, 5.5);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Sistema Asisto 2026-2027 — Página ${i} de ${pageCount}`, MARGIN_X, PAGE_HEIGHT - 8);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN_X, PAGE_HEIGHT - 12, PAGE_WIDTH - MARGIN_X, PAGE_HEIGHT - 12);
  }
}

// ── Cover Banner ──
doc.setFillColor(15, 23, 42); // Dark Slate #0F172A
doc.rect(MARGIN_X, currentY, CONTENT_WIDTH, 36, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(18);
doc.setTextColor(255, 255, 255);
doc.text('MANUAL OPERATIVO — SISTEMA ASISTO', MARGIN_X + 6, currentY + 12);

doc.setFontSize(11);
doc.setTextColor(165, 180, 252); // Light Indigo
doc.text('Colegio U.E. Rafael Castillo · Guía de Configuración Ciclo 2026-2027', MARGIN_X + 6, currentY + 20);

doc.setFontSize(9);
doc.setTextColor(203, 213, 225);
doc.text('Versión 2.0 · Manual oficial para Capacitación de Directivos, Coordinadores y Docentes', MARGIN_X + 6, currentY + 28);

currentY += 44;

// ── Process Markdown Lines ──
const lines = content.split('\n');
let i = 0;

while (i < lines.length) {
  let line = lines[i].trim();

  // Skip title header (already rendered in cover banner)
  if (line.startsWith('# MANUAL OPERATIVO') || line.startsWith('## Colegio U.E. Rafael Castillo')) {
    i++;
    continue;
  }

  // Divider
  if (line === '---') {
    checkPageBreak(8);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN_X, currentY, PAGE_WIDTH - MARGIN_X, currentY);
    currentY += 6;
    i++;
    continue;
  }

  // Heading 2 (##)
  if (line.startsWith('## ')) {
    const text = line.replace(/^##\s+/, '').replace(/\*\*/g, '');
    checkPageBreak(16);
    currentY += 4;
    
    doc.setFillColor(79, 70, 229);
    doc.rect(MARGIN_X, currentY, 3.5, 7, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(text, MARGIN_X + 6, currentY + 5.5);
    currentY += 11;
    i++;
    continue;
  }

  // Heading 3 (###)
  if (line.startsWith('### ')) {
    const text = line.replace(/^###\s+/, '').replace(/\*\*/g, '');
    checkPageBreak(12);
    currentY += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(text, MARGIN_X, currentY + 4);
    currentY += 8;
    i++;
    continue;
  }

  // Blockquote (>)
  if (line.startsWith('> ')) {
    checkPageBreak(12);
    const quoteText = line.replace(/^>\s+/, '').replace(/\*\*/g, '');
    const splitText = doc.splitTextToSize(quoteText, CONTENT_WIDTH - 12);
    const boxHeight = splitText.length * 4.5 + 6;

    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(MARGIN_X, currentY, CONTENT_WIDTH, boxHeight, 'F');
    doc.setFillColor(16, 185, 129); // Emerald border
    doc.rect(MARGIN_X, currentY, 2.5, boxHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(splitText, MARGIN_X + 6, currentY + 5);

    currentY += boxHeight + 4;
    i++;
    continue;
  }

  // Table (| ... |)
  if (line.startsWith('|')) {
    const tableRows = [];
    while (i < lines.length && lines[i].trim().startsWith('|')) {
      const rowLine = lines[i].trim();
      // Skip separator row |---|---|
      if (!rowLine.includes('---')) {
        const cells = rowLine.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        if (cells.length > 0) tableRows.push(cells);
      }
      i++;
    }

    if (tableRows.length > 0) {
      checkPageBreak(25);
      const head = [tableRows[0]];
      const body = tableRows.slice(1);

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        margin: { left: MARGIN_X, right: MARGIN_X },
        styles: { fontSize: 8.5, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
      });

      currentY = doc.lastAutoTable.finalY + 6;
    }
    continue;
  }

  // Code block (```)
  if (line.startsWith('```')) {
    i++;
    const codeLines = [];
    while (i < lines.length && !lines[i].trim().startsWith('```')) {
      codeLines.push(lines[i]);
      i++;
    }
    if (i < lines.length) i++; // skip ending ```

    const codeText = codeLines.join('\n');
    const splitCode = doc.splitTextToSize(codeText, CONTENT_WIDTH - 8);
    const boxHeight = splitCode.length * 4 + 6;

    checkPageBreak(boxHeight + 4);

    doc.setFillColor(15, 23, 42);
    doc.rect(MARGIN_X, currentY, CONTENT_WIDTH, boxHeight, 'F');

    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(241, 245, 249);
    doc.text(splitCode, MARGIN_X + 4, currentY + 5);

    currentY += boxHeight + 4;
    continue;
  }

  // Bullet point (- or *)
  if (line.startsWith('- ') || line.startsWith('* ')) {
    const text = line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '');
    checkPageBreak(7);

    doc.setFillColor(79, 70, 229);
    doc.circle(MARGIN_X + 2, currentY + 2.5, 1, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(text, CONTENT_WIDTH - 6);
    doc.text(splitText, MARGIN_X + 6, currentY + 3.5);

    currentY += splitText.length * 4.5 + 2;
    i++;
    continue;
  }

  // Numbered list (1. 2.)
  if (/^\d+\.\s+/.test(line)) {
    const num = line.match(/^(\d+\.)/)[1];
    const text = line.replace(/^\d+\.\s+/, '').replace(/\*\*/g, '');
    checkPageBreak(7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(79, 70, 229);
    doc.text(num, MARGIN_X, currentY + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const splitText = doc.splitTextToSize(text, CONTENT_WIDTH - 8);
    doc.text(splitText, MARGIN_X + 7, currentY + 3.5);

    currentY += splitText.length * 4.5 + 2;
    i++;
    continue;
  }

  // Normal Paragraph
  if (line.length > 0) {
    const cleanText = line.replace(/\*\*/g, '').replace(/`/g, '');
    checkPageBreak(8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    const splitText = doc.splitTextToSize(cleanText, CONTENT_WIDTH);
    doc.text(splitText, MARGIN_X, currentY + 3.5);

    currentY += splitText.length * 4.5 + 3;
  }

  i++;
}

// Draw headers & footers on all pages
drawPageDecorations();

// Save PDF
const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(outPath, pdfBuffer);
console.log(`PDF generado exitosamente en: ${outPath}`);

// Copy to public folder too
try {
  fs.writeFileSync(publicPath, pdfBuffer);
  console.log(`PDF disponible públicamente en: ${publicPath}`);
} catch (e) {
  /* ignore if public folder error */
}
