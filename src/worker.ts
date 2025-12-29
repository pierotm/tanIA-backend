import fs from "fs";

import { getLatestPdfFromDrive } from "../src/services/driveService"
import { extractTextFromPdf } from "./services/pdfService";
import { analyzeGazetteText } from "../src/services/geminiService"

import {
  generateAnalysisPdfBlob,
  generateCsvBlob
} from "./services/reportGenerator";
import { sendEmailWithAttachments } from './services/gmailService';

(async () => {
  try {
    console.log('PRUEBA DRIVE INICIADA');
    const result = await getLatestPdfFromDrive();
    if (!result) {
      console.log("No hay PDFs para procesar");
      return;
    }

    console.log("Archivo recibido:", result.filename);
    console.log("Extrayendo texto del PDF...");

    const pages = await extractTextFromPdf(result.buffer, (p) =>
      console.log(`Progreso PDF: ${p}%`)
    );

    console.log(`Texto extraído (${pages.length} páginas)`);

    console.log("Analizando con Gemini...");
    const analysis = await analyzeGazetteText(pages);

    console.log("Análisis completado");

    // PDF
    const pdfBlob = generateAnalysisPdfBlob(
      analysis,
      result.filename
    );

    const pdfFileName = `analisis-el-peruano-${analysis.gazetteDate}.pdf`;
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());

    // CSV – Normas Agua y Saneamiento
    console.log('Generando CSV de normas...');
    const normsCsvBlob = generateCsvBlob(
      analysis.norms.filter(n => n.relevanceToWaterSector !== 'Ninguna'),
      {
        sector: 'Sector',
        normId: 'Norma',
        title: 'Título',
        publicationDate: 'Fecha',
        summary: 'Resumen',
        relevanceToWaterSector: 'Relevancia',
        pageNumber: 'Página'
      }
    );

    const normsCsvFileName = `normas-agua-saneamiento-${analysis.gazetteDate}.csv`;
    const normsCsvBuffer = Buffer.from(await normsCsvBlob.arrayBuffer());


    // CSV – Movimientos de cargos
    console.log('Generando CSV de cargos...');
    const appointmentsCsvBlob = generateCsvBlob(
      [...analysis.designatedAppointments, ...analysis.concludedAppointments],
      {
        institution: 'Institución',
        personName: 'Nombre',
        position: 'Cargo',
        summary: 'Resumen'
      }
    );

    const appointmentsCsvFileName = `movimientos-cargos-${analysis.gazetteDate}.csv`;
    const appointmentsCsvBuffer = Buffer.from(await appointmentsCsvBlob.arrayBuffer());

    // Enviar correo con 3 adjuntos
    console.log('Enviando correo...');

    await sendEmailWithAttachments(
      'jbossiob@gmail.com',
      `TanIA, Analisis El Peruano (${analysis.gazetteDate})`,
      `Hola,

Se adjunta el análisis automático del Diario Oficial El Peruano.

Archivos incluidos:
- Reporte PDF
- Normas relevantes (CSV)
- Movimientos de cargos (CSV)

Saludos,
TanIA – El Peruano 2.0`,
      [
        {
          filename: pdfFileName,
          mimeType: 'application/pdf',
          content: pdfBuffer,
        },
        {
          filename: normsCsvFileName,
          mimeType: 'text/csv',
          content: normsCsvBuffer,
        },
        {
          filename: appointmentsCsvFileName,
          mimeType: 'text/csv',
          content: appointmentsCsvBuffer,
        },
      ]
    );

    console.log("TANIA – PIPELINE COMPLETADO");
    
  } catch (error) {
    console.error("Error en el pipeline TanIA:", error);
  }
})();
