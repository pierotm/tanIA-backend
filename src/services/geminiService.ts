import { Relevance, type AnalysisResult } from "../types/domainTypes";
import { GoogleGenAI, Type } from "@google/genai";


// El acceso a la API Key se maneja a través de variables de entorno según las guías.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeGazetteText = async (pagesText: Array<{ page: number; text: string }>): Promise<AnalysisResult> => {
  // Utilizamos gemini-3-pro-preview para tareas complejas de razonamiento legal.
  const model = "gemini-2.5-flash"; //gemini-2.5-flash
  
  const formattedText = pagesText
    .map(p => `--- PÁGINA ${p.page} ---\n${p.text}\n--- FIN PÁGINA ${p.page} ---`)
    .join('\n\n');

  const systemInstruction = `
    Eres un analista legal experto de alto nivel especializado en la normativa peruana y el sector de Agua y Saneamiento.
    Tu tarea es realizar una curaduría exhaustiva del diario oficial "El Peruano".

    OBJETIVOS:
    1. Identificar la fecha de publicación principal.
    2. Extraer normas con impacto en el sector Agua y Saneamiento (tarifas, infraestructura, gestión de recursos hídricos, reglamentos de SUNASS, MVCS, ANA).
    3. Monitorizar movimientos de cargos de confianza y directivos en todo el aparato estatal.

    REGLAS DE CLASIFICACIÓN (Agua y Saneamiento):
    - ALTA: Normas de SUNASS, MVCS (Vivienda y Saneamiento), ANA, OTASS o decretos que afecten directamente la gestión del agua.
    - MEDIA: Normas generales de presupuesto, contrataciones del Estado o medio ambiente que afecten indirectamente.
    - BAJA: Normas administrativas generales.
    - NINGUNA: Normas de otros sectores sin conexión alguna (ej. cultura, defensa sin relación a recursos hídricos).

    FORMATO DE SALIDA:
    Debes responder estrictamente en formato JSON según el esquema proporcionado.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: `Analiza el siguiente texto legal y extrae la información relevante:\n\n${formattedText}`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gazetteDate: { type: Type.STRING, description: "Fecha del diario." },
            norms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sector: { type: Type.STRING },
                  normId: { type: Type.STRING },
                  title: { type: Type.STRING },
                  publicationDate: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  relevanceToWaterSector: {
                    type: Type.STRING,
                    enum: [Relevance.ALTA, Relevance.MEDIA, Relevance.BAJA, Relevance.NINGUNA],
                  },
                  pageNumber: { type: Type.NUMBER },
                },
                required: ["sector", "normId", "title", "publicationDate", "summary", "relevanceToWaterSector", "pageNumber"],
              },
            },
            designatedAppointments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  personName: { type: Type.STRING },
                  position: { type: Type.STRING },
                  summary: { type: Type.STRING },
                },
                required: ["institution", "personName", "position", "summary"],
              },
            },
            concludedAppointments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  institution: { type: Type.STRING },
                  personName: { type: Type.STRING },
                  position: { type: Type.STRING },
                  summary: { type: Type.STRING },
                },
                required: ["institution", "personName", "position", "summary"],
              },
            },
          },
          required: ["gazetteDate", "norms", "designatedAppointments", "concludedAppointments"],
        },
      },
    });

    const parsedResult = JSON.parse(response.text || '{}');
    
    return {
      gazetteDate: parsedResult.gazetteDate || "Fecha no encontrada",
      norms: parsedResult.norms || [],
      designatedAppointments: parsedResult.designatedAppointments || [],
      concludedAppointments: parsedResult.concludedAppointments || []
    } as AnalysisResult;

  } catch (error) {
    console.error("Error en la llamada a Gemini:", error);
    throw new Error("No se pudo completar el análisis legal. Verifique su conexión y API Key.");
  }
};
