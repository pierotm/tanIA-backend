/*import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  ExternalHyperlink,
  Header,
  Footer,
  PageNumber,
} from "docx";
import { AnalysisResult, Relevance } from "../types/domainTypes";
import { normalizeNormId } from "../utils/normalizeNormId";

export const generateAnalysisWordBuffer = async (
  result: AnalysisResult,
  fileName: string,
  indiceNormas: Record<string, string>
): Promise<Buffer> => {
  const { gazetteDate, norms, designatedAppointments, concludedAppointments } =
    result;

  // ---------------- DATA ----------------
  const waterSectorNorms = norms.filter(
    (n) => n.relevanceToWaterSector !== Relevance.NINGUNA
  );

  const relevanceOrder: Record<Relevance, number> = {
    [Relevance.ALTA]: 1,
    [Relevance.MEDIA]: 2,
    [Relevance.BAJA]: 3,
    [Relevance.NINGUNA]: 4,
  };

  const sortedNorms = [...waterSectorNorms].sort(
    (a, b) =>
      relevanceOrder[a.relevanceToWaterSector] -
      relevanceOrder[b.relevanceToWaterSector]
  );

  const allAppointments = [
    ...designatedAppointments.map((a) => ({ ...a, type: "Designado" })),
    ...concludedAppointments.map((a) => ({ ...a, type: "Concluido" })),
  ];

  const genDate = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const summaryText =
    `Se identificaron ${sortedNorms.length} norma(s) relevante(s) ` +
    `(ALTA/MEDIA/BAJA) y ${allAppointments.length} movimiento(s) ` +
    `de cargos públicos (designaciones y conclusiones).`;

  // ---------------- HELPERS ----------------
  const p = (text: string, bold = false) =>
    new Paragraph({
      children: [new TextRun({ text, bold })],
    });

  const h1 = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    });

  const h2 = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
    });

  const normIdWithLink = (normId: string) => {
    const link = indiceNormas[normalizeNormId(normId)];
    if (!link) return new TextRun({ text: normId });

    return new ExternalHyperlink({
      link,
      children: [
        new TextRun({
          text: normId,
          color: "0563C1",
          underline: {},
        }),
      ],
    });
  };

  // ---------------- DOCUMENT ----------------
  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Análisis de Normas Legales – El Peruano | CION – Sunass",
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: ["Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES],
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // -------- PORTADA --------
          h1("Análisis de Normas Legales"),
          new Paragraph({
            text: 'Diario Oficial "El Peruano"',
            alignment: AlignmentType.CENTER,
          }),
          p(`Fecha del diario: ${gazetteDate}`),
          p(`Archivo analizado: ${fileName}`),
          p(`Generado el: ${genDate}`),
          p(summaryText),
          new Paragraph({ pageBreakBefore: true }),

          // -------- RESUMEN --------
          h2("Resumen ejecutivo"),
          p(summaryText),

          // -------- MOVIMIENTOS --------
          ...(allAppointments.length
            ? [
                h2("Movimientos de cargos públicos"),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: ["Institución", "Tipo", "Cargo", "Nombre"].map(
                        (h) => new TableCell({ children: [p(h, true)] })
                      ),
                    }),
                    ...allAppointments.map(
                      (a) =>
                        new TableRow({
                          children: [
                            p(a.institution),
                            p(a.type),
                            p(a.position),
                            p(a.personName),
                          ].map((c) => new TableCell({ children: [c] })),
                        })
                    ),
                  ],
                }),
              ]
            : []),

          // -------- NORMAS --------
          ...(sortedNorms.length
            ? [
                h2("Normas relevantes para Agua y Saneamiento"),
                p("Ordenadas por relevancia (ALTA → MEDIA → BAJA)."),
                ...sortedNorms.map(
                  (n) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `[${n.relevanceToWaterSector}] `,
                          bold: true,
                        }),
                        new TextRun(`${n.sector}\n`),
                        new TextRun({ text: `${n.title}\n`, bold: true }),
                        normIdWithLink(n.normId),
                        new TextRun(`\n${n.summary}\nPágina: ${n.pageNumber}`),
                      ],
                    })
                ),
              ]
            : []),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
};*/

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType
} from "docx";
import { AnalysisResult, Relevance } from "../types/domainTypes";

export const generateAnalysisWordBuffer = async (
  result: AnalysisResult,
  fileName: string
): Promise<Buffer> => {
  const { gazetteDate, norms, designatedAppointments, concludedAppointments } = result;

  // --- MISMA lógica que PDF ---
  const waterSectorNorms = norms.filter(
    (n) => n.relevanceToWaterSector !== Relevance.NINGUNA
  );

  const relevanceOrder: Record<Relevance, number> = {
    [Relevance.ALTA]: 1,
    [Relevance.MEDIA]: 2,
    [Relevance.BAJA]: 3,
    [Relevance.NINGUNA]: 4,
  };

  const sortedWaterSectorNorms = [...waterSectorNorms].sort(
    (a, b) =>
      relevanceOrder[a.relevanceToWaterSector] -
      relevanceOrder[b.relevanceToWaterSector]
  );

  const allAppointments = [
    ...designatedAppointments.map((d) => ({ ...d, type: "Designado" })),
    ...concludedAppointments.map((c) => ({ ...c, type: "Concluido" })),
  ];

  const nNorms = sortedWaterSectorNorms.length;
  const nAppointments = allAppointments.length;

  const genDate = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const summaryText =
    `Se identificaron ${nNorms} norma(s) relevante(s) (ALTA/MEDIA/BAJA) y ` +
    `${nAppointments} movimiento(s) de cargos públicos (designaciones y conclusiones). ` +
    `Las normas se listan priorizadas por nivel de relevancia.`;

  const p = (text: string, bold = false) =>
    new Paragraph({
      children: [new TextRun({ text, bold })],
    });

  const h1 = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    });

  const h2 = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.HEADING_1,
    });

  const doc = new Document({
    sections: [
      {
        children: [
          // PORTADA
          h1("Análisis de Normas Legales"),
          new Paragraph({
            text: 'Diario Oficial "El Peruano"',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph(""),
          p(`Fecha del diario: ${gazetteDate}`),
          p(`Archivo analizado: ${fileName}`),
          p(`Generado el: ${genDate}`),
          new Paragraph(""),
          p(summaryText),
          new Paragraph({ pageBreakBefore: true }),

          // RESUMEN
          h2("Resumen ejecutivo"),
          p(summaryText),

          // MOVIMIENTOS
          ...(allAppointments.length > 0
            ? [
                h2("Movimientos de cargos públicos"),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: ["Institución", "Tipo", "Cargo", "Nombre"].map(
                        (h) =>
                          new TableCell({
                            children: [p(h, true)],
                          })
                      ),
                    }),
                    ...allAppointments.map(
                      (a) =>
                        new TableRow({
                          children: [
                            a.institution,
                            a.type,
                            a.position,
                            a.personName,
                          ].map(
                            (v) =>
                              new TableCell({
                                children: [p(String(v))],
                              })
                          ),
                        })
                    ),
                  ],
                }),
              ]
            : []),

          // NORMAS
          ...(sortedWaterSectorNorms.length > 0
            ? [
                h2("Normas relevantes para Agua y Saneamiento"),
                p("Ordenadas por relevancia (ALTA → MEDIA → BAJA)."),
                ...sortedWaterSectorNorms.map((n) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `[${n.relevanceToWaterSector}] `,
                        bold: true,
                      }),
                      new TextRun({ text: `${n.sector}\n` }),
                      new TextRun({
                        text: `${n.title}\n`,
                        bold: true,
                      }),
                      new TextRun({ text: `${n.normId}\n` }),
                      new TextRun({ text: `${n.summary}\n` }),
                      new TextRun({ text: `Página: ${n.pageNumber}` }),
                    ],
                  })
                ),
              ]
            : []),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
};
