import { Buffer } from 'buffer';
import { getLatestPdfFromDrive, getAllPdfBlocksFromDrive, getLatestIndiceNormasFromDrive } from "./services/driveService"
import { extractTextFromPdf } from "./services/pdfService";
import { analyzeGazetteText } from "./services/geminiService"
import { AnalysisResult, Norm, Appointment } from "./types/domainTypes";
import { generateAnalysisWordBuffer } from "./services/wordService";

import {
  generateAnalysisPdfBlob,
  generateCsvBlob
} from "./services/reportGenerator";
import { sendEmailWithAttachments } from './services/gmailService';

/**
 * Consolida múltiples resultados de análisis en uno solo.
 * Elimina duplicados y unifica semánticamente la información.
 */
function consolidateAnalysisResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 0) {
    return {
      gazetteDate: "Fecha no encontrada",
      norms: [],
      designatedAppointments: [],
      concludedAppointments: []
    };
  }

  // La fecha principal es del último bloque (más reciente)
  const gazetteDate = results[results.length - 1].gazetteDate;

  // --- Consolidación de normas: deduplicar por normId ---
  const normsMap = new Map<string, Norm>();
  for (const result of results) {
    for (const norm of result.norms) {
      const key = norm.normId;
      if (!normsMap.has(key)) {
        normsMap.set(key, norm);
      }
      // Si ya existe, mantener la primera ocurrencia
      // (asumimos que bloques posteriores pueden tener info duplicada)
    }
  }
  const consolidatedNorms = Array.from(normsMap.values());

  // --- Consolidación de cargos: deduplicar por (institution, personName, position) ---
  const appointmentKey = (a: Appointment): string =>
    `${a.institution}|${a.personName}|${a.position}`;

  const designatedMap = new Map<string, Appointment>();
  for (const result of results) {
    for (const appt of result.designatedAppointments) {
      const key = appointmentKey(appt);
      if (!designatedMap.has(key)) {
        designatedMap.set(key, appt);
      }
    }
  }

  const concludedMap = new Map<string, Appointment>();
  for (const result of results) {
    for (const appt of result.concludedAppointments) {
      const key = appointmentKey(appt);
      if (!concludedMap.has(key)) {
        concludedMap.set(key, appt);
      }
    }
  }

  return {
    gazetteDate,
    norms: consolidatedNorms,
    designatedAppointments: Array.from(designatedMap.values()),
    concludedAppointments: Array.from(concludedMap.values())
  };
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Obtiene todos los PDFs de un patrón específico.
 * Por ahora, retorna el último PDF disponible en Drive.
 * En el futuro, puede adaptarse para obtener múltiples PDFs de un cuadernillo.
 */
async function getPdfsToProcess(): Promise<Array<{ buffer: Buffer; filename: string }>> {
  /*const result = await getLatestPdfFromDrive();
  if (!result) {
    return [];
  }
  return [result];*/
  
  // Nota: Para procesamiento futuro de múltiples bloques:
  return await getAllPdfBlocksFromDrive(); // sería una función expandida en driveService
}

async function analyzeWithRetry(
  pages: Array<{ page: number; text: string }>,
  maxRetries = 3
): Promise<AnalysisResult> {
  let attempt = 0;
  let delayMs = 5000;

  while (true) {
    try {
      return await analyzeGazetteText(pages);
    } catch (error: any) {
      attempt++;

      const status = error?.status || error?.code;
      const isRetryable =
        status === 503 ||
        status === 'UNAVAILABLE' ||
        error.message?.includes('overloaded') ||
        error.message?.includes('fetch failed');

      if (!isRetryable || attempt > maxRetries) {
        throw error;
      }

      console.warn(
        `Gemini saturado (intento ${attempt}/${maxRetries}). Reintentando en ${delayMs / 1000}s...`
      );

      await delay(delayMs);
      delayMs *= 2; // backoff exponencial
    }
  }
}

(async () => {
  try {
    console.log('TANIA – INICIANDO PIPELINE DE PROCESAMIENTO');
    
    console.log("Cargando indice de normas desde Drive...");
    const indiceNormas = await getLatestIndiceNormasFromDrive();
    console.log(`Indice cargado (${Object.keys(indiceNormas).length} normas)`);

    const pdfsToParse = await getPdfsToProcess();
    if (pdfsToParse.length === 0) {
      console.log("No hay PDFs para procesar");
      return;
    }

    console.log(`Se encontraron ${pdfsToParse.length} PDF(s) para procesar`);

    const analysisResults: AnalysisResult[] = [];

    // Procesar cada PDF por bloques
    for (let i = 0; i < pdfsToParse.length; i++) {
      const { buffer, filename } = pdfsToParse[i];
      console.log(`\n[${i + 1}/${pdfsToParse.length}] Procesando: ${filename}`);

      console.log("Extrayendo texto del PDF...");
      const pages = await extractTextFromPdf(buffer, (p) =>
        console.log(`  Progreso: ${p}%`)
      );
      console.log(`Texto extraído (${pages.length} páginas)`);

      console.log("Analizando con Gemini...");
      const analysis = await analyzeWithRetry(pages);
      analysisResults.push(analysis);
      
      await delay(5000);

      console.log(`Análisis completado. Normas: ${analysis.norms.length}, Cargos: ${analysis.designatedAppointments.length + analysis.concludedAppointments.length}`);
    }

    // Consolidar todos los análisis en uno solo
    console.log("\nConsolidando resultados...");
    const consolidatedAnalysis = consolidateAnalysisResults(analysisResults);
    console.log(`Resultado consolidado: ${consolidatedAnalysis.norms.length} normas únicas, ${consolidatedAnalysis.designatedAppointments.length + consolidatedAnalysis.concludedAppointments.length} cargos únicos`);

    // Generar PDF del análisis consolidado
    const pdfBlob = generateAnalysisPdfBlob(
      consolidatedAnalysis,
      pdfsToParse.length > 1 
        ? `cuadernillo-${pdfsToParse.length}-bloques` 
        : pdfsToParse[0].filename,
      indiceNormas
    );

    const pdfFileName = `analisis-el-peruano-${consolidatedAnalysis.gazetteDate}.pdf`;
    const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());


    // WORD – Reporte institucional (mismo contenido que el PDF)
    console.log("Generando Word del análisis...");
    const wordBuffer = await generateAnalysisWordBuffer(
      consolidatedAnalysis,
      pdfsToParse.length > 1
        ? `cuadernillo-${pdfsToParse.length}-bloques`
        : pdfsToParse[0].filename,
      indiceNormas
    );
    const wordFileName = `analisis-el-peruano-${consolidatedAnalysis.gazetteDate}.docx`;


    // CSV – Normas Agua y Saneamiento (solo relevantes)
    console.log('Generando CSV de normas...');
    const normsCsvBlob = generateCsvBlob(
      consolidatedAnalysis.norms.filter(n => n.relevanceToWaterSector !== 'Ninguna'),
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

    const normsCsvFileName = `normas-agua-saneamiento-${consolidatedAnalysis.gazetteDate}.csv`;
    const normsCsvBuffer = Buffer.from(await normsCsvBlob.arrayBuffer());

    // CSV – Movimientos de cargos
    console.log('Generando CSV de cargos...');
    const appointmentsCsvBlob = generateCsvBlob(
      [...consolidatedAnalysis.designatedAppointments, ...consolidatedAnalysis.concludedAppointments],
      {
        institution: 'Institución',
        personName: 'Nombre',
        position: 'Cargo',
        summary: 'Resumen'
      }
    );

    const appointmentsCsvFileName = `movimientos-cargos-${consolidatedAnalysis.gazetteDate}.csv`;
    const appointmentsCsvBuffer = Buffer.from(await appointmentsCsvBlob.arrayBuffer());

    // Enviar correo con 4 adjuntos
    console.log('Enviando correo...');

    await sendEmailWithAttachments(
      'jbossiob@gmail.com',
      `TanIA, Analisis El Peruano (${consolidatedAnalysis.gazetteDate})`,
      `Hola,

Se adjunta el análisis automático del Diario Oficial El Peruano.

Archivos incluidos:
- Reporte PDF
- Report Word (Editable)
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
          filename: wordFileName,
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          content: wordBuffer,
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

    console.log("\nTANIA – PIPELINE COMPLETADO EXITOSAMENTE");
    
  } catch (error) {
    console.error("Error en el pipeline TanIA:", error);
  }
})();
