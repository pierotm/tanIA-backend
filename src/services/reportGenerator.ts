// ReportGenerator.ts
// ✅ Genera PDF ejecutivo (carátula + tablas) con:
// 1) “Elaborado por: CION – SUNASS” en carátula
// 2) Logo SUNASS (fondo blanco) en esquina inferior derecha de carátula
// 3) Cabecera superior derecha “CION - Sunass” en páginas de contenido

import { jsPDF } from "jspdf";
import { AnalysisResult, Relevance } from "../types/domainTypes";

// =====================================================
// ✅ 1) LOGO SUNASS (AGREGA ESTO MANUALMENTE)
// -----------------------------------------------------
// Opción recomendada: crea un archivo:
//   src/assets/sunassLogoBase64.ts
// con este contenido:
//
//   const SUNASS_LOGO_BASE64 = "data:image/png;base64,....";
//   export default SUNASS_LOGO_BASE64;
//
// Luego descomenta la línea de import de abajo.
// =====================================================

// import SUNASS_LOGO_BASE64 from "../assets/sunassLogoBase64";

// Si aún no lo agregas, deja esto en null y el PDF saldrá sin logo (sin romper).
const SUNASS_LOGO_BASE64: string | null = null;

// =====================================================

export const generateCsvBlob = (data: any[], headers: Record<string, string>): Blob => {
  const headerKeys = Object.keys(headers);
  const headerValues = Object.values(headers);

  const csvRows = [headerValues.join(",")];

  for (const item of data) {
    const values = headerKeys.map((key) => {
      const val = item[key] ?? "";
      const escaped = ("" + val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\n");
  return new Blob([`\uFEFF${csvString}`], { type: "text/csv;charset=utf-8;" });
};

export const generateAnalysisPdfBlob = (result: AnalysisResult, fileName: string): Blob => {
  const { gazetteDate, norms, designatedAppointments, concludedAppointments } = result;

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pdfWidth - margin * 2;
  let cursorY = margin;

  // Paleta sobria (ejecutivo)
  const primaryColor = "#0B3A6A"; // azul institucional (aprox.)
  const secondaryColor = "#334155"; // slate
  const lightTextColor = "#64748B"; // slate-500
  const lineColor = "#E2E8F0"; // slate-200
  const headerBg = "#F1F5F9"; // slate-100

  // Orden de relevancia
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

  // -------------------------------
  // Helpers
  // -------------------------------
  const addHeader = (pageIndex: number) => {
    // No header en carátula (página 1)
    if (pageIndex === 1) return;

    pdf.setDrawColor(lineColor);
    pdf.setLineWidth(0.4);
    pdf.line(margin, 14, pdfWidth - margin, 14);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(lightTextColor);

    // Izquierda
    pdf.text('Análisis de Normas Legales - El Peruano', margin, 11);

    // Derecha (✅ requerido)
    pdf.text("CION - Sunass", pdfWidth - margin, 11, { align: "right" });
  };

  const addFooter = () => {
    const pageCount = pdf.getNumberOfPages();
    const current = pdf.getCurrentPageInfo().pageNumber;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(lightTextColor);
    pdf.text(`Página ${current} de ${pageCount}`, pdfWidth - margin, pdfHeight - 10, { align: "right" });
  };

  const newContentPage = () => {
    pdf.addPage();
    cursorY = margin;
    addHeader(pdf.getCurrentPageInfo().pageNumber);
  };

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pdfHeight - margin - 12) {
      addFooter();
      newContentPage();
    }
  };

  const drawSectionTitle = (title: string, subtitle?: string) => {
    ensureSpace(18);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(primaryColor);
    pdf.text(title, margin, cursorY);

    cursorY += 8;

    if (subtitle) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(lightTextColor);
      pdf.text(subtitle, margin, cursorY);
      cursorY += 8;
    } else {
      cursorY += 4;
    }
  };

  const drawInfoBox = (text: string) => {
    const boxPadding = 6;
    const boxWidth = contentWidth;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(text, boxWidth - boxPadding * 2);
    const boxHeight = lines.length * 5 + boxPadding * 2;

    ensureSpace(boxHeight + 6);

    pdf.setDrawColor(lineColor);
    pdf.setFillColor(...hexToRgb(headerBg));
    pdf.roundedRect(margin, cursorY, boxWidth, boxHeight, 3, 3, "FD");

    pdf.setTextColor(secondaryColor);
    pdf.text(lines, margin + boxPadding, cursorY + boxPadding + 4);

    cursorY += boxHeight + 8;
  };

  function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const bigint = parseInt(full, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }

  const drawBadge = (label: string, x: number, y: number) => {
    const styles: Record<string, { bg: string; fg: string }> = {
      [Relevance.ALTA]: { bg: "#DCFCE7", fg: "#166534" },
      [Relevance.MEDIA]: { bg: "#DBEAFE", fg: "#1D4ED8" },
      [Relevance.BAJA]: { bg: "#FEF9C3", fg: "#854D0E" },
      [Relevance.NINGUNA]: { bg: "#E2E8F0", fg: "#334155" },
    };
    const s = styles[label] ?? styles[Relevance.NINGUNA];

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);

    const paddingX = 3;
    const paddingY = 2;
    const textW = pdf.getTextWidth(label);
    const w = textW + paddingX * 2;
    const h = 6.5;

    const bg = hexToRgb(s.bg);
    const fg = hexToRgb(s.fg);

    pdf.setFillColor(bg[0], bg[1], bg[2]);
    pdf.roundedRect(x, y - h + 1, w, h, 2, 2, "F");

    pdf.setTextColor(fg[0], fg[1], fg[2]);
    pdf.text(label, x + paddingX, y);
    return w;
  };

  const drawCard = (x: number, y: number, w: number, h: number) => {
    pdf.setDrawColor(lineColor);
    pdf.setFillColor(...hexToRgb("#F8FAFC"));
    pdf.roundedRect(x, y, w, h, 3, 3, "FD");
  };

  // -------------------------------
  // ✅ CARÁTULA
  // -------------------------------
  // Fondo superior
  pdf.setFillColor(...hexToRgb(primaryColor));
  pdf.rect(0, 0, pdfWidth, 65, "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor("#FFFFFF");
  pdf.text("Análisis de Normas Legales", pdfWidth / 2, 27, { align: "center" });

  pdf.setFontSize(16);
  pdf.text('Diario Oficial "El Peruano"', pdfWidth / 2, 40, { align: "center" });

  // Metadata
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(13);
  pdf.setTextColor(secondaryColor);
  pdf.text(`Fecha del diario: ${gazetteDate}`, pdfWidth / 2, 95, { align: "center" });

  pdf.setFontSize(11);
  pdf.setTextColor(lightTextColor);
  pdf.text(`Archivo Analizado: ${fileName}`, pdfWidth / 2, 107, { align: "center" });

  const genDate = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  pdf.text(`Generado el: ${genDate}`, pdfWidth / 2, 117, { align: "center" });

  // ✅ 1) Elaborado por
  pdf.setFontSize(11);
  pdf.setTextColor("#334155");
  pdf.text(
    "Elaborado por: Centro de Inteligencia de Operaciones para la Innovación - CION. Sunass",
    pdfWidth / 2,
    132,
    { align: "center" }
  );

  // ✅ 2) Logo SUNASS carátula (inferior derecha)
  // Requiere SUNASS_LOGO_BASE64 (PNG con fondo blanco)
  if (SUNASS_LOGO_BASE64) {
    const logoW = 40;
    const logoH = 18;
    const x = pdfWidth - margin - logoW;
    const y = pdfHeight - 22 - logoH;

    // (opcional) un "panel" blanco para asegurar fondo limpio si el logo tiene transparencia
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(x - 3, y - 3, logoW + 6, logoH + 6, 2, 2, "F");

    pdf.addImage(SUNASS_LOGO_BASE64, "PNG", x, y, logoW, logoH);
  }

  // Pasamos a contenido
  pdf.addPage();
  cursorY = margin;
  addHeader(pdf.getCurrentPageInfo().pageNumber);

  // -------------------------------
  // Resumen ejecutivo
  // -------------------------------
  const movementsCount = (designatedAppointments?.length ?? 0) + (concludedAppointments?.length ?? 0);
  const normsCount = sortedWaterSectorNorms.length;

  drawSectionTitle("Resumen ejecutivo");
  drawInfoBox(
    `Se identificaron ${normsCount} normas relevantes (ALTA/MEDIA/BAJA) y ${movementsCount} movimientos de cargos públicos (designaciones y conclusiones). ` +
      "Las normas se listan priorizadas por nivel de relevancia."
  );

  // -------------------------------
  // Movimientos de cargos (tabla)
  // -------------------------------
  const allAppointments = [
    ...(designatedAppointments ?? []).map((d) => ({ ...d, type: "Designado" })),
    ...(concludedAppointments ?? []).map((c) => ({ ...c, type: "Concluido" })),
  ];

  drawSectionTitle("Movimientos de cargos públicos");

  if (allAppointments.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(lightTextColor);
    pdf.text("No se identificaron movimientos de personal en el cuadernillo analizado.", margin, cursorY);
    cursorY += 10;
  } else {
    // Cabecera tabla
    const colW = [contentWidth * 0.34, contentWidth * 0.12, contentWidth * 0.32, contentWidth * 0.22];
    const headers = ["Institución", "Tipo", "Cargo", "Nombre"];

    const rowPadY = 5;
    const rowLineH = 4.2;

    ensureSpace(14);
    pdf.setFillColor(...hexToRgb(headerBg));
    pdf.rect(margin, cursorY, contentWidth, 9, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(secondaryColor);

    let x = margin;
    headers.forEach((h, i) => {
      pdf.text(h, x + 2, cursorY + 6);
      x += colW[i];
    });

    cursorY += 10;

    // Filas
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(secondaryColor);

    allAppointments.forEach((a, idx) => {
      const cells = [a.institution, a.type, a.position, a.personName].map((t) => String(t ?? ""));
      const wrapped = cells.map((t, i) => pdf.splitTextToSize(t, colW[i] - 4));
      const rowH = Math.max(...wrapped.map((w) => w.length)) * rowLineH + rowPadY;

      ensureSpace(rowH + 2);

      // zebra
      if (idx % 2 === 1) {
        pdf.setFillColor(...hexToRgb("#FBFDFF"));
        pdf.rect(margin, cursorY - 1, contentWidth, rowH + 1, "F");
      }

      // row bottom line
      pdf.setDrawColor(lineColor);
      pdf.setLineWidth(0.2);
      pdf.line(margin, cursorY + rowH, margin + contentWidth, cursorY + rowH);

      // text
      x = margin;
      wrapped.forEach((lines, i) => {
        pdf.text(lines, x + 2, cursorY + 5, { maxWidth: colW[i] - 4 });
        x += colW[i];
      });

      cursorY += rowH;
    });

    cursorY += 8;
  }

  // -------------------------------
  // Normas (tarjetas ejecutivas)
  // -------------------------------
  drawSectionTitle("Normas relevantes para Agua y Saneamiento", "Ordenadas por relevancia (ALTA → MEDIA → BAJA).");

  if (sortedWaterSectorNorms.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(lightTextColor);
    pdf.text("No se identificaron normas relevantes para Agua y Saneamiento (ALTA/MEDIA/BAJA).", margin, cursorY);
    cursorY += 10;
  } else {
    for (const norm of sortedWaterSectorNorms) {
      const cardX = margin;
      const cardW = contentWidth;
      const pad = 8;

      // Altura dinámica
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      const titleLines = pdf.splitTextToSize(norm.title ?? "", cardW - pad * 2);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const summaryLines = pdf.splitTextToSize(norm.summary ?? "", cardW - pad * 2);

      pdf.setFont("courier", "normal");
      pdf.setFontSize(8.5);
      const normIdLines = pdf.splitTextToSize(norm.normId ?? "", cardW - pad * 2);

      const cardH =
        10 + // top area
        8 + // badge line
        titleLines.length * 5 +
        normIdLines.length * 4.2 +
        6 + // meta line
        summaryLines.length * 4 +
        10; // bottom area

      ensureSpace(cardH + 6);

      drawCard(cardX, cursorY, cardW, cardH);

      let y = cursorY + 10;
      const x0 = cardX + pad;

      // Badge + pág
      const badgeW = drawBadge(String(norm.relevanceToWaterSector ?? ""), x0, y);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(lightTextColor);
      pdf.text(`Pág. ${norm.pageNumber ?? ""}`, x0 + badgeW + 6, y);

      y += 8;

      // Título
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(secondaryColor);
      pdf.text(titleLines, x0, y);
      y += titleLines.length * 5;

      // NormId
      pdf.setFont("courier", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(primaryColor);
      pdf.text(normIdLines, x0, y);
      y += normIdLines.length * 4.2 + 1;

      // Meta
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(lightTextColor);
      pdf.text(
        `Sector: ${norm.sector ?? ""}  |  Fecha: ${norm.publicationDate ?? ""}`,
        x0,
        y
      );
      y += 6;

      // Resumen
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(secondaryColor);
      pdf.text(summaryLines, x0, y);

      cursorY += cardH + 6;
    }
  }

  // -------------------------------
  // Numeración + cabecera/footers finales
  // -------------------------------
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    addHeader(i);
    addFooter();
  }

  return pdf.output("blob");
};
