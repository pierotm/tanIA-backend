import { jsPDF } from 'jspdf';
import { AnalysisResult, Relevance } from '../types/domainTypes';

/**
 * CSV (se mantiene porque tu worker lo está importando)
 */
export const generateCsvBlob = (data: any[], headers: Record<string, string>): Blob => {
  const headerKeys = Object.keys(headers);
  const headerValues = Object.values(headers);

  const csvRows = [headerValues.join(',')]; // Header row

  for (const item of data) {
    const values = headerKeys.map((key) => {
      const val = item[key] ?? '';
      const escaped = ('' + val).replace(/"/g, '""'); // Escape double quotes
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  return new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
};

/**
 * PDF: 1 sola fuente (Helvetica), jerarquía por tamaños/bold,
 * márgenes y espaciados consistentes, cabecera bien separada del contenido,
 * secciones en "bloques" (cards) y tablas limpias.
 */
export const generateAnalysisPdfBlob = (result: AnalysisResult, fileName: string): Blob => {
  const { gazetteDate, norms, designatedAppointments, concludedAppointments } = result;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // --- Layout tokens (consistentes) ---
  const marginX = 15;
  const marginTop = 16;
  const marginBottom = 14;
  const headerHeight = 12; // altura de cabecera en páginas internas
  const contentWidth = pdfWidth - marginX * 2;

  const sectionGap = 10;
  const blockGap = 8;

  // Start Y for content in pages with header
  const contentStartY = marginTop + headerHeight + 6;

  // Cursor
  let cursorY = marginTop;

  // --- Palette (suave) ---
  const primary = '#0B3A82'; // azul institucional sobrio
  const text = '#0F172A'; // slate-900
  const muted = '#475569'; // slate-600
  const light = '#64748B'; // slate-500
  const line = [226, 232, 240]; // slate-200
  const headerFill = [241, 245, 249]; // slate-100
  const blockFill = [248, 250, 252]; // slate-50

  // --- Font helpers: 1 sola fuente (helvetica) ---
  const setH1 = () => pdf.setFont('helvetica', 'bold').setFontSize(20).setTextColor('#FFFFFF');
  const setH2 = () => pdf.setFont('helvetica', 'bold').setFontSize(15).setTextColor(primary);
  const setH3 = () => pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(text);
  const setBody = () => pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(text);
  const setSmall = () => pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(muted);
  const setTiny = () => pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(light);

  // --- Data prep ---
  const waterSectorNorms = norms.filter((n) => n.relevanceToWaterSector !== Relevance.NINGUNA);
  const relevanceOrder: Record<Relevance, number> = {
    [Relevance.ALTA]: 1,
    [Relevance.MEDIA]: 2,
    [Relevance.BAJA]: 3,
    [Relevance.NINGUNA]: 4,
  };
  const sortedWaterSectorNorms = [...waterSectorNorms].sort(
    (a, b) => relevanceOrder[a.relevanceToWaterSector] - relevanceOrder[b.relevanceToWaterSector]
  );

  const allAppointments = [
    ...designatedAppointments.map((d) => ({ ...d, type: 'Designado' as const })),
    ...concludedAppointments.map((c) => ({ ...c, type: 'Concluido' as const })),
  ];

  // --- Utilities ---
  const drawHeader = () => {
    // Cabecera en páginas internas (no en portada)
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);

    // título izq
    setTiny();
    pdf.text('Análisis de Normas Legales - El Peruano', marginX, marginTop + 7);

    // marca der
    pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(primary);
    pdf.text('CION - Sunass', pdfWidth - marginX, marginTop + 7, { align: 'right' });

    // línea separadora
    pdf.line(marginX, marginTop + headerHeight, pdfWidth - marginX, marginTop + headerHeight);
  };

  const addPageWithHeader = () => {
    pdf.addPage();
    cursorY = contentStartY;
    drawHeader();
  };

  const ensureContentPage = (() => {
    let started = false;
    return () => {
      if (!started) {
        addPageWithHeader();
        started = true;
      }
    };
  })();

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pdfHeight - marginBottom) {
      addPageWithHeader();
    }
  };

  const roundedRect = (x: number, y: number, w: number, h: number, r = 2) => {
    // jsPDF supports roundedRect in recent versions; but to be safe, fallback to rect if unavailable.
    // @ts-ignore
    if (typeof pdf.roundedRect === 'function') {
      // @ts-ignore
      pdf.roundedRect(x, y, w, h, r, r, 'F');
    } else {
      pdf.rect(x, y, w, h, 'F');
    }
  };

  const drawBlock = (height: number) => {
    pdf.setFillColor(blockFill[0], blockFill[1], blockFill[2]);
    roundedRect(marginX, cursorY, contentWidth, height, 2);
  };

  const safeText = (value: any) => String(value ?? '').trim();

  const addSectionTitle = (title: string, subtitle?: string) => {
    checkPageBreak(18);
    setH2();
    pdf.text(title, marginX, cursorY);
    cursorY += 7;

    if (subtitle) {
      setSmall();
      const lines = pdf.splitTextToSize(subtitle, contentWidth);
      pdf.text(lines, marginX, cursorY);
      cursorY += lines.length * 4 + 2;
    } else {
      cursorY += 2;
    }
  };

  // --- COVER PAGE ---
  pdf.setFillColor(primary);
  pdf.rect(0, 0, pdfWidth, 62, 'F');

  setH1();
  pdf.text('Análisis de Normas Legales', pdfWidth / 2, 26, { align: 'center' });

  pdf.setFont('helvetica', 'normal').setFontSize(14).setTextColor('#EAF2FF');
  pdf.text('Diario Oficial "El Peruano"', pdfWidth / 2, 38, { align: 'center' });

  // Body area on cover
  cursorY = 85;
  setBody();
  pdf.setTextColor(text);
  pdf.text(`Fecha del diario: ${safeText(gazetteDate)}`, pdfWidth / 2, cursorY, { align: 'center' });
  cursorY += 8;

  setSmall();
  pdf.text(`Archivo analizado: ${safeText(fileName)}`, pdfWidth / 2, cursorY, { align: 'center' });
  cursorY += 6;

  const genDate = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  pdf.text(`Generado el: ${genDate}`, pdfWidth / 2, cursorY, { align: 'center' });

  // Summary "card" on cover (bloque)
  cursorY += 18;
  const coverSummaryHeight = 26;
  pdf.setFillColor(blockFill[0], blockFill[1], blockFill[2]);
  roundedRect(marginX, cursorY, contentWidth, coverSummaryHeight, 3);

  const nNorms = sortedWaterSectorNorms.length;
  const nAppointments = allAppointments.length;

  const summaryText =
    `Se identificaron ${nNorms} norma(s) relevante(s) (ALTA/MEDIA/BAJA) y ` +
    `${nAppointments} movimiento(s) de cargos públicos (designaciones y conclusiones). ` +
    `Las normas se listan priorizadas por nivel de relevancia.`;

  setBody();
  const summaryLines = pdf.splitTextToSize(summaryText, contentWidth - 10);
  pdf.text(summaryLines, marginX + 5, cursorY + 10);
  cursorY += coverSummaryHeight;

  // --- CONTENT SECTIONS ---
  // (mantener "bloques y tablas", pero con márgenes/espacios correctos)

  // 1) Resumen ejecutivo (en página de contenido) - opcional, pero ayuda a la lectura
  ensureContentPage();
  addSectionTitle('Resumen ejecutivo');

  // block resumen
  const execLines = pdf.splitTextToSize(summaryText, contentWidth - 10);
  const execBlockHeight = Math.max(18, execLines.length * 4 + 10);
  checkPageBreak(execBlockHeight + blockGap);
  drawBlock(execBlockHeight);
  setBody();
  pdf.text(execLines, marginX + 5, cursorY + 9);
  cursorY += execBlockHeight + sectionGap;

  // 2) Movimientos
  if (allAppointments.length > 0) {
    addSectionTitle('Movimientos de cargos públicos');

    // Table config
    const headers = ['Institución', 'Tipo', 'Cargo', 'Nombre'];
    const colW = [contentWidth * 0.30, contentWidth * 0.14, contentWidth * 0.32, contentWidth * 0.24];
    const headerH = 9;
    const padX = 2.2;
    const padY = 4.2;
    const lineH = 4.1;

    // draw header row
    checkPageBreak(headerH + 6);
    pdf.setFillColor(headerFill[0], headerFill[1], headerFill[2]);
    pdf.rect(marginX, cursorY, contentWidth, headerH, 'F');
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.rect(marginX, cursorY, contentWidth, headerH);

    pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(muted);
    let x = marginX;
    headers.forEach((h, i) => {
      pdf.text(h, x + padX, cursorY + 6);
      x += colW[i];
    });
    cursorY += headerH;

    // rows
    pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(text);

    for (const appt of allAppointments) {
      const row = [
        safeText(appt.institution),
        safeText(appt.type),
        safeText(appt.position),
        safeText(appt.personName),
      ];

      // compute height by max wrapped lines in row
      const wrapped = row.map((t, i) => pdf.splitTextToSize(t, colW[i] - padX * 2));
      const maxLines = Math.max(...wrapped.map((l) => l.length));
      const rowH = Math.max(10, maxLines * lineH + 4);

      checkPageBreak(rowH + 2);

      // row border line
      pdf.setDrawColor(...line);
      pdf.setLineWidth(0.3);
      pdf.rect(marginX, cursorY, contentWidth, rowH);

      // cell text
      x = marginX;
      for (let i = 0; i < row.length; i++) {
        const lines = wrapped[i];
        pdf.text(lines, x + padX, cursorY + padY, { maxWidth: colW[i] - padX * 2 });
        x += colW[i];
      }

      cursorY += rowH;
    }

    cursorY += sectionGap;
  }

  // 3) Normas (tabla con “bloque” de detalle dentro de la celda)
  if (sortedWaterSectorNorms.length > 0) {
    addSectionTitle('Normas relevantes para Agua y Saneamiento', 'Ordenadas por relevancia (ALTA → MEDIA → BAJA).');

    const headers = ['Relevancia', 'Sector', 'Norma', 'Pág.'];
    const colW = [contentWidth * 0.15, contentWidth * 0.20, contentWidth * 0.55, contentWidth * 0.10];

    const headerH = 9;
    const pad = 2.4;
    const lineH = 4.2;
    const smallH = 3.8;

    const calcRowHeight = (norm: any) => {
      // all helvetica, jerarquía con tamaños/bold
      const relLines = pdf.splitTextToSize(safeText(norm.relevanceToWaterSector), colW[0] - pad * 2);
      const secLines = pdf.splitTextToSize(safeText(norm.sector), colW[1] - pad * 2);
      const pageLines = pdf.splitTextToSize(safeText(norm.pageNumber), colW[3] - pad * 2);

      const detailW = colW[2] - pad * 2;

      pdf.setFont('helvetica', 'bold').setFontSize(9);
      const titleLines = pdf.splitTextToSize(safeText(norm.title), detailW);

      pdf.setFont('helvetica', 'normal').setFontSize(8);
      const idLines = pdf.splitTextToSize(safeText(norm.normId), detailW);

      pdf.setFont('helvetica', 'normal').setFontSize(8);
      const summaryLines = pdf.splitTextToSize(safeText(norm.summary), detailW);

      const h1 = relLines.length * lineH;
      const h2 = secLines.length * lineH;
      const h3 = titleLines.length * lineH + idLines.length * smallH + summaryLines.length * smallH + 4;
      const h4 = pageLines.length * lineH;

      return Math.max(h1, h2, h3, h4) + pad * 2 + 2;
    };

    // header row
    checkPageBreak(headerH + 6);
    pdf.setFillColor(headerFill[0], headerFill[1], headerFill[2]);
    pdf.rect(marginX, cursorY, contentWidth, headerH, 'F');
    pdf.setDrawColor(...line);
    pdf.setLineWidth(0.3);
    pdf.rect(marginX, cursorY, contentWidth, headerH);

    pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(muted);
    let x = marginX;
    headers.forEach((h, i) => {
      pdf.text(h, x + pad, cursorY + 6);
      x += colW[i];
    });
    cursorY += headerH;

    // rows
    for (const norm of sortedWaterSectorNorms) {
      const rowH = calcRowHeight(norm);
      checkPageBreak(rowH + 2);

      // row border
      pdf.setDrawColor(...line);
      pdf.setLineWidth(0.3);
      pdf.rect(marginX, cursorY, contentWidth, rowH);

      const rowTop = cursorY;

      // col 1: Relevancia (badge-like)
      const rel = safeText(norm.relevanceToWaterSector);
      const badgeH = 7;
      const badgeW = colW[0] - pad * 2;

      // badge color (ALTA/MEDIA/BAJA)
      const relFill =
        rel === Relevance.ALTA ? [220, 38, 38] : rel === Relevance.MEDIA ? [234, 179, 8] : [37, 99, 235];
      pdf.setFillColor(relFill[0], relFill[1], relFill[2]);
      // “pill” (rounded) si existe, sino rect
      // @ts-ignore
      if (typeof pdf.roundedRect === 'function') {
        // @ts-ignore
        pdf.roundedRect(marginX + pad, rowTop + pad, badgeW, badgeH, 2, 2, 'F');
      } else {
        pdf.rect(marginX + pad, rowTop + pad, badgeW, badgeH, 'F');
      }
      pdf.setFont('helvetica', 'bold').setFontSize(8).setTextColor('#FFFFFF');
      pdf.text(rel, marginX + pad + badgeW / 2, rowTop + pad + 5.1, { align: 'center' });

      // col 2: Sector
      pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(text);
      const secLines = pdf.splitTextToSize(safeText(norm.sector), colW[1] - pad * 2);
      pdf.text(secLines, marginX + colW[0] + pad, rowTop + pad + 4.2);

      // col 3: Detail block feel (sin otra fuente)
      const detailX = marginX + colW[0] + colW[1] + pad;
      const detailW = colW[2] - pad * 2;
      let y = rowTop + pad + 4.2;

      pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(text);
      const titleLines = pdf.splitTextToSize(safeText(norm.title), detailW);
      pdf.text(titleLines, detailX, y);
      y += titleLines.length * lineH;

      pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(primary);
      const idLines = pdf.splitTextToSize(safeText(norm.normId), detailW);
      pdf.text(idLines, detailX, y);
      y += idLines.length * smallH + 1;

      pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(muted);
      const summaryLines = pdf.splitTextToSize(safeText(norm.summary), detailW);
      pdf.text(summaryLines, detailX, y);

      // col 4: page
      pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(text);
      pdf.text(
        safeText(norm.pageNumber),
        marginX + colW[0] + colW[1] + colW[2] + colW[3] / 2,
        rowTop + pad + 5.2,
        { align: 'center' }
      );

      cursorY += rowH;
    }

    cursorY += sectionGap;
  }

  // --- PAGE NUMBERING (y cabecera ya dibujada en páginas internas) ---
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // En portada NO dibujamos cabecera.
    if (i > 1) {
      // footer
      setTiny();
      pdf.text(`Página ${i} de ${pageCount}`, pdfWidth - marginX, pdfHeight - 8, { align: 'right' });
    } else {
      // footer portada (más discreto)
      setTiny();
      pdf.text(`Página 1 de ${pageCount}`, pdfWidth - marginX, pdfHeight - 8, { align: 'right' });
    }
  }

  return pdf.output('blob');
};
