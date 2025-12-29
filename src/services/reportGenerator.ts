import { jsPDF } from 'jspdf';
import { AnalysisResult, Relevance } from '../types/domainTypes';

export const generateAnalysisPdfBlob = (
  result: AnalysisResult,
  fileName: string
): Blob => {
  const pdf = new jsPDF('p', 'mm', 'a4');

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const PAGE_MARGIN = 18;
  const SECTION_GAP = 14;
  const BLOCK_PADDING = 8;
  const contentWidth = pdfWidth - PAGE_MARGIN * 2;

  let cursorY = PAGE_MARGIN;

  /* ======================
     Helpers
  ====================== */

  const drawHeader = () => {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(120);
    pdf.text('Análisis de Normas Legales – El Peruano', PAGE_MARGIN, 12);
    pdf.text('CION – SUNASS', pdfWidth - PAGE_MARGIN, 12, { align: 'right' });
    pdf.setDrawColor(220);
    pdf.line(PAGE_MARGIN, 15, pdfWidth - PAGE_MARGIN, 15);
    cursorY = 22;
  };

  const checkPageBreak = (needed: number) => {
    if (cursorY + needed > pdfHeight - PAGE_MARGIN) {
      pdf.addPage();
      drawHeader();
    }
  };

  const drawSectionTitle = (title: string) => {
    cursorY += SECTION_GAP;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 51, 160);
    pdf.text(title, PAGE_MARGIN, cursorY);
    cursorY += 6;
  };

  const drawBlock = (height: number) => {
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(
      PAGE_MARGIN,
      cursorY,
      contentWidth,
      height,
      2,
      2,
      'F'
    );
  };

  /* ======================
     COVER
  ====================== */

  pdf.setFillColor(0, 51, 160);
  pdf.rect(0, 0, pdfWidth, 60, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(255);
  pdf.text('Análisis de Normas Legales', pdfWidth / 2, 28, { align: 'center' });

  pdf.setFontSize(14);
  pdf.text('Diario Oficial El Peruano', pdfWidth / 2, 38, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(60);
  pdf.setFontSize(11);
  pdf.text(`Fecha del diario: ${result.gazetteDate}`, pdfWidth / 2, 90, { align: 'center' });
  pdf.text(`Archivo analizado: ${fileName}`, pdfWidth / 2, 98, { align: 'center' });
  pdf.text(
    `Elaborado por: Centro de Inteligencia de Operaciones para la Innovación – CION / SUNASS`,
    pdfWidth / 2,
    106,
    { align: 'center', maxWidth: contentWidth }
  );

  pdf.addPage();
  drawHeader();

  /* ======================
     RESUMEN EJECUTIVO
  ====================== */

  drawSectionTitle('Resumen ejecutivo');

  const resumenText = `Se identificaron ${
    result.norms.length
  } normas relevantes (ALTA / MEDIA / BAJA) y ${
    result.designatedAppointments.length + result.concludedAppointments.length
  } movimientos de cargos públicos. Las normas se listan priorizadas por nivel de relevancia.`;

  const resumenLines = pdf.splitTextToSize(resumenText, contentWidth - BLOCK_PADDING * 2);
  const resumenHeight = resumenLines.length * 5 + BLOCK_PADDING * 2;

  checkPageBreak(resumenHeight);
  drawBlock(resumenHeight);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(40);
  pdf.text(
    resumenLines,
    PAGE_MARGIN + BLOCK_PADDING,
    cursorY + BLOCK_PADDING + 4
  );

  cursorY += resumenHeight;

  /* ======================
     MOVIMIENTOS DE CARGOS
  ====================== */

  const allAppointments = [
    ...result.designatedAppointments.map(a => ({ ...a, type: 'Designado' })),
    ...result.concludedAppointments.map(a => ({ ...a, type: 'Concluido' })),
  ];

  if (allAppointments.length) {
    drawSectionTitle('Movimientos de cargos públicos');

    const headers = ['Institución', 'Tipo', 'Cargo', 'Nombre'];
    const colWidths = [
      contentWidth * 0.32,
      contentWidth * 0.12,
      contentWidth * 0.32,
      contentWidth * 0.24,
    ];

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setFillColor(235, 238, 242);
    pdf.rect(PAGE_MARGIN, cursorY, contentWidth, 8, 'F');

    let x = PAGE_MARGIN;
    headers.forEach((h, i) => {
      pdf.text(h, x + 2, cursorY + 6);
      x += colWidths[i];
    });

    cursorY += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    allAppointments.forEach(row => {
      const rowHeight = 10;
      checkPageBreak(rowHeight);

      let cx = PAGE_MARGIN;
      [row.institution, row.type, row.position, row.personName].forEach((cell, i) => {
        pdf.text(cell, cx + 2, cursorY + 7, { maxWidth: colWidths[i] - 4 });
        cx += colWidths[i];
      });

      pdf.setDrawColor(220);
      pdf.line(PAGE_MARGIN, cursorY + rowHeight, PAGE_MARGIN + contentWidth, cursorY + rowHeight);
      cursorY += rowHeight;
    });
  }

  /* ======================
     NUMERACIÓN
  ====================== */

  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setTextColor(140);
    pdf.text(
      `Página ${i} de ${totalPages}`,
      pdfWidth - PAGE_MARGIN,
      pdfHeight - 10,
      { align: 'right' }
    );
  }

  return pdf.output('blob');
};
