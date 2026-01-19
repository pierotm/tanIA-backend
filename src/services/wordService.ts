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
  AlignmentType,
  ExternalHyperlink
} from "docx";
import { AnalysisResult, Relevance } from "../types/domainTypes";
import { normalizeNormId } from "../utils/normalizeNormId";

export const generateAnalysisWordBuffer = async (
  result: AnalysisResult,
  fileName: string,
  indiceNormas: Record<string, string>
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
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: ["Relevancia", "Sector", "Norma", "Pág."].map(
                        (h) =>
                          new TableCell({
                            children: [p(h, true)],
                          })
                      ),
                    }),
                    ...sortedWaterSectorNorms.map((n) => {
                      const normalizedId = normalizeNormId(n.normId);
                      const link = n.normId ? indiceNormas[normalizedId] : undefined;
                      const normaChildren: (TextRun | ExternalHyperlink)[] = [
                        new TextRun({ text: n.title + "\n", bold: true }),
                      ];
                      if (link) {
                        normaChildren.push(
                          new ExternalHyperlink({
                            children: [
                              new TextRun({ text: n.normId + "\n", color: "1155CC" }),
                            ],
                            link,
                          })
                        );
                      } else {
                        normaChildren.push(new TextRun({ text: n.normId + "\n" }));
                      }
                      normaChildren.push(new TextRun({ text: n.summary }));
                      return new TableRow({
                        children: [
                          new TableCell({
                            children: [p(n.relevanceToWaterSector, true)],
                          }),
                          new TableCell({
                            children: [p(n.sector)],
                          }),
                          new TableCell({
                            children: [new Paragraph({ children: normaChildren })],
                          }),
                          new TableCell({
                            children: [p(String(n.pageNumber))],
                          }),
                        ],
                      });
                    }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
};
