import {jsPDF} from 'jspdf';
import { AnalysisResult, Relevance, Appointment } from '../types/domainTypes';

export const generateCsvBlob = (data: any[], headers: Record<string, string>): Blob => {
    const headerKeys = Object.keys(headers);
    const headerValues = Object.values(headers);

    const csvRows = [headerValues.join(',')]; // Header row

    for (const item of data) {
        const values = headerKeys.map(key => {
            const val = item[key] ?? '';
            const escaped = ('' + val).replace(/"/g, '""'); // Escape double quotes
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    return new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); // \uFEFF for Excel BOM
};

export const generateAnalysisPdfBlob = (result: AnalysisResult, fileName: string): Blob => {
    const { gazetteDate, norms, designatedAppointments, concludedAppointments } = result;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pdfWidth - margin * 2;
    let cursorY = margin;

    const primaryColor = '#0033A0';
    const secondaryColor = '#334155';
    const lightTextColor = '#64748B';

    // Filter and Sort Norms
    const waterSectorNorms = norms.filter(norm => norm.relevanceToWaterSector !== Relevance.NINGUNA);
    const relevanceOrder: Record<Relevance, number> = {
        [Relevance.ALTA]: 1,
        [Relevance.MEDIA]: 2,
        [Relevance.BAJA]: 3,
        [Relevance.NINGUNA]: 4,
    };
    const sortedWaterSectorNorms = [...waterSectorNorms].sort((a, b) => 
        relevanceOrder[a.relevanceToWaterSector] - relevanceOrder[b.relevanceToWaterSector]
    );

    // --- COVER PAGE ---
    pdf.setFillColor(primaryColor);
    pdf.rect(0, 0, pdfWidth, 60, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.setTextColor('#FFFFFF');
    pdf.text('Análisis de Normas Legales', pdfWidth / 2, 25, { align: 'center' });
    pdf.setFontSize(18);
    pdf.text('Diario Oficial "El Peruano"', pdfWidth / 2, 35, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(14);
    pdf.setTextColor(secondaryColor);
    pdf.text(`Fecha del diario: ${gazetteDate}`, pdfWidth / 2, 100, { align: 'center' });
    pdf.setFontSize(12);
    pdf.setTextColor(lightTextColor);
    pdf.text(`Archivo Analizado: ${fileName}`, pdfWidth / 2, 110, { align: 'center' });
    pdf.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`, pdfWidth / 2, 120, { align: 'center' });
    
    let contentStarted = false;
    
    const startContentPage = () => {
        if (!contentStarted) {
            pdf.addPage();
            cursorY = margin;
            contentStarted = true;
        }
    };

    const checkPageBreak = (neededHeight: number) => {
        if (cursorY + neededHeight > pdfHeight - margin) {
            pdf.addPage();
            cursorY = margin;
            pdf.setFontSize(9);
            pdf.setTextColor(lightTextColor);
            pdf.text('Análisis de Normas Legales - El Peruano', margin, 10);
        }
    };
    
    // --- APPOINTMENTS SECTION ---
    const allAppointments = [
        ...designatedAppointments.map(d => ({ ...d, type: 'Designado' })),
        ...concludedAppointments.map(c => ({ ...c, type: 'Concluido' }))
    ];

    if (allAppointments.length > 0) {
        startContentPage();
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(primaryColor);
        pdf.text('Movimientos de Cargos Públicos', margin, cursorY);
        cursorY += 12;

        const tableHeaders = ['Institución', 'Tipo', 'Cargo', 'Nombre'];
        const colWidths = [contentWidth * 0.3, contentWidth * 0.15, contentWidth * 0.3, contentWidth * 0.25];
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.setFillColor(241, 245, 249);
        pdf.rect(margin, cursorY, contentWidth, 8, 'F');
        let currentX = margin;
        tableHeaders.forEach((header, i) => {
            pdf.text(header, currentX + 2, cursorY + 6);
            currentX += colWidths[i];
        });
        cursorY += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        allAppointments.forEach(appt => {
            const rowData = [ appt.institution, appt.type, appt.position, appt.personName ];
            const lines = rowData.map((text, i) => pdf.splitTextToSize(text, colWidths[i] - 4));
            const rowHeight = Math.max(...lines.map(l => l.length)) * 4 + 4;

            checkPageBreak(rowHeight);

            pdf.setDrawColor(226, 232, 240);
            pdf.line(margin, cursorY + rowHeight, margin + contentWidth, cursorY + rowHeight);

            currentX = margin;
            rowData.forEach((text, i) => {
                pdf.text(text, currentX + 2, cursorY + 5, { maxWidth: colWidths[i] - 4 });
                currentX += colWidths[i];
            });

            cursorY += rowHeight;
        });
    }

    // --- NORMS SECTION (TABLE LAYOUT) ---
    if (sortedWaterSectorNorms.length > 0) {
        startContentPage();
        checkPageBreak(20);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.setTextColor(primaryColor);
        pdf.text('Normas Relevantes para Agua y Saneamiento', margin, cursorY);
        cursorY += 12;

        const tableHeaders = ['Relevancia', 'Sector', 'Detalle de la Norma', 'Pág.'];
        const colWidths = [contentWidth * 0.15, contentWidth * 0.20, contentWidth * 0.55, contentWidth * 0.10];

        const calculateRowHeight = (norm: any) => {
            const cellPadding = 3;
            const lineHeight = 5;
            const smallLineHeight = 4;
            
            pdf.setFont('helvetica', 'normal').setFontSize(9);
            const relevanceLines = pdf.splitTextToSize(norm.relevanceToWaterSector, colWidths[0] - (cellPadding * 2));
            const sectorLines = pdf.splitTextToSize(norm.sector, colWidths[1] - (cellPadding * 2));
            const pageLines = pdf.splitTextToSize(String(norm.pageNumber), colWidths[3] - (cellPadding * 2));
            
            const detailWidth = colWidths[2] - (cellPadding * 2);
            
            pdf.setFont('helvetica', 'bold').setFontSize(9);
            const titleLines = pdf.splitTextToSize(norm.title, detailWidth);
            pdf.setFont('courier', 'normal').setFontSize(8);
            const normIdLines = pdf.splitTextToSize(norm.normId, detailWidth);
            pdf.setFont('helvetica', 'normal').setFontSize(8);
            const summaryLines = pdf.splitTextToSize(norm.summary, detailWidth);
            
            const h1 = relevanceLines.length * lineHeight;
            const h2 = sectorLines.length * lineHeight;
            const h3 = (titleLines.length * lineHeight) + (normIdLines.length * smallLineHeight) + (summaryLines.length * smallLineHeight) + 4; // Add padding
            const h4 = pageLines.length * lineHeight;
            
            return Math.max(h1, h2, h3, h4) + (cellPadding * 2);
        };

        // Draw table header
        pdf.setFont('helvetica', 'bold').setFontSize(10).setFillColor(241, 245, 249).rect(margin, cursorY, contentWidth, 10, 'F');
        let currentX = margin;
        tableHeaders.forEach((header, i) => {
            pdf.text(header, currentX + 3, cursorY + 7);
            currentX += colWidths[i];
        });
        cursorY += 10;

        // Draw table rows
        sortedWaterSectorNorms.forEach(norm => {
            const rowHeight = calculateRowHeight(norm);
            checkPageBreak(rowHeight);
            const rowStartY = cursorY;
            const cellPadding = 3;
            const lineHeight = 5;
            const smallLineHeight = 4;
            
            // --- Column 1: Relevancia ---
            pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(secondaryColor);
            pdf.text(norm.relevanceToWaterSector, margin + cellPadding, rowStartY + lineHeight, { maxWidth: colWidths[0] - (cellPadding * 2) });
            
            // --- Column 2: Sector ---
            pdf.text(norm.sector, margin + colWidths[0] + cellPadding, rowStartY + lineHeight, { maxWidth: colWidths[1] - (cellPadding * 2) });
            
            // --- Column 3: Detalle ---
            let detailY = rowStartY + lineHeight;
            const detailX = margin + colWidths[0] + colWidths[1] + cellPadding;
            const detailWidth = colWidths[2] - (cellPadding * 2);

            pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(secondaryColor);
            const titleLines = pdf.splitTextToSize(norm.title, detailWidth);
            pdf.text(titleLines, detailX, detailY);
            detailY += titleLines.length * lineHeight;

            pdf.setFont('courier', 'normal').setFontSize(8).setTextColor(primaryColor);
            const normIdLines = pdf.splitTextToSize(norm.normId, detailWidth);
            pdf.text(normIdLines, detailX, detailY);
            detailY += normIdLines.length * smallLineHeight + 1;

            pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(lightTextColor);
            const summaryLines = pdf.splitTextToSize(norm.summary, detailWidth);
            pdf.text(summaryLines, detailX, detailY);

            // --- Column 4: Página ---
            pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(secondaryColor);
            pdf.text(String(norm.pageNumber), margin + colWidths[0] + colWidths[1] + colWidths[2] + cellPadding, rowStartY + lineHeight, { align: 'center', maxWidth: colWidths[3] - (cellPadding * 2) });
            
            // --- Row Border ---
            cursorY += rowHeight;
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.line(margin, cursorY, margin + contentWidth, cursorY);
        });
    }
    
    // --- PAGE NUMBERING ---
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setTextColor(lightTextColor);
        if (i > 1) {
            pdf.text('Análisis de Normas Legales - El Peruano', margin, 10);
        }
        pdf.text(`Página ${i} de ${pageCount}`, pdfWidth - margin, pdfHeight - 10, { align: 'right' });
    }

    return pdf.output('blob');
};