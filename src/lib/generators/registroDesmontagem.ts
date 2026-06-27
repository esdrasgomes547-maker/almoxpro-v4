import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign, ImageRun
} from 'docx'

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface ItemDesmontagem {
  qtd?: string
  unid?: string
  descricao: string
}

export interface DadosDesmontagem {
  cliente?: string
  responsavel?: string
  itens?: ItemDesmontagem[]
}

// ── Constantes visuais ─────────────────────────────────────────────────────
const C = {
  AZUL:         '1A3260',
  CINZA_HEADER: 'E8E8E8',
  CINZA_ZEBRA:  'F5F5F5',
  BRANCO:       'FFFFFF',
  PRETO:        '111111',
  TOTAL:        9200,
  LINHAS_MIN:   35,
} as const

// ── Bordas ─────────────────────────────────────────────────────────────────
const bFina  = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const bMedia = { style: BorderStyle.SINGLE, size: 8, color: C.AZUL }
const bordas = { top: bFina, bottom: bFina, left: bFina, right: bFina }
const bordasM = { top: bMedia, bottom: bMedia, left: bMedia, right: bMedia }

// ── Helper: célula de texto ────────────────────────────────────────────────
interface CelOpts {
  bold?: boolean; size?: number; color?: string; fill?: string
  span?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]
  vAlign?: any
  brd?: object; width?: number
}
function cel(texto: string, opts: CelOpts = {}) {
  const {
    bold = false, size = 18, color = C.PRETO, fill = C.BRANCO,
    span = 1, align = AlignmentType.LEFT, vAlign = VerticalAlign.CENTER,
    brd = bordas, width,
  } = opts
  return new TableCell({
    columnSpan: span, borders: brd as any,
    shading: { fill, type: ShadingType.CLEAR },
    verticalAlign: vAlign,
    ...(width && { width: { size: width, type: WidthType.DXA } }),
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: texto, bold, size, color, font: 'Arial' })]
    })]
  })
}

// ── Helper: célula de imagem ───────────────────────────────────────────────
function celImg(
  imgBuf: ArrayBuffer | Uint8Array, w: number, h: number,
  width?: number, brd: object = bordas
) {
  return new TableCell({
    borders: brd as any,
    shading: { fill: C.BRANCO, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    ...(width && { width: { size: width, type: WidthType.DXA } }),
    margins: { top: 60, bottom: 60, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new ImageRun({ data: imgBuf as any, transformation: { width: w, height: h }, type: 'png' })]
    })]
  })
}

// ── Helper: linha de item ──────────────────────────────────────────────────
function linhaItem(item: ItemDesmontagem, idx: number) {
  const fill = idx % 2 === 0 ? C.CINZA_ZEBRA : C.BRANCO
  const c = (txt: string, align: any, w: number) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders: bordas,
    shading: { fill, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: txt, size: 18, font: 'Arial', color: C.PRETO })]
    })]
  })
  return new TableRow({ height: { value: 310, rule: 'atLeast' }, children: [
    c(item.qtd  || '', AlignmentType.CENTER, 700),
    c(item.unid || '', AlignmentType.CENTER, 700),
    c(item.descricao, AlignmentType.LEFT, 7800),
  ]})
}

// ── Helper: bloco de seção (título azul) ──────────────────────────────────
function secao(titulo: string) {
  return new Table({
    width: { size: C.TOTAL, type: WidthType.DXA }, columnWidths: [C.TOTAL],
    rows: [new TableRow({ height: { value: 300, rule: 'exact' }, children: [
      cel(titulo, { bold: true, size: 17, fill: C.AZUL, color: C.BRANCO, width: C.TOTAL })
    ]})]
  })
}

// ── GERADOR PRINCIPAL ──────────────────────────────────────────────────────
export async function gerarRegistroDesmontagem(
  dados: DadosDesmontagem,
  logoTecgas: ArrayBuffer,
  logoNacional: ArrayBuffer
): Promise<Blob> {

  const cliente    = dados.cliente    ?? ''
  const responsavel = dados.responsavel ?? 'TECGAS'

  // Garantir mínimo de linhas
  const linhas: ItemDesmontagem[] = [...(dados.itens ?? [])]
  while (linhas.length < C.LINHAS_MIN) linhas.push({ descricao: '' })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 600, right: 700, bottom: 600, left: 700 }
        }
      },
      children: [

        // ── CABEÇALHO ──
        new Table({
          width: { size: C.TOTAL, type: WidthType.DXA },
          columnWidths: [2000, 5200, 2000],
          rows: [
            new TableRow({ height: { value: 900, rule: 'exact' }, children: [
              celImg(logoTecgas, 140, 60, 2000, {
                top: bMedia, bottom: bMedia, left: bMedia,
                right: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' }
              }),
              new TableCell({
                width: { size: 5200, type: WidthType.DXA },
                borders: { top: bMedia, bottom: bMedia,
                  left: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
                  right: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' }
                } as any,
                shading: { fill: C.BRANCO, type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 60, bottom: 60, left: 120, right: 120 },
                children: [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [
                    new TextRun({ text: 'DOCUMENTO DE REGISTRO DE MATERIAL', bold: true, size: 21, font: 'Arial', color: C.AZUL })
                  ]}),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 40 }, children: [
                    new TextRun({ text: 'DESMONTAGEM', bold: true, size: 26, font: 'Arial', color: C.AZUL })
                  ]}),
                  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60 }, children: [
                    new TextRun({ text: 'SETOR: ALMOXARIFADO', size: 16, font: 'Arial', color: '555555' })
                  ]}),
                ]
              }),
              celImg(logoNacional, 145, 36, 2000, {
                top: bMedia, bottom: bMedia, right: bMedia,
                left: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' }
              }),
            ]}),

            // Cliente / Responsável
            new TableRow({ height: { value: 360, rule: 'atLeast' }, children: [
              new TableCell({
                columnSpan: 2, width: { size: 7200, type: WidthType.DXA },
                borders: bordas, shading: { fill: C.CINZA_HEADER, type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 50, bottom: 50, left: 120, right: 80 },
                children: [new Paragraph({ children: [
                  new TextRun({ text: 'CLIENTE:  ', bold: true, size: 18, font: 'Arial', color: C.AZUL }),
                  new TextRun({ text: cliente, size: 18, font: 'Arial', color: C.PRETO }),
                ]})]
              }),
              new TableCell({
                width: { size: 2000, type: WidthType.DXA },
                borders: bordas, shading: { fill: C.CINZA_HEADER, type: ShadingType.CLEAR },
                verticalAlign: VerticalAlign.CENTER,
                margins: { top: 50, bottom: 50, left: 80, right: 80 },
                children: [new Paragraph({ children: [
                  new TextRun({ text: 'RESPONSÁVEL:  ', bold: true, size: 16, font: 'Arial', color: C.AZUL }),
                  new TextRun({ text: responsavel, size: 16, font: 'Arial', color: C.PRETO }),
                ]})]
              }),
            ]}),
          ]
        }),

        // ── TABELA DE ITENS ──
        new Table({
          width: { size: C.TOTAL, type: WidthType.DXA },
          columnWidths: [700, 700, 7800],
          rows: [
            new TableRow({ height: { value: 380, rule: 'exact' }, children: [
              cel('QTD.',      { bold: true, size: 18, fill: C.AZUL, color: C.BRANCO, align: AlignmentType.CENTER, width: 700 }),
              cel('UNID.',     { bold: true, size: 18, fill: C.AZUL, color: C.BRANCO, align: AlignmentType.CENTER, width: 700 }),
              cel('DESCRIÇÃO', { bold: true, size: 18, fill: C.AZUL, color: C.BRANCO, align: AlignmentType.CENTER, width: 7800 }),
            ]}),
            ...linhas.map((it, i) => linhaItem(it, i)),
          ]
        }),

        // ── OBSERVAÇÕES ──
        secao('OBSERVAÇÕES:'),
        new Table({
          width: { size: C.TOTAL, type: WidthType.DXA }, columnWidths: [C.TOTAL],
          rows: Array(4).fill(null).map(() =>
            new TableRow({ height: { value: 280, rule: 'exact' }, children: [cel('', { width: C.TOTAL })] })
          )
        }),

        // ── DADOS DO ACOMPANHANTE ──
        secao('DADOS DO ACOMPANHANTE:'),
        new Table({
          width: { size: C.TOTAL, type: WidthType.DXA },
          columnWidths: [2800, 2000, 1900, 2500],
          rows: [
            new TableRow({ height: { value: 260, rule: 'exact' }, children: [
              cel('NOME:',     { bold: true, size: 16, fill: C.CINZA_HEADER, color: C.AZUL, width: 2800 }),
              cel('FUNÇÃO:',   { bold: true, size: 16, fill: C.CINZA_HEADER, color: C.AZUL, width: 2000 }),
              cel('DATA:',     { bold: true, size: 16, fill: C.CINZA_HEADER, color: C.AZUL, width: 1900 }),
              cel('RG / CPF:', { bold: true, size: 16, fill: C.CINZA_HEADER, color: C.AZUL, width: 2500 }),
            ]}),
            new TableRow({ height: { value: 500, rule: 'exact' }, children: [
              cel('', { width: 2800 }), cel('', { width: 2000 }),
              cel('', { width: 1900 }), cel('', { width: 2500 }),
            ]}),
          ]
        }),

        // ── RECIBO DE ENTRADA ──
        secao('RECIBO DE ENTRADA'),
        new Table({
          width: { size: C.TOTAL, type: WidthType.DXA },
          columnWidths: [2300, 2300, 2300, 2300],
          rows: [
            new TableRow({ height: { value: 680, rule: 'exact' }, children: [
              cel('', { width: 2300 }), cel('', { width: 2300 }),
              cel('', { width: 2300 }), cel('', { width: 2300 }),
            ]}),
            new TableRow({ height: { value: 280, rule: 'exact' }, children: [
              cel('TÉCNICO (Nome)',       { bold: true, size: 15, fill: C.CINZA_HEADER, color: C.AZUL, align: AlignmentType.CENTER, width: 2300 }),
              cel('AUXILIAR (TECGAS)',    { bold: true, size: 15, fill: C.CINZA_HEADER, color: C.AZUL, align: AlignmentType.CENTER, width: 2300 }),
              cel('ALMOXARIFE (TECGAS)',  { bold: true, size: 15, fill: C.CINZA_HEADER, color: C.AZUL, align: AlignmentType.CENTER, width: 2300 }),
              cel('DATA DE RECEBIMENTO:', { bold: true, size: 15, fill: C.CINZA_HEADER, color: C.AZUL, align: AlignmentType.CENTER, width: 2300 }),
            ]}),
          ]
        }),

        // ── RODAPÉ ──
        new Table({
          width: { size: C.TOTAL, type: WidthType.DXA }, columnWidths: [C.TOTAL],
          rows: [new TableRow({ height: { value: 300, rule: 'exact' }, children: [
            new TableCell({
              width: { size: C.TOTAL, type: WidthType.DXA }, borders: bordasM,
              shading: { fill: C.AZUL, type: ShadingType.CLEAR },
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 50, bottom: 50, left: 80, right: 80 },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
                new TextRun({ text: 'TEL: 91 9 9106-1011  (WHATSAPP)', bold: true, size: 16, color: C.BRANCO, font: 'Arial' })
              ]})]
            })
          ]})]
        }),

      ]
    }]
  })

  return await Packer.toBlob(doc)
}
