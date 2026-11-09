import { jsPDF } from 'jspdf';
import autoTable, { RowInput, UserOptions } from 'jspdf-autotable';
import { RelatorioTecnico } from '../types/relatorio';
import {
  calcularParametrosStepDrawdownSEMA,
  fmtNumeroSEMA,
} from '../components/StepDrawdownSection';
import {
  EquacaoLivroSpec,
  construirEquacoesLivroRelatorio,
  capturarFormulaSVGParaImagemPDF,
} from '../components/MathFormulaBlock';

export type RGBTuple = [number, number, number];

/**
 * Interface das constantes configuráveis para geração de PDF A4
 * seguindo rigorosamente o layout corporativo e as normas ABNT
 * (ABNT NBR 10719, NBR 14724, NBR 12212 e NBR 12244).
 */
export interface ConfiguracaoLayoutPDFA4 {
  pagina: {
    orientacao: 'portrait' | 'landscape';
    unidade: 'mm';
    formato: 'a4';
    larguraMm: number;
    alturaMm: number;
    compressao: boolean;
  };
  margens: {
    superiorMm: number;
    inferiorMm: number;
    esquerdaMm: number;
    direitaMm: number;
    alturaTimbreCabecalhoMm: number;
    alturaRodapeMm: number;
    topoCorpoTecnicoMm: number;
    baseCorpoTecnicoMm: number;
  };
  cabecalho: {
    razaoSocialPadrao: string;
    cnpjPadrao: string;
    enderecoPadrao: string;
    cidadeContatoPadrao: string;
    emailPadrao: string;
    logoLarguraMm: number;
    logoAlturaMm: number;
    exibirTimbreNaFolhaDeRosto: boolean;
  };
  rodape: {
    cidadeSedePadrao: string;
    normasTecnicasPadrao: string;
    contarFolhaDeRostoNaPaginacao: boolean;
    exibirNumeracaoNaFolhaDeRosto: boolean;
    alturaFaixaMm: number;
    posicaoYTextoMm: number;
    posicaoYLinhaMm: number;
  };
  tipografia: {
    familiaPadrao: 'helvetica';
    tamanhoTituloCapaPt: number;
    tamanhoSubtituloCapaPt: number;
    tamanhoBarraSecaoPt: number;
    tamanhoCabecalhoTabelaPt: number;
    tamanhoCorpoTabelaPt: number;
    tamanhoRodapePt: number;
  };
  cores: {
    navy: RGBTuple;
    navyInstitucional: RGBTuple;
    amber: RGBTuple;
    green: RGBTuple;
    red: RGBTuple;
    white: RGBTuple;
    textDark: RGBTuple;
    textMuted: RGBTuple;
    zebraPar: RGBTuple;
    zebraImpar: RGBTuple;
    bordaTabela: RGBTuple;
    fundoDestaque: RGBTuple;
    fundoConformidade: RGBTuple;
  };
}

/**
 * Constantes configuráveis globais para o documento A4 Corporativo / ABNT.
 * Centraliza margens, reservas de cabeçalho/rodapé, tipografia e paleta institucional.
 */
export const CONFIG_LAYOUT_PDF_A4: Readonly<ConfiguracaoLayoutPDFA4> = {
  pagina: {
    orientacao: 'portrait',
    unidade: 'mm',
    formato: 'a4',
    larguraMm: 210,
    alturaMm: 297,
    compressao: true,
  },
  margens: {
    superiorMm: 14,
    inferiorMm: 14,
    esquerdaMm: 14,
    direitaMm: 14,
    alturaTimbreCabecalhoMm: 29,
    alturaRodapeMm: 12,
    topoCorpoTecnicoMm: 45, // Reserva superior (14mm + 29mm timbre + 2mm respiro)
    baseCorpoTecnicoMm: 18, // Reserva inferior (12mm rodapé + 6mm respiro)
  },
  cabecalho: {
    razaoSocialPadrao: 'HIDROGEO ENGENHARIA E POÇOS ARTESIANOS LTDA.',
    cnpjPadrao: '18.492.310/0001-54',
    enderecoPadrao: 'Av. Presidente Vargas, 2140 – Sala 804 – Jardim Sumaré',
    cidadeContatoPadrao:
      'Ribeirão Preto-SP / CEP 14025-700 / Tel.: (16) 3911-8420 / Cel.: (16) 99714-5200',
    emailPadrao: 'engenharia@hidrogeopocos.com.br',
    logoLarguraMm: 52.5,
    logoAlturaMm: 15.5,
    exibirTimbreNaFolhaDeRosto: true,
  },
  rodape: {
    cidadeSedePadrao: 'RIBEIRÃO PRETO-SP',
    normasTecnicasPadrao: 'ABNT NBR 12212, NBR 12244 & NBR 10719',
    contarFolhaDeRostoNaPaginacao: true,
    exibirNumeracaoNaFolhaDeRosto: false, // Pela ABNT NBR 14724/10719 a folha de rosto é contada, mas o número só é impresso a partir do corpo textual
    alturaFaixaMm: 11,
    posicaoYTextoMm: 291.5,
    posicaoYLinhaMm: 286.5,
  },
  tipografia: {
    familiaPadrao: 'helvetica',
    tamanhoTituloCapaPt: 14,
    tamanhoSubtituloCapaPt: 9.5,
    tamanhoBarraSecaoPt: 8.6,
    tamanhoCabecalhoTabelaPt: 7.5,
    tamanhoCorpoTabelaPt: 7.8,
    tamanhoRodapePt: 7.2,
  },
  cores: {
    navy: [27, 42, 59],
    navyInstitucional: [0, 0, 128],
    amber: [232, 160, 32],
    green: [39, 174, 96],
    red: [220, 38, 38],
    white: [255, 255, 255],
    textDark: [27, 42, 59],
    textMuted: [107, 122, 141],
    zebraPar: [245, 247, 250],
    zebraImpar: [255, 255, 255],
    bordaTabela: [221, 227, 236],
    fundoDestaque: [248, 250, 252],
    fundoConformidade: [242, 250, 244],
  },
};

/**
 * Sanitiza qualquer string para o conjunto de caracteres ISO-8859-1 / WinAnsi (código <= 255)
 * suportado nativamente pelas fontes padrão do jsPDF (Helvetica / Times), evitando que caracteres
 * Unicode (> 255, como '−', 'Δ', '₁', '₀', '⇒', '•', '⁵', 'η') forcem codificação UTF-16 de 2 bytes
 * e façam o texto ultrapassar a margem direita da área imprimível A4.
 */
export function sanitizarTextoWinAnsiPDF(texto: string): string {
  if (!texto) return '';
  const substituido = texto
    .replace(/\r\n/g, '\n')
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '\u00B7') // bullets -> ponto médio ISO-8859-1 (·)
    .replace(/(^|\n)\s*\u00B7\s*/g, '$1- ') // no início de linha usa hífen limpo
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-') // traços e sinal de menos matemático -> '-'
    .replace(/[\u21D2\u27F9]/g, '=>') // setas duplas -> '=>'
    .replace(/[\u2192\u27F6]/g, '->') // setas simples -> '->'
    .replace(/[\u0394\u2206]\s*s\s*[\u2081][\u2080]/g, 'Delta s10')
    .replace(/[\u0394\u2206]\s*s/g, 'Delta s')
    .replace(/[\u0394\u2206]/g, 'Delta ')
    .replace(/\u03B7/g, 'n') // eta -> n
    .replace(/\u03C0/g, 'pi')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/\u2248/g, '~')
    .replace(/\u2260/g, '!=')
    .replace(/\u2080/g, '0')
    .replace(/\u2081/g, '1')
    .replace(/\u2082/g, '2')
    .replace(/\u2083/g, '3')
    .replace(/\u2084/g, '4')
    .replace(/\u2085/g, '5')
    .replace(/\u2086/g, '6')
    .replace(/\u2087/g, '7')
    .replace(/\u2088/g, '8')
    .replace(/\u2089/g, '9')
    .replace(/\u2070/g, '^0')
    .replace(/\u2074/g, '^4')
    .replace(/\u2075/g, '^5')
    .replace(/\u2076/g, '^6')
    .replace(/\u2077/g, '^7')
    .replace(/\u2078/g, '^8')
    .replace(/\u2079/g, '^9')
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[\u2713\u2714]/g, '[OK]');

  let resultado = '';
  for (let i = 0; i < substituido.length; i++) {
    const code = substituido.charCodeAt(i);
    if (code <= 255) {
      resultado += substituido[i];
    } else {
      // Remove diacríticos ou substitui caractere fora de Latin-1 por equivalente ASCII
      const decomposto = substituido[i]
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      for (let j = 0; j < decomposto.length; j++) {
        if (decomposto.charCodeAt(j) <= 255) {
          resultado += decomposto[j];
        }
      }
    }
  }
  return resultado;
}

export function valOuPreencherPDF(
  valor: string | undefined | null,
  fallback = '[DADO A PREENCHER EM CAMPO]'
): string {
  if (!valor) return sanitizarTextoWinAnsiPDF(fallback);
  const limpo = valor.trim();
  if (!limpo || limpo === '—' || limpo === '-' || limpo.toUpperCase() === 'N/I') {
    return sanitizarTextoWinAnsiPDF(fallback);
  }
  return sanitizarTextoWinAnsiPDF(limpo);
}

export function formatarDataBR(dataIso: string): string {
  if (!dataIso || !dataIso.trim() || dataIso.trim() === '—') {
    return '13/03/2026';
  }
  const partes = dataIso.trim().split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return sanitizarTextoWinAnsiPDF(dataIso);
}

interface JsPDFComAutoTable extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

/**
 * Classe utilitária responsável por construir e exportar o Relatório Técnico em PDF A4
 * utilizando `jsPDF` e `jspdf-autotable`.
 *
 * Responsabilidades:
 * 1. Aplicar cabeçalho institucional, rodapé normativo, numeração de páginas e margens A4 via constantes configuráveis (`CONFIG_LAYOUT_PDF_A4`).
 * 2. Separar estritamente a Folha de Rosto (Página 1 — Padrão Corporativo e ABNT NBR 10719 / NBR 14724) do Corpo Técnico do Relatório (Página 2 em diante).
 * 3. Renderizar todas as tabelas de dados cadastrais, construtivos, hidrodinâmicos, quantitativos, checklist e planilhas de bombeamento via `autoTable`.
 */
export class RelatorioPDFExporter {
  private readonly doc: JsPDFComAutoTable;
  private readonly relatorio: RelatorioTecnico;
  private readonly config: ConfiguracaoLayoutPDFA4;
  private cursorY: number;
  private readonly formulasCapturadas = new Map<
    string,
    { dataUrl: string; widthMm: number; heightMm: number }
  >();

  constructor(
    relatorio: RelatorioTecnico,
    customConfig?: Partial<ConfiguracaoLayoutPDFA4>
  ) {
    this.relatorio = relatorio;
    this.config = {
      ...CONFIG_LAYOUT_PDF_A4,
      ...customConfig,
      pagina: {
        ...CONFIG_LAYOUT_PDF_A4.pagina,
        ...(customConfig?.pagina || {}),
      },
      margens: {
        ...CONFIG_LAYOUT_PDF_A4.margens,
        ...(customConfig?.margens || {}),
      },
      cabecalho: {
        ...CONFIG_LAYOUT_PDF_A4.cabecalho,
        ...(customConfig?.cabecalho || {}),
      },
      rodape: {
        ...CONFIG_LAYOUT_PDF_A4.rodape,
        ...(customConfig?.rodape || {}),
      },
      tipografia: {
        ...CONFIG_LAYOUT_PDF_A4.tipografia,
        ...(customConfig?.tipografia || {}),
      },
      cores: {
        ...CONFIG_LAYOUT_PDF_A4.cores,
        ...(customConfig?.cores || {}),
      },
    };

    this.doc = new jsPDF({
      orientation: this.config.pagina.orientacao,
      unit: this.config.pagina.unidade,
      format: this.config.pagina.formato,
      compress: this.config.pagina.compressao,
    }) as JsPDFComAutoTable;

    this.cursorY = this.config.margens.topoCorpoTecnicoMm;
  }

  private get larguraUtil(): number {
    return (
      this.config.pagina.larguraMm -
      this.config.margens.esquerdaMm -
      this.config.margens.direitaMm
    );
  }

  private get limiteInferiorY(): number {
    return (
      this.config.pagina.alturaMm - this.config.margens.baseCorpoTecnicoMm
    );
  }

  private get razaoEmpresa(): string {
    return valOuPreencherPDF(
      this.relatorio.cabecalho.razaoSocial,
      this.config.cabecalho.razaoSocialPadrao
    );
  }

  private get respTecnicoNome(): string {
    return valOuPreencherPDF(
      this.relatorio.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoNome ||
        this.relatorio.assinaturaResponsavel?.nomeSignatario,
      'José Roberto Ribeiro'
    );
  }

  private get respTecnicoCREA(): string {
    return valOuPreencherPDF(
      this.relatorio.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoCREA ||
        this.relatorio.assinaturaResponsavel?.documento,
      'DADO A PREENCHER EM CAMPO'
    );
  }

  private get respTecnicoFormatado(): string {
    return `Responsável Técnico: [${this.respTecnicoNome}, CREA: ${this.respTecnicoCREA}]`;
  }

  /**
   * Retorna as margens padrão para todas as chamadas do `autoTable`,
   * reservando automaticamente o espaço exato do cabeçalho e do rodapé.
   */
  private obterMargensAutoTable(): UserOptions['margin'] {
    return {
      top: this.config.margens.topoCorpoTecnicoMm,
      right: this.config.margens.direitaMm,
      bottom: this.config.margens.baseCorpoTecnicoMm,
      left: this.config.margens.esquerdaMm,
    };
  }

  /**
   * Garante espaço vertical disponível na página corrente; caso contrário,
   * abre nova página já posicionada abaixo da área reservada ao cabeçalho.
   */
  private garantirEspacoVertical(alturaNecessariaMm: number): void {
    if (this.cursorY + alturaNecessariaMm > this.limiteInferiorY) {
      this.adicionarPaginaCorpoTecnico();
    }
  }

  private adicionarPaginaCorpoTecnico(): void {
    this.doc.addPage();
    this.cursorY = this.config.margens.topoCorpoTecnicoMm;
  }

  /**
   * Sanitiza recursivamente células do `autoTable` para garantir codificação WinAnsi (<= 255)
   * e medição exata de largura de linha pelo jsPDF.
   */
  private sanitizarCelulasAutoTable(linhas?: RowInput[]): RowInput[] | undefined {
    if (!linhas) return undefined;
    return linhas.map((linha) => {
      if (Array.isArray(linha)) {
        return linha.map((celula) => {
          if (typeof celula === 'string') {
            return sanitizarTextoWinAnsiPDF(celula);
          }
          if (
            celula &&
            typeof celula === 'object' &&
            'content' in celula &&
            typeof celula.content === 'string'
          ) {
            return {
              ...celula,
              content: sanitizarTextoWinAnsiPDF(celula.content),
            };
          }
          return celula;
        });
      }
      return linha;
    });
  }

  /**
   * Executa o `autoTable` sincronizando automaticamente `this.cursorY` com `lastAutoTable.finalY`
   * e travando `tableWidth` dentro da área útil imprimível A4 (`this.larguraUtil`).
   */
  private executarAutoTable(opcoes: UserOptions): void {
    // Restaura a fonte padrão no documento antes da medição de linhas do autoTable
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(this.config.tipografia.tamanhoCorpoTabelaPt);

    autoTable(this.doc, {
      ...opcoes,
      head: this.sanitizarCelulasAutoTable(opcoes.head as RowInput[]),
      body: this.sanitizarCelulasAutoTable(opcoes.body as RowInput[]),
      startY: opcoes.startY ?? this.cursorY,
      margin: opcoes.margin ?? this.obterMargensAutoTable(),
      tableWidth: opcoes.tableWidth ?? this.larguraUtil,
      rowPageBreak: opcoes.rowPageBreak ?? 'auto',
      styles: {
        font: this.config.tipografia.familiaPadrao,
        fontSize: this.config.tipografia.tamanhoCorpoTabelaPt,
        textColor: this.config.cores.textDark,
        lineColor: this.config.cores.bordaTabela,
        lineWidth: 0.2,
        cellPadding: { top: 1.6, right: 2.2, bottom: 1.6, left: 2.2 },
        overflow: 'linebreak',
        ...(opcoes.styles || {}),
      },
      headStyles: {
        fillColor: this.config.cores.navy,
        textColor: this.config.cores.white,
        fontStyle: 'bold',
        fontSize: this.config.tipografia.tamanhoCabecalhoTabelaPt,
        halign: 'left',
        overflow: 'linebreak',
        ...(opcoes.headStyles || {}),
      },
      alternateRowStyles: {
        fillColor: this.config.cores.zebraPar,
        ...(opcoes.alternateRowStyles || {}),
      },
    });

    const finalY = this.doc.lastAutoTable?.finalY;
    if (typeof finalY === 'number') {
      this.cursorY = finalY + 3.5;
    }
  }

  /**
   * Renderiza a barra de título de seção corporativa (Navy + marcador lateral Âmbar).
   */
  private desenharBarraSecao(titulo: string, espacoMinimoAbaixoMm = 18): void {
    this.garantirEspacoVertical(7.5 + espacoMinimoAbaixoMm);

    const { esquerdaMm } = this.config.margens;
    const { navy, amber, white } = this.config.cores;

    this.doc.setFillColor(...navy);
    this.doc.rect(esquerdaMm, this.cursorY, this.larguraUtil, 7, 'F');

    this.doc.setFillColor(...amber);
    this.doc.rect(esquerdaMm, this.cursorY, 3, 7, 'F');

    this.doc.setTextColor(...white);
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(this.config.tipografia.tamanhoBarraSecaoPt);
    this.doc.text(
      sanitizarTextoWinAnsiPDF(titulo.toUpperCase()),
      esquerdaMm + 5,
      this.cursorY + 4.8
    );

    this.cursorY += 8.5;
  }

  /**
   * Renderiza tabela corporativa de pares (Rótulo Esquerda | Valor Esquerda | Rótulo Direita | Valor Direita)
   * usando `jspdf-autotable`.
   */
  private renderizarTabelaPares2Colunas(
    pares: [string, string, string, string][]
  ): void {
    const colLabelW = 36;
    const colValW = this.larguraUtil / 2 - colLabelW;

    const body: RowInput[] = pares.map(([lbl1, val1, lbl2, val2]) => [
      {
        content: lbl1.toUpperCase(),
        styles: {
          fontStyle: 'bold',
          textColor: this.config.cores.textMuted,
          fontSize: 7.1,
        },
      },
      {
        content: valOuPreencherPDF(val1),
        styles: {
          fontStyle: 'normal',
          textColor: this.config.cores.textDark,
          halign: 'right',
        },
      },
      {
        content: lbl2 ? lbl2.toUpperCase() : '',
        styles: {
          fontStyle: 'bold',
          textColor: this.config.cores.textMuted,
          fontSize: 7.1,
        },
      },
      {
        content: lbl2 ? valOuPreencherPDF(val2) : '',
        styles: {
          fontStyle: 'normal',
          textColor: this.config.cores.textDark,
          halign: 'right',
        },
      },
    ]);

    this.executarAutoTable({
      body,
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: colLabelW },
        1: { cellWidth: colValW },
        2: { cellWidth: colLabelW },
        3: { cellWidth: colValW },
      },
    });
  }

  /**
   * Renderiza um bloco textual técnico estruturado (Subtítulo + Conteúdo) via `autoTable`,
   * dividindo parágrafos em linhas individuais com quebra preventiva `splitTextToSize`
   * para garantir que o texto NUNCA ultrapasse a largura útil (`182mm`) nem a margem inferior (`limiteInferiorY`).
   */
  private renderizarQuadroTextoTecnico(subtitulo: string, conteudo: string): void {
    this.garantirEspacoVertical(20);

    const textoSanitizado = valOuPreencherPDF(conteudo);
    const padHorizontalMm = 2.8;
    const larguraInternaTextoMm = this.larguraUtil - padHorizontalMm * 2 - 1;

    const paragrafosBrutos = textoSanitizado
      .split('\n')
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0);

    const paragrafos =
      paragrafosBrutos.length > 0
        ? paragrafosBrutos
        : [sanitizarTextoWinAnsiPDF('[DADO A PREENCHER EM CAMPO]')];

    const bodyRows: RowInput[] = paragrafos.map((paragrafo, idx) => {
      const isTopicoNumerado = /^\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(paragrafo);
      this.doc.setFont(
        this.config.tipografia.familiaPadrao,
        isTopicoNumerado ? 'bold' : 'normal'
      );
      this.doc.setFontSize(7.8);

      const linhasEnvelopadas: string[] = this.doc.splitTextToSize(
        paragrafo,
        larguraInternaTextoMm
      );

      const isPrimeiro = idx === 0;
      const isUltimo = idx === paragrafos.length - 1;

      return [
        {
          content: linhasEnvelopadas.join('\n'),
          styles: {
            font: this.config.tipografia.familiaPadrao,
            fontStyle: isTopicoNumerado ? 'bold' : 'normal',
            fontSize: 7.8,
            textColor: isTopicoNumerado
              ? this.config.cores.navy
              : this.config.cores.textDark,
            fillColor: this.config.cores.white,
            cellPadding: {
              top: isPrimeiro ? 2.2 : isTopicoNumerado ? 1.8 : 0.9,
              right: padHorizontalMm,
              bottom: isUltimo ? 2.2 : 0.9,
              left: padHorizontalMm,
            },
          },
        },
      ];
    });

    this.executarAutoTable({
      head: [[sanitizarTextoWinAnsiPDF(subtitulo.toUpperCase())]],
      body: bodyRows,
      theme: 'grid',
      tableWidth: this.larguraUtil,
      showHead: 'everyPage',
      columnStyles: {
        0: {
          cellWidth: this.larguraUtil,
          overflow: 'linebreak',
        },
      },
      styles: {
        lineColor: this.config.cores.bordaTabela,
        lineWidth: 0.18,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: this.config.cores.zebraPar,
        textColor: this.config.cores.navy,
        fontStyle: 'bold',
        fontSize: 7.4,
        lineColor: this.config.cores.bordaTabela,
        lineWidth: 0.22,
        cellPadding: {
          top: 1.6,
          right: padHorizontalMm,
          bottom: 1.6,
          left: padHorizontalMm,
        },
      },
    });
  }

  /**
   * Pré-captura todos os componentes de fórmula `<svg data-math-formula-id="...">` renderizados
   * pelo `MathFormulaBlock` (ou gera seus SVGs equivalentes em memória) convertendo-os para PNG de alta densidade (384 DPI).
   */
  private async preCapturarFormulasMatematicas(): Promise<void> {
    const grupos = construirEquacoesLivroRelatorio(this.relatorio);
    const todas = [
      ...grupos.secao6,
      ...grupos.anexoI2,
      ...grupos.anexoI3Jacob,
      ...grupos.anexoI3Cooper,
    ];
    const unicas = new Map<string, EquacaoLivroSpec>();
    todas.forEach((eq) => unicas.set(eq.id, eq));

    for (const spec of unicas.values()) {
      const img = await capturarFormulaSVGParaImagemPDF(spec);
      if (img) {
        this.formulasCapturadas.set(spec.id, img);
      }
    }
  }

  /**
   * Fallback vetorial nativo em `jsPDF` (com fonte serifada `times`, traço de fração horizontal `doc.line`
   * e numeração ABNT alinhada à direita) caso o ambiente bloqueie a conversão de Canvas.
   */
  private desenharEquacaoVetorialNoPDF(
    spec: EquacaoLivroSpec,
    xBox: number,
    yBox: number,
    wBox: number,
    hBox: number
  ): void {
    const midY = yBox + hBox / 2 + 0.8;
    const barY = midY - 1.2;
    let curX = xBox + 6;

    this.doc.setTextColor(...this.config.cores.navy);
    this.doc.setDrawColor(...this.config.cores.navy);

    for (const tk of spec.tokens) {
      if (tk.kind === 'frac' || tk.kind === 'paren-frac') {
        this.doc.setFont('times', 'normal');
        this.doc.setFontSize(8.8);
        const numTxt = sanitizarTextoWinAnsiPDF(
          `${tk.numerator}${tk.numeratorSub || ''}${
            tk.numeratorSup ? '^' + tk.numeratorSup : ''
          }`
        );
        const denTxt = sanitizarTextoWinAnsiPDF(
          `${tk.denominator}${tk.denominatorSub || ''}${
            tk.denominatorSup ? '^' + tk.denominatorSup : ''
          }`
        );
        const wFrac =
          Math.max(
            this.doc.getTextWidth(numTxt),
            this.doc.getTextWidth(denTxt)
          ) + 5;

        if (tk.kind === 'paren-frac') {
          this.doc.setFontSize(13.5);
          this.doc.text('(', curX, midY + 0.8);
          curX += 2.6;
        }

        const fCenter = curX + wFrac / 2;
        this.doc.setFont('times', tk.italicNum ? 'italic' : 'normal');
        this.doc.setFontSize(8.6);
        this.doc.text(numTxt, fCenter, barY - 1.4, { align: 'center' });

        this.doc.setLineWidth(0.3);
        this.doc.line(curX + 0.5, barY, curX + wFrac - 0.5, barY);

        this.doc.setFont('times', tk.italicDen ? 'italic' : 'normal');
        this.doc.setFontSize(8.6);
        this.doc.text(denTxt, fCenter, barY + 3.4, { align: 'center' });

        curX += wFrac;

        if (tk.kind === 'paren-frac') {
          this.doc.setFont('times', 'normal');
          this.doc.setFontSize(13.5);
          this.doc.text(')', curX + 0.4, midY + 0.8);
          curX += 3.2;
        } else {
          curX += 1.2;
        }
      } else {
        const isVar = tk.kind === 'var';
        const isRes = tk.kind === 'result';
        const txtMain = sanitizarTextoWinAnsiPDF(tk.main);
        this.doc.setFont(
          'times',
          isRes ? 'bold' : isVar ? 'italic' : 'normal'
        );
        this.doc.setFontSize(9.8);
        if (isRes) {
          this.doc.setTextColor(0, 34, 153);
        } else {
          this.doc.setTextColor(...this.config.cores.navy);
        }
        this.doc.text(txtMain, curX, midY);
        curX += this.doc.getTextWidth(txtMain) + 0.6;

        if (tk.sub) {
          const txtSub = sanitizarTextoWinAnsiPDF(tk.sub);
          this.doc.setFont('times', 'normal');
          this.doc.setFontSize(6.8);
          this.doc.text(txtSub, curX - 0.3, midY + 1.2);
          curX += this.doc.getTextWidth(txtSub) + 0.6;
        }
        if (tk.sup) {
          const txtSup = sanitizarTextoWinAnsiPDF(tk.sup);
          this.doc.setFont('times', 'normal');
          this.doc.setFontSize(6.8);
          this.doc.text(txtSup, curX - 0.3, midY - 1.8);
          curX += this.doc.getTextWidth(txtSup) + 0.6;
        }
        curX += tk.kind === 'op' ? 1.4 : 0.6;
      }
    }

    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(8.2);
    this.doc.setTextColor(...this.config.cores.textMuted);
    this.doc.text(
      sanitizarTextoWinAnsiPDF(spec.numeroEquacao),
      xBox + wBox - 3,
      midY,
      {
        align: 'right',
      }
    );
  }

  /**
   * Renderiza um bloco de equação matemática em estilo de livro técnico/científico (ABNT Display Math)
   * dentro do PDF utilizando `autoTable` + imagem SVG capturada de alta resolução (ou vetor nativo).
   */
  private renderizarBlocoEquacaoLivro(
    spec: EquacaoLivroSpec,
    compacto = false
  ): void {
    this.garantirEspacoVertical(compacto ? 22 : 28);
    const alturaCelulaFormula = compacto ? 13.5 : 15.8;
    const capturada = this.formulasCapturadas.get(spec.id);

    const rows: RowInput[] = [
      [
        {
          content: '',
          colSpan: 2,
          styles: {
            minCellHeight: alturaCelulaFormula,
            fillColor: this.config.cores.white,
          },
        },
      ],
    ];

    if (!compacto && spec.legendaVariaveis) {
      const legendaLimpa = sanitizarTextoWinAnsiPDF(spec.legendaVariaveis);
      this.doc.setFont('times', 'italic');
      this.doc.setFontSize(7.3);
      const linhasLegenda: string[] = this.doc.splitTextToSize(
        legendaLimpa,
        this.larguraUtil - 6
      );

      rows.push([
        {
          content: linhasLegenda.join('\n'),
          colSpan: 2,
          styles: {
            font: 'times',
            fontStyle: 'italic',
            fontSize: 7.3,
            textColor: [75, 85, 99],
            fillColor: this.config.cores.fundoDestaque,
            cellPadding: { top: 1.2, right: 2.5, bottom: 1.2, left: 2.5 },
          },
        },
      ]);
    }

    this.executarAutoTable({
      head: [
        [
          sanitizarTextoWinAnsiPDF(spec.titulo.toUpperCase()),
          {
            content: sanitizarTextoWinAnsiPDF(
              `NOTAÇÃO ABNT ${spec.numeroEquacao}`
            ),
            styles: {
              halign: 'right',
              fontSize: 6.8,
              textColor: this.config.cores.amber,
            },
          },
        ],
      ],
      body: rows,
      theme: 'grid',
      tableWidth: this.larguraUtil,
      headStyles: {
        fillColor: this.config.cores.navy,
        textColor: this.config.cores.white,
        fontStyle: 'bold',
        fontSize: 7.1,
        cellPadding: { top: 1.1, right: 2.5, bottom: 1.1, left: 2.5 },
      },
      columnStyles: {
        0: { cellWidth: 144 },
        1: { cellWidth: 38 },
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.row.index === 0 && data.column.index === 0) {
          const padX = 2;
          const padY = 0.8;
          const drawW = data.cell.width - padX * 2;
          const drawH = data.cell.height - padY * 2;

          if (capturada?.dataUrl) {
            try {
              this.doc.addImage(
                capturada.dataUrl,
                'PNG',
                data.cell.x + padX,
                data.cell.y + padY,
                drawW,
                drawH,
                undefined,
                'FAST'
              );
              return;
            } catch {
              // Se falhar, usa o renderizador vetorial abaixo
            }
          }

          this.desenharEquacaoVetorialNoPDF(
            spec,
            data.cell.x + padX,
            data.cell.y + padY,
            drawW,
            drawH
          );
        }
      },
    });
  }

  /**
   * 1. FOLHA DE ROSTO (PÁGINA 1 EXCLUSIVA)
   * Segue estritamente o layout corporativo de engenharia e as diretrizes da
   * ABNT NBR 10719 / NBR 14724 (identificação institucional, título técnico centralizado,
   * natureza/objetivo do laudo, quadros formais de Contratante, Contratada, Dados Contratuais,
   * Normas Aplicadas, Responsabilidade Técnica, Síntese do Poço e Local/Data).
   */
  public renderizarFolhaDeRostoABNT(): void {
    const { esquerdaMm } = this.config.margens;
    const { larguraMm } = this.config.pagina;
    const { navy, amber, white, textDark, textMuted } = this.config.cores;

    let yCapa = this.config.margens.topoCorpoTecnicoMm + 2;

    // Moldura Corporativa de Destaque do Título do Relatório
    this.doc.setFillColor(...navy);
    this.doc.rect(esquerdaMm, yCapa, this.larguraUtil, 28, 'F');
    this.doc.setFillColor(...amber);
    this.doc.rect(esquerdaMm, yCapa, 4, 28, 'F');

    this.doc.setTextColor(...amber);
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(8.2);

    this.doc.setTextColor(...white);
    this.doc.setFontSize(this.config.tipografia.tamanhoTituloCapaPt);
    this.doc.text(
      'RELATÓRIO TÉCNICO DE ENTREGA DE SERVIÇOS',
      larguraMm / 2 + 2,
      yCapa + 14.5,
      { align: 'center' }
    );

    const tagPoco = valOuPreencherPDF(this.relatorio.dadosPoco?.pocoId, 'PT01');
    const numOS = valOuPreencherPDF(
      this.relatorio.cabecalho.contratoOS,
      'OS-2026-0842 / CTR-119'
    );
    this.doc.setFontSize(this.config.tipografia.tamanhoSubtituloCapaPt);
    this.doc.text(
      `POÇO TUBULAR PROFUNDO (${tagPoco})  •  ORDEM DE SERVIÇO: ${numOS}`,
      larguraMm / 2 + 2,
      yCapa + 22.5,
      { align: 'center' }
    );

    this.cursorY = yCapa + 33;


    // Quadro 1 da Folha de Rosto: INTERESSADO / CONTRATANTE ("Ao")
    this.executarAutoTable({
      head: [['1. IDENTIFICAÇÃO DO CONTRATANTE / INTERESSADO (AO)', '', '', '']],
      body: [
        [
          { content: 'CLIENTE', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.cliente), colSpan: 3, styles: { fontStyle: 'bold' } },
        ],
        [
          { content: 'CNPJ / CPF', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.clienteCNPJ) },
          { content: 'CONTATO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.contatoLocal) },
        ],
        [
          { content: 'LOCAL DA PRESTAÇÃO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.localizacao), colSpan: 3 },
        ],
        [
          { content: 'CIDADE / UF', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.cidadeUF, 'Ribeirão Preto - SP') },
          { content: 'TELEFONE', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.telefoneContato) },
        ],
      ],
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { cellWidth: 35 },
        3: { cellWidth: 56 },
      },
    });

    // Quadro 2 da Folha de Rosto: EMPRESA EXECUTORA ("Responsável pela Execução")
    this.executarAutoTable({
      head: [['2. EMPRESA RESPONSÁVEL PELA EXECUÇÃO (CONTRATADA)', '', '', '']],
      body: [
        [
          { content: 'RAZÃO SOCIAL', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: this.razaoEmpresa, colSpan: 3, styles: { fontStyle: 'bold' } },
        ],
        [
          { content: 'CNPJ', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.cnpj, this.config.cabecalho.cnpjPadrao) },
          { content: 'E-MAIL', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.emailEmpresa, this.config.cabecalho.emailPadrao) },
        ],
        [
          { content: 'ENDEREÇO E CONTATO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          {
            content: `${valOuPreencherPDF(
              this.relatorio.cabecalho.enderecoEmpresa,
              this.config.cabecalho.enderecoPadrao
            )} — ${valOuPreencherPDF(
              this.relatorio.cabecalho.cidadeContatoEmpresa,
              this.config.cabecalho.cidadeContatoPadrao
            )}`,
            colSpan: 3,
          },
        ],
      ],
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { cellWidth: 35 },
        3: { cellWidth: 56 },
      },
    });

    // Quadro 3 da Folha de Rosto: DADOS CONTRATUAIS, RESPONSABILIDADE TÉCNICA E NORMAS ABNT
    this.executarAutoTable({
      head: [['3. DADOS CONTRATUAIS, RESPONSÁVEL TÉCNICO E NORMAS APLICADAS', '', '', '']],
      body: [
        [
          { content: 'ORDEM DE SERVIÇO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: numOS, styles: { fontStyle: 'bold' } },
          { content: 'CONTRATO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.contratoRef, 'CTR-119 / 2026') },
        ],
        [
          { content: 'SERVIÇO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.tipoServico), colSpan: 3 },
        ],
        [
          { content: 'RESPONSÁVEL TÉCNICO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: this.respTecnicoNome, styles: { fontStyle: 'bold' } },
          { content: 'REGISTRO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: `CREA: ${this.respTecnicoCREA}` },
        ],
        [
          { content: 'NORMAS APLICADAS', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          {
            content:
              'ABNT NBR 12212 (Projeto de poço tubular), ABNT NBR 12244 (Construção e ensaio de bombeamento de poço tubular) e ABNT NBR 10719 (Relatórios técnicos).',
            colSpan: 3,
          },
        ],
      ],
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 60 },
        2: { cellWidth: 35 },
        3: { cellWidth: 56 },
      },
    });

    // Quadro 4 da Folha de Rosto: SÍNTESE EXECUTIVA DO POÇO E EQUIPAMENTO DE BOMBEAMENTO
    this.executarAutoTable({
      head: [['4. SÍNTESE EXECUTIVA DO POÇO E CONDIÇÕES OPERACIONAIS UNIFICADAS', '', '', '']],
      body: [
        [
          { content: 'IDENTIFICAÇÃO (TAG)', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: tagPoco, styles: { fontStyle: 'bold' } },
          { content: 'PROFUNDIDADE TOTAL', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.dadosPoco?.profundidadeTotal, '160,00 m') },
        ],
        [
          { content: 'NÍVEL ESTÁTICO (NE)', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.dadosPoco?.nivelEstatico, '22,40 m') },
          { content: 'NÍVEL DINÂMICO (ND)', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.dadosPoco?.nivelDinamico, '64,10 m') },
        ],
        [
          { content: 'VAZÃO RECOMENDADA', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.dadosPoco?.vazaoTeste, '10,29 m³/h'), styles: { fontStyle: 'bold', textColor: this.config.cores.green } },
          { content: 'PROF. INST. BOMBA', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          { content: valOuPreencherPDF(this.relatorio.dadosPoco?.profundidadeBomba, '84,00 m'), styles: { fontStyle: 'bold' } },
        ],
        [
          { content: 'EQUIPAMENTO BOMBA', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.2 } },
          {
            content: `${valOuPreencherPDF(this.relatorio.dadosPoco?.especificacaoBomba)} (${valOuPreencherPDF(
              this.relatorio.dadosPoco?.motobombaEstado,
              'Novo'
            ).toUpperCase()})`,
            colSpan: 3,
          },
        ],
      ],
      theme: 'grid',
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { cellWidth: 35 },
        3: { cellWidth: 56 },
      },
    });

    // Sumário Executivo da Estrutura Documental na Folha de Rosto
    this.executarAutoTable({
      head: [['SUMÁRIO ESTRUTURAL DO LAUDO TÉCNICO (SEÇÕES 1 A 10 + ANEXOS)', 'CONTEÚDO']],
      body: [
        ['Seções 1 a 4 — Identificação, Cliente/Local, Dados do Poço e Desenho Construtivo', 'Corpo Técnico'],
        ['Seções 5 a 8 — Serviços Executados, Parecer Hidrogeológico, Checklist e Recomendações', 'Corpo Técnico'],
        ['Seções 9 a 10 — Registro Fotográfico de Evidências (1:1) e Termo de Assinaturas', 'Corpo Técnico'],
        ['Anexos I.1, I.2 e I.3 — Planilhas de Bombeamento, Recuperação (73,1%) e Jacob/Cooper-Jacob', 'Anexo Técnico'],
      ],
      theme: 'striped',
      styles: { fontSize: 7.2, cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 } },
      columnStyles: {
        0: { cellWidth: 145 },
        1: { cellWidth: 37, halign: 'center', fontStyle: 'bold' },
      },
    });
  }

  /**
   * 2. CORPO TÉCNICO DO RELATÓRIO (INICIADO EM NOVA PÁGINA SEPARADA DA FOLHA DE ROSTO)
   * Renderiza as seções técnicas numeradas de 1 a 10 utilizando `jspdf-autotable`.
   */
  public renderizarCorpoTecnico(): void {
    // Separação estrita entre Folha de Rosto (Página 1) e Corpo Técnico (Página 2+)
    this.adicionarPaginaCorpoTecnico();

    const vis = this.relatorio.secoesVisiveis;

    // SEÇÃO 1: IDENTIFICAÇÃO DO SERVIÇO
    if (vis?.informacoesGerais !== false) {
      this.desenharBarraSecao('1. IDENTIFICAÇÃO DO SERVIÇO');
      this.renderizarTabelaPares2Colunas([
        [
          'Nº da OS',
          valOuPreencherPDF(this.relatorio.cabecalho.contratoOS, 'OS-2026-0842 / CTR-119'),
          'Contrato / Ref',
          valOuPreencherPDF(this.relatorio.cabecalho.contratoRef, 'CTR-119 / 2026'),
        ],
        [
          'Data Execução',
          formatarDataBR(this.relatorio.cabecalho.dataExecucao),
          'Status Final',
          valOuPreencherPDF(this.relatorio.cabecalho.statusOS, 'Concluído'),
        ],
        [
          'Tipo de Serviço',
          valOuPreencherPDF(this.relatorio.cabecalho.tipoServico),
          'Resp. Técnico',
          this.respTecnicoFormatado,
        ],
      ]);
    }

    // SEÇÃO 2: CLIENTE E LOCAL
    if (vis?.clienteLocal !== false) {
      this.desenharBarraSecao('2. CLIENTE E LOCAL');
      this.renderizarTabelaPares2Colunas([
        [
          'Cliente Mandante',
          valOuPreencherPDF(this.relatorio.cabecalho.cliente),
          'CNPJ / CPF',
          valOuPreencherPDF(this.relatorio.cabecalho.clienteCNPJ),
        ],
        [
          'Local da Obra',
          valOuPreencherPDF(this.relatorio.cabecalho.localizacao),
          'Cidade / UF',
          valOuPreencherPDF(this.relatorio.cabecalho.cidadeUF),
        ],
        [
          'Coord. Geográficas',
          valOuPreencherPDF(
            this.relatorio.dadosPoco?.coordenadasGeograficas,
            'LAT -21.1767 | LON -47.8208'
          ),
          'Coordenadas UTM',
          valOuPreencherPDF(
            this.relatorio.dadosPoco?.coordenadasUTM,
            '[DADO A PREENCHER EM CAMPO]'
          ),
        ],
        [
          'Contato Local',
          valOuPreencherPDF(this.relatorio.cabecalho.contatoLocal),
          'Telefone',
          valOuPreencherPDF(this.relatorio.cabecalho.telefoneContato),
        ],
      ]);
    }

    // SEÇÃO 3: INFORMAÇÕES DO POÇO
    if (vis?.informacoesPoco !== false) {
      this.desenharBarraSecao('3. INFORMAÇÕES DO POÇO');
      this.renderizarTabelaPares2Colunas([
        [
          'Poço (TAG)',
          valOuPreencherPDF(this.relatorio.dadosPoco?.pocoId, 'PT01'),
          'Profundidade Total',
          valOuPreencherPDF(this.relatorio.dadosPoco?.profundidadeTotal, '160,00 m'),
        ],
        [
          'Diâmetro (Ø)',
          valOuPreencherPDF(
            this.relatorio.dadosPoco?.diametroRevestimento,
            '6" (152,4 mm) Aço Carbono Sch 40'
          ),
          'Crivo / Filtro',
          valOuPreencherPDF(
            this.relatorio.dadosPoco?.crivo,
            '[DADO A PREENCHER EM CAMPO]'
          ),
        ],
        [
          'Nível Estático (NE)',
          valOuPreencherPDF(this.relatorio.dadosPoco?.nivelEstatico, '22,40 m'),
          'Nível Dinâmico (ND)',
          valOuPreencherPDF(this.relatorio.dadosPoco?.nivelDinamico, '64,10 m'),
        ],
        [
          'Vazão Recomendada',
          valOuPreencherPDF(this.relatorio.dadosPoco?.vazaoTeste, '10,29 m³/h'),
          'Prof. Inst. Bomba',
          valOuPreencherPDF(this.relatorio.dadosPoco?.profundidadeBomba, '84,00 m'),
        ],
        [
          'Tubo Edutor',
          valOuPreencherPDF(this.relatorio.dadosPoco?.tuboEdutor),
          'Submergência Bomba',
          '19,90 m acima do ND (Mín. 10,00 m)',
        ],
        [
          'Eletrodo Superior',
          valOuPreencherPDF(this.relatorio.dadosPoco?.eletrodoSuperior),
          'Eletrodo Inferior',
          valOuPreencherPDF(this.relatorio.dadosPoco?.eletrodoInferior),
        ],
      ]);

      const bombaEst = valOuPreencherPDF(
        this.relatorio.dadosPoco?.motobombaEstado,
        'Novo'
      ).toUpperCase();
      const painelEst = valOuPreencherPDF(
        this.relatorio.dadosPoco?.painelEstado,
        'Novo'
      ).toUpperCase();

      this.renderizarQuadroTextoTecnico(
        'Conjunto Motobomba e Quadro de Comando',
        `Motobomba: ${valOuPreencherPDF(
          this.relatorio.dadosPoco?.especificacaoBomba
        )} (${bombaEst}) | Painel: ${valOuPreencherPDF(
          this.relatorio.dadosPoco?.painelEletrico
        )} (${painelEst})`
      );

      this.renderizarQuadroTextoTecnico(
        'Perfil Litológico e Hidroestratigráfico Resumido',
        valOuPreencherPDF(
          this.relatorio.dadosPoco?.perfilLitologico,
          '0,00 a 18,00 m: Solo argilo-arenoso avermelhado; 18,00 a 112,00 m: Basalto compacto a vesicular fraturado (Formação Serra Geral); 112,00 a 160,00 m: Arenito fino a médio rosado (Sistema Aquífero Guarani / Formação Botucatu).'
        )
      );
    }

    // SEÇÃO 4: DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO
    if (vis?.desenhoConstrutivo !== false) {
      this.desenharBarraSecao('4. DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO');
      this.renderizarQuadroTextoTecnico(
        'Especificação Construtiva, Cimentação Sanitária (0-24m) e Laje de Proteção (ABNT NBR 12212 / 12244)',
        valOuPreencherPDF(
          this.relatorio.dadosPoco?.desenhoConstrutivo,
          `• Profundidade Final: 160,00 m.\n• Coluna de Revestimento (Casing): Aço Carbono Schedule 40 Ø 6" (152,4 mm).\n• Cimentação Sanitária: Espaço anular cimentado de 0,00 m a 24,00 m de profundidade.\n• Laje de Proteção Sanitária: Concreto armado 1,50 m × 1,50 m × 0,15 m com tampa hermética e hidrômetro.\n• Crivo / Filtro: [DADO A PREENCHER EM CAMPO — Abaixo de 84,00 m].\n• Instalação da Bomba Submersa: Profundidade única de 84,00 m (SEMPRE acima do topo do crivo e com submergência de 19,90 m acima do ND máximo de 64,10 m).`
        )
      );
    }

    // SEÇÃO 5: SERVIÇOS TÉCNICOS EXECUTADOS
    if (vis?.servicosExecutados !== false) {
      this.desenharBarraSecao('5. SERVIÇOS TÉCNICOS EXECUTADOS');
      this.renderizarQuadroTextoTecnico(
        '5.1 Memorial Descritivo (Objetivo, Perfuração, Desenvolvimento Air-Lift, Teste 24h e Comissionamento)',
        valOuPreencherPDF(this.relatorio.descricaoServico)
      );

      const servicosValidos = (this.relatorio.servicosConduzidos || []).filter((s) =>
        s.descricao.trim()
      );
      if (servicosValidos.length > 0) {
        this.executarAutoTable({
          head: [['#', '5.2 Descrição dos Serviços Conduzidos', 'Qtd', 'Status']],
          body: servicosValidos.map((srv, idx) => [
            String(idx + 1),
            valOuPreencherPDF(srv.descricao),
            valOuPreencherPDF(srv.quantidade, '1'),
            {
              content: valOuPreencherPDF(srv.status, 'Executado'),
              styles: { fontStyle: 'bold', textColor: this.config.cores.green },
            },
          ]),
          theme: 'grid',
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 124 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 28, halign: 'center' },
          },
        });
      }

      const equipeValida = (this.relatorio.equipe || []).filter(
        (m) => m.nome.trim() || m.funcao.trim()
      );
      if (equipeValida.length > 0) {
        this.executarAutoTable({
          head: [['#', '5.3 Profissional / Equipe Técnica Mobilizada', 'Função / Atribuição em Campo']],
          body: equipeValida.map((m, idx) => [
            String(idx + 1),
            {
              content: valOuPreencherPDF(m.nome),
              styles: { fontStyle: idx === 0 ? 'bold' : 'normal' },
            },
            valOuPreencherPDF(m.funcao),
          ]),
          theme: 'grid',
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 92 },
            2: { cellWidth: 80 },
          },
        });
      }

      const materiaisValidos = (this.relatorio.materiaisAplicados || []).filter((m) =>
        m.descricao.trim()
      );
      if (materiaisValidos.length > 0) {
        this.executarAutoTable({
          head: [['#', '5.4 Materiais e Insumos Aplicados no Poço', 'Unidade', 'Qtd', 'Situação']],
          body: materiaisValidos.map((m, idx) => [
            String(idx + 1),
            valOuPreencherPDF(m.descricao),
            valOuPreencherPDF(m.unidade, 'Unid.'),
            valOuPreencherPDF(m.quantidade, '1'),
            {
              content: valOuPreencherPDF(m.situacao, 'Aplicado'),
              styles: { fontStyle: 'bold' },
            },
          ]),
          theme: 'grid',
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 104 },
            2: { cellWidth: 24, halign: 'center' },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 26, halign: 'center' },
          },
        });
      }
    }

    // SEÇÃO 6: PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA DE OPERAÇÃO (COM FÓRMULAS EM FORMATO DE LIVRO)
    if (vis?.parecerHidrogeologico !== false) {
      this.desenharBarraSecao('6. PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA DE OPERAÇÃO');
      const equacoesRelatorio = construirEquacoesLivroRelatorio(this.relatorio);
      equacoesRelatorio.secao6.forEach((eqSpec) => {
        this.renderizarBlocoEquacaoLivro(eqSpec, false);
      });
      this.renderizarQuadroTextoTecnico(
        'Síntese Conclusiva do Parecer Hidrogeológico e Condições Operacionais (ABNT NBR 12212 / NBR 12244)',
        valOuPreencherPDF(
          this.relatorio.dadosPoco?.parecerHidrogeologico,
          `• Parâmetros estabilizados no Teste Contínuo de 24h (13/03/2026): NE = 22,40 m | ND = 64,10 m | Rebaixamento máximo s = 41,70 m | Vazão recomendada de operação Q = 10,29 m³/h (246,86 m³/dia).\n• Profundidade única de instalação da bomba submersa: 84,00 m (posicionada com segurança acima do topo do crivo e com submergência operacional de 19,90 m acima do ND máximo).`
        )
      );
    }

    // SEÇÃO 7: CHECKLIST DE CONFORMIDADE E SEGURANÇA
    if (vis?.checklist !== false && this.relatorio.checklist && this.relatorio.checklist.length > 0) {
      this.desenharBarraSecao('7. CHECKLIST DE CONFORMIDADE E SEGURANÇA');
      this.executarAutoTable({
        head: [['Item de Verificação Normativa (ABNT / NR)', 'Data', 'Observação Técnica', 'Status']],
        body: this.relatorio.checklist.map((item) => [
          `[OK] ${valOuPreencherPDF(item.texto)}`,
          {
            content: valOuPreencherPDF(
              item.dataVerificacao,
              formatarDataBR(this.relatorio.cabecalho.dataExecucao)
            ),
            styles: { halign: 'center' },
          },
          valOuPreencherPDF(
            item.observacao,
            'Verificado e aprovado sem ressalvas em campo.'
          ),
          {
            content: 'CONFORME',
            styles: {
              fontStyle: 'bold',
              textColor: this.config.cores.green,
              halign: 'center',
            },
          },
        ]),
        theme: 'grid',
        alternateRowStyles: {
          fillColor: this.config.cores.fundoConformidade,
        },
        columnStyles: {
          0: { cellWidth: 78 },
          1: { cellWidth: 22 },
          2: { cellWidth: 56 },
          3: { cellWidth: 26 },
        },
      });
    }

    // SEÇÃO 8: RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO
    if (vis?.recomendacoes !== false) {
      this.desenharBarraSecao('8. RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO');
      const oc = this.relatorio.ocorrenciasCampo;
      this.renderizarQuadroTextoTecnico(
        '8.1 Diretrizes Operacionais, Monitoramento e Manutenção Preventiva',
        valOuPreencherPDF(
          oc?.recomendacoes,
          '1. Manter a operação na vazão recomendada de 10,29 m³/h e bomba instalada a 84,00 m.\n2. Monitorar mensalmente NE, ND, hidrômetro e parâmetros elétricos.\n3. Realizar análise físico-química e microbiológica semestral (Portaria GM/MS nº 888/2021).'
        )
      );
      this.renderizarQuadroTextoTecnico(
        '8.2 Observações Técnicas e Unificação Documental',
        valOuPreencherPDF(
          oc?.observacoesGerais,
          'Unificados todos os parâmetros pelo Teste Contínuo 24h a vazão constante de 13/03/2026 (NE = 22,40 m, ND = 64,10 m, Q = 10,29 m³/h, Bomba = 84,00 m). Nenhuma pendência remanescente.'
        )
      );
    }

    // SEÇÃO 9: REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS
    const fotosOrdenadas = [...this.relatorio.fotos].sort(
      (a, b) => a.ordem - b.ordem
    );
    if (vis?.fotos !== false && fotosOrdenadas.length > 0) {
      this.desenharBarraSecao('9. REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS', 46);

      const { esquerdaMm } = this.config.margens;
      const { navy, textDark } = this.config.cores;
      const gapColMm = 8;
      const boxW = (this.larguraUtil - gapColMm) / 2;
      const boxH = 40;
      let col = 0;
      let rowY = this.cursorY;

      for (let i = 0; i < fotosOrdenadas.length; i++) {
        const p = fotosOrdenadas[i];
        const posX = esquerdaMm + col * (boxW + gapColMm);

        if (rowY + boxH + 4 > this.limiteInferiorY) {
          this.adicionarPaginaCorpoTecnico();
          rowY = this.cursorY;
          col = 0;
        }

        const temImgReal = Boolean(
          p.urlBase64 && p.urlBase64.trim().startsWith('data:image')
        );
        const legendaTexto = valOuPreencherPDF(
          p.legenda,
          `[FOTO REAL OBRIGATÓRIA: Evidência #${i + 1}, data ${formatarDataBR(
            this.relatorio.cabecalho.dataExecucao
          )}, GPS LAT -21.1767 LON -47.8208]`
        );

        if (temImgReal) {
          try {
            const fmt = p.urlBase64.includes('image/png') ? 'PNG' : 'JPEG';
            this.doc.addImage(
              p.urlBase64,
              fmt,
              posX,
              rowY,
              boxW,
              boxH - 12,
              undefined,
              'FAST'
            );
          } catch {
            // fallback seguro
          }
          this.doc.setFillColor(248, 250, 252);
          this.doc.setDrawColor(215, 222, 232);
          this.doc.rect(posX, rowY + boxH - 12, boxW, 12, 'FD');
          this.doc.setTextColor(...textDark);
          this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
          this.doc.setFontSize(6.8);
          const lines = this.doc.splitTextToSize(legendaTexto, boxW - 4);
          this.doc.text(lines.slice(0, 3), posX + 2, rowY + boxH - 8.5);
        } else {
          this.doc.setFillColor(255, 251, 235);
          this.doc.setDrawColor(232, 160, 32);
          this.doc.setLineWidth(0.3);
          this.doc.rect(posX, rowY, boxW, boxH, 'FD');
          this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
          this.doc.setFontSize(7);
          this.doc.setTextColor(...navy);
          this.doc.text(
            'ESPAÇO RESERVADO — FOTO REAL DE CAMPO',
            posX + boxW / 2,
            rowY + 6,
            { align: 'center' }
          );
          this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
          this.doc.setFontSize(6.8);
          this.doc.setTextColor(60, 70, 85);
          const lines: string[] = this.doc.splitTextToSize(
            legendaTexto,
            boxW - 6
          );
          this.doc.text(lines.slice(0, 6), posX + 3, rowY + 12);
        }

        col++;
        if (col >= 2) {
          col = 0;
          rowY += boxH + 5;
          this.cursorY = rowY;
        }
      }

      if (col > 0) {
        rowY += boxH + 5;
        this.cursorY = rowY;
      }
      this.cursorY += 2;
    }

    // SEÇÃO 10: ASSINATURAS
    if (vis?.assinaturas !== false) {
      this.desenharBarraSecao('10. ASSINATURAS', 38);
      this.desenharBlocoAssinaturas();
    }
  }

  private desenharBlocoAssinaturas(): void {
    const { esquerdaMm } = this.config.margens;
    const { larguraMm } = this.config.pagina;
    const { navy } = this.config.cores;

    this.doc.setFillColor(250, 251, 253);
    this.doc.setDrawColor(221, 227, 236);
    this.doc.rect(esquerdaMm, this.cursorY, this.larguraUtil, 35, 'FD');

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(70, 80, 95);
    this.doc.text(
      `Declaramos que os serviços referentes à ${valOuPreencherPDF(
        this.relatorio.cabecalho.contratoOS
      )} (Poço ${valOuPreencherPDF(
        this.relatorio.dadosPoco?.pocoId,
        'PT01'
      )}) foram concluídos segundo as normas ABNT NBR 12212 e NBR 12244.`,
      larguraMm / 2,
      this.cursorY + 6,
      { align: 'center' }
    );

    const sigW = (this.larguraUtil - 20) / 2;
    this.doc.setDrawColor(...navy);
    this.doc.setLineWidth(0.35);
    this.doc.line(
      esquerdaMm + 4,
      this.cursorY + 18,
      esquerdaMm + 4 + sigW,
      this.cursorY + 18
    );
    this.doc.line(
      larguraMm - esquerdaMm - 4 - sigW,
      this.cursorY + 18,
      larguraMm - esquerdaMm - 4,
      this.cursorY + 18
    );

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...navy);
    this.doc.text(
      this.respTecnicoFormatado,
      esquerdaMm + 4 + sigW / 2,
      this.cursorY + 22.5,
      { align: 'center' }
    );
    this.doc.text(
      `Fiscal do Cliente: ${valOuPreencherPDF(
        this.relatorio.assinaturaCliente?.nomeSignatario,
        '[DADO A PREENCHER EM CAMPO]'
      )}`,
      larguraMm - esquerdaMm - 4 - sigW / 2,
      this.cursorY + 22.5,
      { align: 'center' }
    );

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(7);
    this.doc.setTextColor(90, 100, 115);
    this.doc.text(
      'Engenheiro Geólogo / Hidrogeólogo Sênior',
      esquerdaMm + 4 + sigW / 2,
      this.cursorY + 26.5,
      { align: 'center' }
    );
    this.doc.text(
      valOuPreencherPDF(
        this.relatorio.assinaturaCliente?.funcao,
        'Representante / Fiscal — Agroindustrial Vale do Rio Pardo S/A'
      ),
      larguraMm - esquerdaMm - 4 - sigW / 2,
      this.cursorY + 26.5,
      { align: 'center' }
    );

    this.doc.text(
      `Local e Data: ${valOuPreencherPDF(
        this.relatorio.cabecalho.cidadeUF,
        'Ribeirão Preto - SP'
      )}, ${formatarDataBR(this.relatorio.cabecalho.dataExecucao)}`,
      larguraMm / 2,
      this.cursorY + 31.8,
      { align: 'center' }
    );

    this.cursorY += 38;
  }

  /**
   * 3. ANEXOS TÉCNICOS DE TESTE DE BOMBEAMENTO (ANEXOS I.1, I.2 E I.3)
   * Utiliza `jspdf-autotable` para todas as planilhas hidrodinâmicas e desenha os gráficos semi-log vetoriais.
   */
  public renderizarAnexosTesteBombeamento(iniciarEmNovaPagina = true): void {
    const teste = this.relatorio.dadosPoco.testeVazaoSEMA;
    const calc = calcularParametrosStepDrawdownSEMA(
      this.relatorio.dadosPoco.nivelEstatico,
      teste
    );

    if (iniciarEmNovaPagina) {
      this.adicionarPaginaCorpoTecnico();
    } else {
      this.cursorY = this.config.margens.topoCorpoTecnicoMm;
    }

    // ==================== PÁGINA 1 DO ANEXO: ANEXO I.1 ====================
    this.desenharBarraSecao(
      `ANEXO I.1 — PLANILHA DE TESTE EM VAZÃO CONSTANTE (${valOuPreencherPDF(
        teste?.etapaLabel,
        '24H'
      )}) E GRÁFICO SEMI-LOG`,
      120
    );

    this.executarAutoTable({
      body: [
        [
          `Cliente: ${valOuPreencherPDF(this.relatorio.cabecalho.cliente).slice(0, 42)}  |  O.S.: ${valOuPreencherPDF(
            this.relatorio.cabecalho.contratoOS
          )}  |  Poço: ${valOuPreencherPDF(
            this.relatorio.dadosPoco.pocoId,
            'PT01'
          )}  |  N.E.: ${valOuPreencherPDF(
            this.relatorio.dadosPoco.nivelEstatico,
            '22,40 m'
          )}  |  Bomba: ${valOuPreencherPDF(
            this.relatorio.dadosPoco.profundidadeBomba,
            '84,00 m'
          )}`,
        ],
        [
          `${this.respTecnicoFormatado}  |  Data: ${formatarDataBR(
            teste?.dataInicioEnsaio || this.relatorio.cabecalho.dataExecucao
          )} (${valOuPreencherPDF(
            teste?.horaInicioBombeamento,
            '11:30:00'
          )} às ${valOuPreencherPDF(teste?.horaFinalBombeamento, '18:10:00')})`,
        ],
      ],
      theme: 'grid',
      styles: {
        fontSize: 6.7,
        fillColor: this.config.cores.zebraPar,
        cellPadding: { top: 1, right: 2, bottom: 1, left: 2 },
      },
    });

    const leiturasBomb = calc.leiturasBombeamentoCalc.slice(0, 36);
    const metadeBomb = Math.ceil(leiturasBomb.length / 2);
    const bombEsq = leiturasBomb.slice(0, metadeBomb);
    const bombDir = leiturasBomb.slice(metadeBomb);

    const linhasDuplasBomb: RowInput[] = [];
    for (let i = 0; i < metadeBomb; i++) {
      const le = bombEsq[i];
      const ld = bombDir[i];
      linhasDuplasBomb.push([
        le ? le.horaFormatada : '',
        le ? le.tFormatado : '',
        le ? Math.log10(Math.max(1, le.tMin)).toFixed(2).replace('.', ',') : '',
        le ? fmtNumeroSEMA(le.nd, 2) : '',
        le ? fmtNumeroSEMA(le.vazao, 2) : '',
        {
          content: le ? fmtNumeroSEMA(le.sMed, 2) : '',
          styles: { fontStyle: 'bold' },
        },
        '',
        ld ? ld.horaFormatada : '',
        ld ? ld.tFormatado : '',
        ld ? Math.log10(Math.max(1, ld.tMin)).toFixed(2).replace('.', ',') : '',
        ld ? fmtNumeroSEMA(ld.nd, 2) : '',
        ld ? fmtNumeroSEMA(ld.vazao, 2) : '',
        {
          content: ld ? fmtNumeroSEMA(ld.sMed, 2) : '',
          styles: { fontStyle: 'bold' },
        },
      ]);
    }

    this.executarAutoTable({
      head: [
        [
          'Hora',
          't(min)',
          'log t',
          'ND (m)',
          'Q (m³/h)',
          's (m)',
          '',
          'Hora',
          't(min)',
          'log t',
          'ND (m)',
          'Q (m³/h)',
          's (m)',
        ],
      ],
      body: linhasDuplasBomb,
      theme: 'grid',
      styles: {
        fontSize: 6.1,
        cellPadding: { top: 0.65, right: 1.2, bottom: 0.65, left: 1.2 },
      },
      headStyles: {
        fontSize: 6.1,
        cellPadding: { top: 0.9, right: 1.2, bottom: 0.9, left: 1.2 },
      },
      columnStyles: {
        0: { cellWidth: 15 },
        1: { cellWidth: 13, halign: 'center' },
        2: { cellWidth: 12, halign: 'right' },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 17, halign: 'right' },
        5: { cellWidth: 17, halign: 'right' },
        6: {
          cellWidth: 4,
          fillColor: this.config.cores.white,
        },
        7: { cellWidth: 15 },
        8: { cellWidth: 13, halign: 'center' },
        9: { cellWidth: 12, halign: 'right' },
        10: { cellWidth: 15, halign: 'right' },
        11: { cellWidth: 17, halign: 'right' },
        12: { cellWidth: 17, halign: 'right' },
      },
    });

    const yGrafBomb = Math.max(146, this.cursorY + 1);
    const hGrafBomb = Math.max(88, 270 - yGrafBomb);
    this.desenharGraficoSemiLogMeiaPagina(
      'Rebaixamento s (m)',
      'Tempo de Bombeamento t (min)',
      calc.leiturasBombeamentoCalc
        .filter((l) => l.sMed !== null)
        .map((l) => ({ s: l.sMed as number, t: l.tMin })),
      600,
      yGrafBomb,
      hGrafBomb
    );

    // ==================== PÁGINA 2 DO ANEXO: ANEXO I.2 ====================
    this.adicionarPaginaCorpoTecnico();
    this.desenharBarraSecao(
      "ANEXO I.2 — PLANILHA DE RECUPERAÇÃO (t, t', t/t', s') E GRÁFICO SEMI-LOG CORRETO",
      120
    );

    this.executarAutoTable({
      body: [
        [
          `Poço: ${valOuPreencherPDF(this.relatorio.dadosPoco.pocoId, 'PT01')}  |  N.E.: ${valOuPreencherPDF(
            this.relatorio.dadosPoco.nivelEstatico,
            '22,40 m'
          )}  |  ND máx: 64,10 m (s = 41,70 m)  |  Recuperação Real Recalculada (35 min): ${fmtNumeroSEMA(
            calc.percentualRecuperacao,
            1,
            '%'
          )} [(41,70 - 11,20)/41,70]`,
        ],
      ],
      theme: 'grid',
      styles: {
        fontSize: 6.8,
        fillColor: this.config.cores.zebraPar,
        cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 },
      },
    });

    this.executarAutoTable({
      head: [
        [
          'Hora',
          't total',
          "t' (min)",
          "t/t'",
          'N.A. (m)',
          "s' med (m)",
          "s' calc (m)",
          'Observações',
        ],
      ],
      body: calc.leiturasRecuperacaoCalc.slice(0, 18).map((r) => [
        r.horaFormatada,
        { content: String(r.tTotalMin), styles: { halign: 'center' } },
        {
          content: r.tFormatado,
          styles: { fontStyle: 'bold', halign: 'center' },
        },
        { content: r.relacaoTT, styles: { halign: 'right' } },
        { content: fmtNumeroSEMA(r.nd, 2), styles: { halign: 'right' } },
        {
          content: fmtNumeroSEMA(r.sMed, 2),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: valOuPreencherPDF(r.sCalc),
          styles: { halign: 'right' },
        },
        valOuPreencherPDF(r.observacoes, 'Leitura normal').slice(0, 34),
      ]),
      theme: 'grid',
      styles: {
        fontSize: 6.3,
        cellPadding: { top: 0.65, right: 1.5, bottom: 0.65, left: 1.5 },
      },
      headStyles: {
        fontSize: 6.3,
        cellPadding: { top: 0.9, right: 1.5, bottom: 0.9, left: 1.5 },
      },
    });

    const equacoesAnexo = construirEquacoesLivroRelatorio(this.relatorio);
    if (equacoesAnexo.anexoI2[0]) {
      this.renderizarBlocoEquacaoLivro(equacoesAnexo.anexoI2[0], true);
    }

    const yGrafRec = Math.max(156, this.cursorY + 1);
    const hGrafRec = Math.max(82, 272 - yGrafRec);
    this.desenharGraficoSemiLogMeiaPagina(
      "Rebaixamento Residual s' (m)",
      "Tempo após Parada t' (min)",
      calc.leiturasRecuperacaoCalc
        .filter((r) => r.sMed !== null)
        .map((r) => ({ s: r.sMed as number, t: r.tMin })),
      50,
      yGrafRec,
      hGrafRec
    );

    // ==================== PÁGINA 3 DO ANEXO: ANEXO I.3 ====================
    this.adicionarPaginaCorpoTecnico();
    this.desenharBarraSecao(
      'ANEXO I.3 — INTERPRETAÇÃO DO TESTE DE BOMBEAMENTO (JACOB-RORABAUGH E COOPER-JACOB)',
      120
    );

    this.executarAutoTable({
      head: [
        [
          'Etapa',
          'Duração',
          'Q (m³/h)',
          'N.E. (m)',
          'N.D. (m)',
          's med (m)',
          's/Q',
          'Q/s',
          's calc (m)',
          'Efic. (η)',
        ],
      ],
      body: calc.etapasCalculadas.map((et) => [
        { content: `${et.etapa}ª`, styles: { fontStyle: 'bold', halign: 'center' } },
        { content: `${et.duracaoMinutos} min`, styles: { halign: 'center' } },
        {
          content: fmtNumeroSEMA(et.vazao, 2),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        { content: fmtNumeroSEMA(calc.neInicial, 2), styles: { halign: 'right' } },
        { content: fmtNumeroSEMA(et.nd, 2), styles: { halign: 'right' } },
        {
          content: fmtNumeroSEMA(et.rebaixamento, 2),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: fmtNumeroSEMA(et.rebaixamentoEspecifico, 4),
          styles: { halign: 'right' },
        },
        {
          content: fmtNumeroSEMA(et.capacidadeEspecifica, 4),
          styles: { halign: 'right' },
        },
        {
          content: fmtNumeroSEMA(et.sCalc, 2),
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: fmtNumeroSEMA(et.eficienciaPct, 1, '%'),
          styles: {
            fontStyle: 'bold',
            textColor: this.config.cores.green,
            halign: 'right',
          },
        },
      ]),
      theme: 'grid',
      styles: { fontSize: 7.4 },
    });

    // Equações em Formato de Livro (Eq. 4, Eq. 5, Eq. 3 e Eq. 1) no Anexo I.3
    equacoesAnexo.anexoI3Jacob.forEach((eqSpec) => {
      this.renderizarBlocoEquacaoLivro(eqSpec, false);
    });
    equacoesAnexo.anexoI3Cooper.forEach((eqSpec) => {
      this.renderizarBlocoEquacaoLivro(eqSpec, false);
    });

    // Bloco 3: Condições Operacionais Definitivas e Unificadas via AutoTable
    this.executarAutoTable({
      head: [
        [
          {
            content:
              'CONDIÇÕES OPERACIONAIS DEFINITIVAS E UNIFICADAS RECOMENDADAS (POÇO PT01)',
            styles: { halign: 'center' },
          },
        ],
      ],
      body: [
        [
          {
            content:
              'Vazão de Operação Recomendada: 10,29 m³/h   |   Nível Estático (NE): 22,40 m   |   Nível Dinâmico Estabilizado (ND): 64,10 m\nProfundidade Única de Instalação da Bomba: 84,00 m (Posição acima do topo do crivo e submergência de 19,90 m acima do ND máximo)',
            styles: {
              halign: 'center',
              fontStyle: 'bold',
              fillColor: this.config.cores.fundoConformidade,
              textColor: this.config.cores.navy,
              fontSize: 7.9,
              cellPadding: { top: 2.2, right: 3, bottom: 2.2, left: 3 },
            },
          },
        ],
      ],
      theme: 'grid',
    });
  }

  private desenharGraficoSemiLogMeiaPagina(
    tituloVertical: string,
    labelHorizontal: string,
    pontos: { s: number; t: number }[],
    tMaxLog: number,
    gyStart: number,
    ghHeight: number
  ): void {
    const { larguraMm } = this.config.pagina;
    const { direitaMm } = this.config.margens;
    const gx = 28;
    const gy = gyStart;
    const gw = larguraMm - gx - direitaMm;
    const gh = ghHeight;

    this.doc.setFillColor(235, 246, 249);
    this.doc.setDrawColor(...this.config.cores.navy);
    this.doc.setLineWidth(0.35);
    this.doc.rect(gx, gy, gw, gh, 'FD');

    const validos = pontos.filter((p) => p.s >= 0 && p.t >= 1);
    const minS =
      validos.length > 0
        ? Math.max(0, Math.floor(Math.min(...validos.map((p) => p.s)) - 1))
        : 0;
    const maxS =
      validos.length > 0
        ? Math.ceil(Math.max(...validos.map((p) => p.s)) + 2)
        : 45;
    const spanS = Math.max(5, maxS - minS);
    const logMax = Math.log10(tMaxLog);

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(6.2);
    this.doc.setTextColor(...this.config.cores.navy);

    // Linhas horizontais: Rebaixamento s (m) linear no eixo Y
    const passoS = spanS > 28 ? 5 : 2;
    for (let sVal = minS; sVal <= maxS; sVal += passoS) {
      const py = gy + gh - ((sVal - minS) / spanS) * gh;
      this.doc.setDrawColor(184, 216, 227);
      this.doc.setLineWidth(0.15);
      this.doc.line(gx, py, gx + gw, py);
      this.doc.text(String(sVal), gx - 2, py + 1.5, { align: 'right' });
    }

    // Linhas verticais logarítmicas: Tempo t (min) no eixo X
    const ticksT = [1, 2, 5, 10, 20, 50, 100, 200, 400, 600, 1000].filter(
      (d) => d <= tMaxLog
    );
    ticksT.forEach((tDec) => {
      const px = gx + (Math.log10(tDec) / logMax) * gw;
      const isMajor =
        tDec === 1 || tDec === 10 || tDec === 100 || tDec === 1000;
      this.doc.setDrawColor(
        isMajor ? 106 : 184,
        isMajor ? 159 : 216,
        isMajor ? 178 : 227
      );
      this.doc.setLineWidth(isMajor ? 0.3 : 0.15);
      this.doc.line(px, gy, px, gy + gh);
      this.doc.text(String(tDec), px, gy + gh + 3.8, { align: 'center' });
    });

    // Rótulos dos eixos
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(7.2);
    this.doc.text(
      `${labelHorizontal} — Escala Logarítmica (min)`,
      gx + gw / 2,
      gy + gh + 7.5,
      { align: 'center' }
    );
    this.doc.text(tituloVertical, 18, gy + gh / 2 + 12, { angle: 90 });

    // Plotar curva s × log t
    if (validos.length > 0) {
      this.doc.setDrawColor(0, 34, 204);
      this.doc.setFillColor(0, 34, 204);
      this.doc.setLineWidth(0.45);

      let antX: number | null = null;
      let antY: number | null = null;

      validos.forEach((pt) => {
        const tClamped = Math.min(tMaxLog, Math.max(1, pt.t));
        const px = gx + (Math.log10(tClamped) / logMax) * gw;
        const py = gy + gh - ((pt.s - minS) / spanS) * gh;

        if (antX !== null && antY !== null) {
          this.doc.line(antX, antY, px, py);
        }
        this.doc.circle(px, py, 0.75, 'F');
        antX = px;
        antY = py;
      });
    }
  }

  /**
   * Desenha o Cabeçalho Timbre Padrão Corporativo na página atual,
   * posicionado rigorosamente segundo `this.config.margens` e `this.config.cabecalho`.
   */
  public desenharCabecalhoTimbrePagina(): void {
    const { esquerdaMm, superiorMm, alturaTimbreCabecalhoMm } =
      this.config.margens;
    const {
      cnpjPadrao,
      enderecoPadrao,
      cidadeContatoPadrao,
      emailPadrao,
      logoLarguraMm,
      logoAlturaMm,
    } = this.config.cabecalho;
    const { navy, navyInstitucional, white, bordaTabela } = this.config.cores;

    const cnpjEmpresa = valOuPreencherPDF(
      this.relatorio.cabecalho.cnpj,
      cnpjPadrao
    );
    const enderecoEmpresa = valOuPreencherPDF(
      this.relatorio.cabecalho.enderecoEmpresa,
      enderecoPadrao
    );
    const cidadeContatoEmpresa = valOuPreencherPDF(
      this.relatorio.cabecalho.cidadeContatoEmpresa,
      cidadeContatoPadrao
    );
    const emailEmpresa = valOuPreencherPDF(
      this.relatorio.cabecalho.emailEmpresa,
      emailPadrao
    );

    this.doc.setFillColor(...white);
    this.doc.rect(
      esquerdaMm,
      superiorMm,
      this.larguraUtil,
      alturaTimbreCabecalhoMm,
      'F'
    );

    if (this.relatorio.cabecalho.logoBase64) {
      try {
        const imgSrc = this.relatorio.cabecalho.logoBase64;
        const fmt = imgSrc.includes('image/png') ? 'PNG' : 'JPEG';
        this.doc.addImage(
          imgSrc,
          fmt,
          esquerdaMm + 4,
          superiorMm + 5.5,
          logoLarguraMm,
          logoAlturaMm,
          undefined,
          'FAST'
        );
      } catch {
        this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
        this.doc.setFontSize(14);
        this.doc.setTextColor(...navy);
        this.doc.text('HIDROGEO', esquerdaMm + 10, superiorMm + 15.5);
      }
    } else {
      this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
      this.doc.setFontSize(14);
      this.doc.setTextColor(...navy);
      this.doc.text('HIDROGEO', esquerdaMm + 10, superiorMm + 15.5);
    }

    const centerX = esquerdaMm + 62 + (this.larguraUtil - 62) / 2;
    this.doc.setTextColor(...navyInstitucional);
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(9.5);
    this.doc.text(this.razaoEmpresa.toUpperCase(), centerX, superiorMm + 7, {
      align: 'center',
    });

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(50, 50, 50);
    this.doc.text(`CNPJ: ${cnpjEmpresa}`, centerX, superiorMm + 11.5, {
      align: 'center',
    });
    this.doc.text(enderecoEmpresa, centerX, superiorMm + 15.5, {
      align: 'center',
    });
    this.doc.text(cidadeContatoEmpresa, centerX, superiorMm + 19.5, {
      align: 'center',
    });
    this.doc.text(`E-mail: ${emailEmpresa}`, centerX, superiorMm + 23.5, {
      align: 'center',
    });

    // Linha divisória sutil abaixo do cabeçalho institucional
    this.doc.setDrawColor(...bordaTabela);
    this.doc.setLineWidth(0.25);
    this.doc.line(
      esquerdaMm,
      superiorMm + alturaTimbreCabecalhoMm - 1,
      esquerdaMm + this.larguraUtil,
      superiorMm + alturaTimbreCabecalhoMm - 1
    );
  }

  /**
   * Aplica Cabeçalho, Rodapé e Numeração de Páginas em todas as páginas geradas,
   * respeitando as regras ABNT (folha de rosto contada sequencialmente, porém
   * identificada como Folha de Rosto ou sem impressão de numeração conforme configuração).
   */
  public aplicarCabecalhoERodapeGlobal(possuiFolhaDeRosto = true): void {
    const { larguraMm } = this.config.pagina;
    const { esquerdaMm } = this.config.margens;
    const {
      cidadeSedePadrao,
      normasTecnicasPadrao,
      exibirNumeracaoNaFolhaDeRosto,
      alturaFaixaMm,
      posicaoYTextoMm,
      posicaoYLinhaMm,
    } = this.config.rodape;

    const totalPages = this.doc.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      const isFolhaDeRosto = possuiFolhaDeRosto && i === 1;

      if (!isFolhaDeRosto || this.config.cabecalho.exibirTimbreNaFolhaDeRosto) {
        this.desenharCabecalhoTimbrePagina();
      }

      // Faixa limpa de rodapé
      this.doc.setFillColor(...this.config.cores.white);
      this.doc.rect(0, posicaoYLinhaMm - 1, larguraMm, alturaFaixaMm + 2, 'F');

      this.doc.setDrawColor(...this.config.cores.bordaTabela);
      this.doc.setLineWidth(0.25);
      this.doc.line(
        esquerdaMm,
        posicaoYLinhaMm,
        esquerdaMm + this.larguraUtil,
        posicaoYLinhaMm
      );

      this.doc.setTextColor(115, 130, 150);
      this.doc.setFontSize(this.config.tipografia.tamanhoRodapePt);
      this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');

      const sufixoPaginacao =
        isFolhaDeRosto && !exibirNumeracaoNaFolhaDeRosto
          ? 'Folha de Rosto Institucional (ABNT NBR 10719)'
          : `Página ${i} de ${totalPages}`;

      this.doc.text(
        `${this.razaoEmpresa} | ${cidadeSedePadrao} | ${normasTecnicasPadrao} | ${sufixoPaginacao}`,
        larguraMm / 2,
        posicaoYTextoMm,
        { align: 'center' }
      );
    }
  }

  /**
   * Orquestra a exportação completa do Relatório Técnico (Folha de Rosto + Corpo Técnico + Anexos)
   */
  public async exportarRelatorioCompleto(): Promise<string> {
    // 0. Captura os elementos de fórmula matemática (SVG -> PNG 384 DPI)
    await this.preCapturarFormulasMatematicas();

    // 1. Folha de Rosto (Página 1)
    this.renderizarFolhaDeRostoABNT();

    // 2. Corpo Técnico (Página 2 em diante, separado estritamente da Folha de Rosto)
    this.renderizarCorpoTecnico();

    // 3. Anexos de Teste de Bombeamento (Anexos I.1, I.2 e I.3), se ativos
    if (this.relatorio.dadosPoco?.testeVazaoSEMA?.ativo && this.relatorio.secoesVisiveis?.anexos !== false) {
      this.renderizarAnexosTesteBombeamento(true);
    }

    // 4. Aplicação unificada de Cabeçalho, Rodapé e Paginação via constantes configuráveis
    this.aplicarCabecalhoERodapeGlobal(true);

    const osSanitizada = valOuPreencherPDF(
      this.relatorio.cabecalho.contratoOS,
      'OS-2026-0842'
    )
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .toUpperCase();
    const nomeArquivo = `Laudo-Tecnico-OS-${osSanitizada}-${
      this.relatorio.cabecalho.dataExecucao || '2026-03-13'
    }.pdf`;

    this.doc.save(nomeArquivo);
    return nomeArquivo;
  }

  /**
   * Exporta exclusivamente os Anexos I.1, I.2 e I.3 do Teste de Bombeamento
   */
  public async exportarApenasAnexoTesteBombeamento(): Promise<string> {
    await this.preCapturarFormulasMatematicas();
    this.renderizarAnexosTesteBombeamento(false);
    this.aplicarCabecalhoERodapeGlobal(false);

    const tagSanitizada = valOuPreencherPDF(
      this.relatorio.dadosPoco.pocoId,
      'PT01'
    ).replace(/[^a-zA-Z0-9-_]/g, '_');
    const nomePDF = `ANEXO_TESTE_DE_BOMBEAMENTO_${tagSanitizada}_HIDROGEO.pdf`;
    this.doc.save(nomePDF);
    return nomePDF;
  }
}

/**
 * Gera o Relatório Técnico de Entrega em PDF A4 utilizando a classe utilitária `RelatorioPDFExporter`
 * com `jspdf-autotable`, constantes configuráveis de página/margens/cabeçalho/rodapé e Folha de Rosto ABNT separada.
 */
export async function exportarRelatorioPDF(
  relatorio: RelatorioTecnico,
  customConfig?: Partial<ConfiguracaoLayoutPDFA4>
): Promise<string> {
  const exporter = new RelatorioPDFExporter(relatorio, customConfig);
  return exporter.exportarRelatorioCompleto();
}

export async function exportarPDFTesteBombeamentoGeoeste(
  relatorio: RelatorioTecnico,
  customConfig?: Partial<ConfiguracaoLayoutPDFA4>
): Promise<string> {
  const exporter = new RelatorioPDFExporter(relatorio, customConfig);
  return exporter.exportarApenasAnexoTesteBombeamento();
}
