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
import {
  extrairCoordenadasGeograficas,
  latLngParaUTM,
  renderizarMapaOSMCanvasDataUrl,
} from '../utils/coordenadasParser';

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
    cidadeSedePadrao?: string;
    normasTecnicasPadrao?: string;
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
    razaoSocialPadrao: '',
    cnpjPadrao: '',
    enderecoPadrao: '',
    cidadeContatoPadrao: '',
    emailPadrao: '',
    logoLarguraMm: 52.5,
    logoAlturaMm: 15.5,
    exibirTimbreNaFolhaDeRosto: true,
  },
  rodape: {
    contarFolhaDeRostoNaPaginacao: true,
    exibirNumeracaoNaFolhaDeRosto: true,
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
  private mapaLocalizacaoDataUrl: string | null = null;

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
      this.relatorio.cabecalho.responsavelTecnicoNome ||
        this.relatorio.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoNome ||
        this.relatorio.assinaturaResponsavel?.nomeSignatario,
      'José Roberto Ribeiro'
    );
  }

  private get respTecnicoCREA(): string {
    return valOuPreencherPDF(
      this.relatorio.cabecalho.responsavelTecnicoCREA ||
        this.relatorio.dadosPoco?.testeVazaoSEMA?.responsavelTecnicoCREA ||
        this.relatorio.assinaturaResponsavel?.documento,
      'DADO A PREENCHER EM CAMPO'
    );
  }

  private get respElaboracaoNome(): string {
    return valOuPreencherPDF(
      this.relatorio.cabecalho.responsavelElaboracaoNome ||
        this.relatorio.assinaturaCliente?.nomeSignatario,
      'Departamento Técnico de Hidrogeologia'
    );
  }

  private get respElaboracaoCargo(): string {
    return valOuPreencherPDF(
      this.relatorio.cabecalho.responsavelElaboracaoCargo ||
        this.relatorio.assinaturaCliente?.funcao,
      'Responsável pela Elaboração do Relatório Técnico'
    );
  }

  private get respTecnicoFormatado(): string {
    return `${this.respTecnicoNome}, - ${this.respTecnicoCREA}`;
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

    await this.preCapturarMapaLocalizacao();
  }

  /**
   * Pré-captura a imagem de mapa OpenStreetMap / Esri Satélite para inclusão automática na Seção 3 do PDF
   */
  private async preCapturarMapaLocalizacao(): Promise<void> {
    const coord = extrairCoordenadasGeograficas(
      this.relatorio.dadosPoco?.coordenadasGeograficas,
      this.relatorio.cabecalho?.coordenadasGeograficas,
      this.relatorio.dadosPoco?.coordenadasUTM
    );
    if (!coord) return;

    try {
      const dataUrl = await renderizarMapaOSMCanvasDataUrl({
        lat: coord.lat,
        lng: coord.lng,
        zoom: 16,
        width: 860,
        height: 160,
        layer: 'satellite',
        pocoTag: this.relatorio.dadosPoco?.pocoId || 'PT01',
      });
      if (dataUrl) {
        this.mapaLocalizacaoDataUrl = dataUrl;
      }
    } catch {
      // Fallback vetorial caso o ambiente esteja offline
    }
  }

  /**
   * Renderiza o bloco compacto de Mapa Georreferenciado do Poço na Seção 3 (Cliente e Local)
   */
  private desenharBlocoMapaLocalizacaoPDF(): void {
    const coord = extrairCoordenadasGeograficas(
      this.relatorio.dadosPoco?.coordenadasGeograficas,
      this.relatorio.cabecalho?.coordenadasGeograficas,
      this.relatorio.dadosPoco?.coordenadasUTM
    );
    if (!coord) return;

    const { esquerdaMm } = this.config.margens;
    const { navy, amber, white, textMuted, bordaTabela } = this.config.cores;
    const utm = latLngParaUTM(coord.lat, coord.lng);
    const tagPoco = valOuPreencherPDF(this.relatorio.dadosPoco?.pocoId, 'PT01');

    const boxH = 24;
    this.garantirEspacoVertical(boxH + 2);

    const startY = this.cursorY - 0.5;
    const mapW = 118;
    const infoW = this.larguraUtil - mapW - 2;
    const infoX = esquerdaMm + mapW + 2;

    // Moldura geral
    this.doc.setFillColor(250, 251, 253);
    this.doc.setDrawColor(...bordaTabela);
    this.doc.setLineWidth(0.2);
    this.doc.rect(esquerdaMm, startY, this.larguraUtil, boxH, 'FD');

    // Área do Mapa (Esquerda)
    const mapX = esquerdaMm + 1.2;
    const mapY = startY + 1.2;
    const mapInnerW = mapW - 1.8;
    const mapInnerH = boxH - 2.4;

    if (this.mapaLocalizacaoDataUrl) {
      try {
        const fmt = this.mapaLocalizacaoDataUrl.includes('image/jpeg')
          ? 'JPEG'
          : 'PNG';
        this.doc.addImage(
          this.mapaLocalizacaoDataUrl,
          fmt,
          mapX,
          mapY,
          mapInnerW,
          mapInnerH,
          undefined,
          'FAST'
        );
      } catch {
        this.desenharMalhaCartograficaFallback(
          mapX,
          mapY,
          mapInnerW,
          mapInnerH,
          coord.lat,
          coord.lng
        );
      }
    } else {
      this.desenharMalhaCartograficaFallback(
        mapX,
        mapY,
        mapInnerW,
        mapInnerH,
        coord.lat,
        coord.lng
      );
    }

    this.doc.setDrawColor(...bordaTabela);
    this.doc.rect(mapX, mapY, mapInnerW, mapInnerH, 'S');

    // Tarja identificadora sobre o mapa
    this.doc.setFillColor(...navy);
    this.doc.rect(mapX + 1.2, mapY + 1.2, 62, 4.2, 'F');
    this.doc.setFillColor(...amber);
    this.doc.circle(mapX + 3, mapY + 3.3, 0.8, 'F');
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(5.8);
    this.doc.setTextColor(...white);
    this.doc.text(
      sanitizarTextoWinAnsiPDF(`${tagPoco}`),
      mapX + 4.8,
      mapY + 4.0
    );

    // Painel lateral direito de Georreferenciamento SIRGAS 2000
    const cardY = startY + 1.2;
    const cardH = boxH - 2.4;
    this.doc.setFillColor(...white);
    this.doc.setDrawColor(...bordaTabela);
    this.doc.rect(infoX, cardY, infoW - 1.2, cardH, 'FD');

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(6.5);
    this.doc.setTextColor(...navy);
    this.doc.text('(SIRGAS 2000)', infoX + 2, cardY + 3.8);

    this.doc.setDrawColor(235, 240, 245);
    this.doc.line(infoX + 1.5, cardY + 4.8, infoX + infoW - 2.7, cardY + 4.8);

    const linhasGeo: Array<[string, string]> = [
      ['LATITUDE:', `${coord.lat.toFixed(6)}°`],
      ['LONGITUDE:', `${coord.lng.toFixed(6)}°`],
      ['GMS:', sanitizarTextoWinAnsiPDF(coord.dmsFormatado)],
      [
        'FUSO UTM:',
        `${utm.zona}${utm.banda} (E:${utm.easting} / N:${utm.northing})`,
      ],
    ];

    let yGeo = cardY + 8.0;
    for (const [rotulo, valor] of linhasGeo) {
      this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
      this.doc.setFontSize(6.1);
      this.doc.setTextColor(...textMuted);
      this.doc.text(rotulo, infoX + 2, yGeo);

      this.doc.setFont('courier', 'bold');
      this.doc.setFontSize(6.2);
      this.doc.setTextColor(...navy);
      this.doc.text(valor, infoX + infoW - 3, yGeo, { align: 'right' });
      yGeo += 3.6;
    }

    this.cursorY = startY + boxH + 2.2;
  }

  private desenharMalhaCartograficaFallback(
    x: number,
    y: number,
    w: number,
    h: number,
    lat: number,
    lng: number
  ): void {
    const { navy, amber } = this.config.cores;
    this.doc.setFillColor(232, 238, 245);
    this.doc.rect(x, y, w, h, 'F');

    this.doc.setDrawColor(210, 220, 232);
    this.doc.setLineWidth(0.12);
    for (let gx = x + 12; gx < x + w; gx += 12) {
      this.doc.line(gx, y, gx, y + h);
    }
    for (let gy = y + 6; gy < y + h; gy += 6) {
      this.doc.line(x, gy, x + w, gy);
    }

    const cx = x + w / 2;
    const cy = y + h / 2;
    this.doc.setDrawColor(...navy);
    this.doc.setLineWidth(0.22);
    this.doc.circle(cx, cy, 4.5, 'S');
    this.doc.setFillColor(...amber);
    this.doc.circle(cx, cy, 1.6, 'FD');

    this.doc.setFont('courier', 'bold');
    this.doc.setFontSize(6.2);
    this.doc.setTextColor(...navy);
    this.doc.text(
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      cx,
      y + h - 1.8,
      { align: 'center' }
    );
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
    const { navy, amber, white, textMuted } = this.config.cores;
    const vis = this.relatorio.secoesVisiveis;

    const yCapa = this.config.margens.topoCorpoTecnicoMm;

    // Moldura Corporativa de Destaque do Título do Relatório (compactada para 22mm)
    this.doc.setFillColor(...navy);
    this.doc.rect(esquerdaMm, yCapa, this.larguraUtil, 22, 'F');
    this.doc.setFillColor(...amber);
    this.doc.rect(esquerdaMm, yCapa, 4, 22, 'F');

    this.doc.setTextColor(...white);
    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(13);
    this.doc.text(
      'RELATÓRIO TÉCNICO DE ENTREGA DE SERVIÇOS',
      larguraMm / 2 + 2,
      yCapa + 10.5,
      { align: 'center' }
    );

    const tagPoco = valOuPreencherPDF(this.relatorio.dadosPoco?.pocoId, 'PT01');
    const numOS = valOuPreencherPDF(
      this.relatorio.cabecalho.contratoOS,
      'OS-2026-0842 / CTR-119'
    );
    this.doc.setFontSize(9);
    this.doc.text(
      `POÇO TUBULAR PROFUNDO (${tagPoco})  •  ORDEM DE SERVIÇO: ${numOS}`,
      larguraMm / 2 + 2,
      yCapa + 17.5,
      { align: 'center' }
    );

    this.cursorY = yCapa + 25.5;

    // 1. IDENTIFICAÇÃO DO CONTRATANTE / INTERESSADO
    this.desenharBarraSecao('1. IDENTIFICAÇÃO DO CONTRATANTE / INTERESSADO (AO)');
    this.executarAutoTable({
      body: [
        [
          { content: 'CLIENTE', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.cliente), colSpan: 3, styles: { fontStyle: 'bold' } },
        ],
        [
          { content: 'CNPJ / CPF', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.clienteCNPJ) },
          { content: 'CONTATO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.contatoLocal) },
        ],
        [
          { content: 'LOCAL DA PRESTAÇÃO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.localizacao), colSpan: 3 },
        ],
        [
          { content: 'CIDADE / UF', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.cidadeUF, 'Ribeirão Preto - SP') },
          { content: 'TELEFONE', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.telefoneContato) },
        ],
      ],
      theme: 'grid',
      styles: { cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 }, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { cellWidth: 35 },
        3: { cellWidth: 56 },
      },
    });

    // 2. DADOS CONTRATUAIS, RESPONSABILIDADE TÉCNICA E NORMAS ABNT
    this.desenharBarraSecao('2. DADOS CONTRATUAIS, RESPONSÁVEL TÉCNICO E NORMAS APLICADAS');
    this.executarAutoTable({
      body: [
        [
          { content: 'ORDEM DE SERVIÇO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: numOS, styles: { fontStyle: 'bold' } },
          { content: 'CONTRATO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.contratoRef, 'CTR-119 / 2026') },
        ],
        [
          { content: 'DATA DA EXECUÇÃO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: formatarDataBR(this.relatorio.cabecalho.dataExecucao) },
          { content: 'STATUS', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          {
            content: valOuPreencherPDF(this.relatorio.cabecalho.statusOS, 'Concluído'),
            styles: { fontStyle: 'bold', textColor: this.config.cores.green },
          },
        ],
        [
          { content: 'TIPO DE SERVIÇO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: valOuPreencherPDF(this.relatorio.cabecalho.tipoServico), colSpan: 3 },
        ],
        [
          { content: 'RESPONSÁVEL TÉCNICO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: this.respTecnicoNome, styles: { fontStyle: 'bold' } },
          { content: 'REGISTRO', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          { content: `CREA: ${this.respTecnicoCREA}` },
        ],
        [
          { content: 'NORMAS APLICADAS', styles: { fontStyle: 'bold', textColor: textMuted, fontSize: 7.1 } },
          {
            content:
              'ABNT NBR 12212 (Projeto de poço tubular), ABNT NBR 12244 (Construção e ensaio de bombeamento de poço tubular) e ABNT NBR 10719 (Relatórios técnicos).',
            colSpan: 3,
          },
        ],
      ],
      theme: 'grid',
      styles: { cellPadding: { top: 1.2, right: 2, bottom: 1.2, left: 2 }, fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 53 },
        2: { cellWidth: 35 },
        3: { cellWidth: 56 },
      },
    });

    // SEÇÃO 3: CLIENTE E LOCAL (AGORA NA PÁGINA 1)
    if (vis?.clienteLocal !== false) {
      this.desenharBarraSecao('3. CLIENTE E LOCAL');
      this.renderizarTabelaPares2Colunas([
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
      ]);
      this.desenharBlocoMapaLocalizacaoPDF();
    }

    // SEÇÃO 4: INFORMAÇÕES DO POÇO (AGORA NA PÁGINA 1)
    if (vis?.informacoesPoco !== false) {
      this.desenharBarraSecao('4. INFORMAÇÕES DO POÇO');
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
    }
  }

  public renderizarCorpoTecnico(): void {
    // Inicia a Página 2 diretamente na Seção 5
    this.adicionarPaginaCorpoTecnico();

    const vis = this.relatorio.secoesVisiveis;

    // SEÇÃO 5: DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO
    if (vis?.desenhoConstrutivo !== false) {
      this.desenharBarraSecao('5. DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO');
      this.renderizarQuadroTextoTecnico(
        'Especificação Construtiva, Cimentação Sanitária (0-24m) e Laje de Proteção (ABNT NBR 12212 / 12244)',
        valOuPreencherPDF(
          this.relatorio.dadosPoco?.desenhoConstrutivo,
          `• Profundidade Final: 160,00 m.\n• Coluna de Revestimento (Casing): Aço Carbono Schedule 40 Ø 6" (152,4 mm).\n• Cimentação Sanitária: Espaço anular cimentado de 0,00 m a 24,00 m de profundidade.\n• Laje de Proteção Sanitária: Concreto armado 1,50 m × 1,50 m × 0,15 m com tampa hermética e hidrômetro.\n• Crivo / Filtro: [DADO A PREENCHER EM CAMPO — Abaixo de 84,00 m].\n• Instalação da Bomba Submersa: Profundidade única de 84,00 m (SEMPRE acima do topo do crivo e com submergência de 19,90 m acima do ND máximo de 64,10 m).`
        )
      );
    }

    // SEÇÃO 6: SERVIÇOS TÉCNICOS EXECUTADOS
    if (vis?.servicosExecutados !== false) {
      this.desenharBarraSecao('6. SERVIÇOS TÉCNICOS EXECUTADOS');
      this.renderizarQuadroTextoTecnico(
        '6.1 Memorial Descritivo (Objetivo, Perfuração, Desenvolvimento Air-Lift, Teste 24h e Comissionamento)',
        valOuPreencherPDF(this.relatorio.descricaoServico)
      );

      const servicosValidos = (this.relatorio.servicosConduzidos || []).filter((s) =>
        s.descricao.trim()
      );
      if (servicosValidos.length > 0) {
        this.executarAutoTable({
          head: [['#', '6.2 Descrição dos Serviços Conduzidos', 'Unidade', 'Qtd', 'Status']],
          body: servicosValidos.map((srv, idx) => [
            String(idx + 1),
            valOuPreencherPDF(srv.descricao),
            valOuPreencherPDF(srv.unidade, 'UN'),
            valOuPreencherPDF(srv.quantidade, '1'),
            {
              content: valOuPreencherPDF(srv.status, 'Executado'),
              styles: { fontStyle: 'bold', textColor: this.config.cores.green, halign: 'center' },
            },
          ]),
          theme: 'grid',
          columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 104 },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 18, halign: 'center' },
            4: { cellWidth: 30, halign: 'center' },
          },
        });
      }

      const equipeValida = (this.relatorio.equipe || []).filter(
        (m) => m.nome.trim() || m.funcao.trim()
      );
      if (equipeValida.length > 0) {
        this.executarAutoTable({
          head: [['#', '6.3 Profissional / Equipe Técnica Mobilizada', 'Função / Atribuição em Campo']],
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
          head: [['#', '6.4 Materiais e Insumos Aplicados no Poço', 'Unidade', 'Qtd', 'Situação']],
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

    // SEÇÃO 7: PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA DE OPERAÇÃO (COM FÓRMULAS EM FORMATO DE LIVRO)
    if (vis?.parecerHidrogeologico !== false) {
      this.desenharBarraSecao('7. PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA DE OPERAÇÃO');
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

    // SEÇÃO 8: CHECKLIST DE CONFORMIDADE E SEGURANÇA
    if (vis?.checklist !== false && this.relatorio.checklist && this.relatorio.checklist.length > 0) {
      this.desenharBarraSecao('8. CHECKLIST DE CONFORMIDADE E SEGURANÇA');
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

    // SEÇÃO 9: RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO
    if (vis?.recomendacoes !== false) {
      this.desenharBarraSecao('9. RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO');
      const oc = this.relatorio.ocorrenciasCampo;
      this.renderizarQuadroTextoTecnico(
        '9.1 Diretrizes Operacionais, Monitoramento e Manutenção Preventiva',
        valOuPreencherPDF(
          oc?.recomendacoes,
          '1. Manter a operação na vazão recomendada de 10,29 m³/h e bomba instalada a 84,00 m.\n2. Monitorar mensalmente NE, ND, hidrômetro e parâmetros elétricos.\n3. Realizar análise físico-química e microbiológica semestral (Portaria GM/MS nº 888/2021).'
        )
      );
      this.renderizarQuadroTextoTecnico(
        '9.2 Observações Técnicas e Unificação Documental',
        valOuPreencherPDF(
          oc?.observacoesGerais,
          'Unificados todos os parâmetros pelo Teste Contínuo 24h a vazão constante de 13/03/2026 (NE = 22,40 m, ND = 64,10 m, Q = 10,29 m³/h, Bomba = 84,00 m). Nenhuma pendência remanescente.'
        )
      );
    }

    // SEÇÃO 10: REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS
    const fotosOrdenadas = [...this.relatorio.fotos].sort(
      (a, b) => a.ordem - b.ordem
    );
    if (vis?.fotos !== false && fotosOrdenadas.length > 0) {
      this.desenharBarraSecao('10. REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS', 46);

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

    // SEÇÃO 11: ASSINATURAS
    if (vis?.assinaturas !== false) {
      this.desenharBarraSecao('11. ASSINATURAS', 38);
      this.desenharBlocoAssinaturas();
    }
  }

private desenharBlocoAssinaturas(): void {
    const { esquerdaMm } = this.config.margens;
    const { larguraMm } = this.config.pagina;
    const { navy } = this.config.cores;

    const textoDeclaracao = `Declaramos que os serviços referentes à ${valOuPreencherPDF(
      this.relatorio.cabecalho.contratoOS
    )} (Poço ${valOuPreencherPDF(
      this.relatorio.dadosPoco?.pocoId,
      'PT01'
    )}) foram integralmente executados, comissionados e documentados segundo as normas ABNT NBR 12212 e NBR 12244.`;

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(7.5);

    const linhasDeclaracao: string[] = this.doc.splitTextToSize(
      textoDeclaracao,
      this.larguraUtil - 8
    );

    const alturaTextoMm = linhasDeclaracao.length * 3.6;
    const offsetAssinaturaY = Math.max(8.5, 4 + alturaTextoMm + 2);
    const alturaTotalCaixaMm = offsetAssinaturaY + 26.5;

    this.garantirEspacoVertical(alturaTotalCaixaMm + 2);

    this.doc.setFillColor(250, 251, 253);
    this.doc.setDrawColor(221, 227, 236);
    this.doc.rect(esquerdaMm, this.cursorY, this.larguraUtil, alturaTotalCaixaMm, 'FD');

    this.doc.setTextColor(70, 80, 95);
    this.doc.text(
      linhasDeclaracao,
      larguraMm / 2,
      this.cursorY + 5.5,
      { align: 'center' }
    );

    const sigW = (this.larguraUtil - 20) / 2;

    // Imagens de rubrica/assinatura digital se presentes
    if (this.relatorio.assinaturaResponsavel?.dataUrl) {
      try {
        const fmt = this.relatorio.assinaturaResponsavel.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        this.doc.addImage(
          this.relatorio.assinaturaResponsavel.dataUrl,
          fmt,
          esquerdaMm + 4 + (sigW - 32) / 2,
          this.cursorY + offsetAssinaturaY,
          32,
          8.5,
          undefined,
          'FAST'
        );
      } catch {
        // Fallback silencioso
      }
    }

    if (this.relatorio.assinaturaCliente?.dataUrl) {
      try {
        const fmt = this.relatorio.assinaturaCliente.dataUrl.includes('image/png') ? 'PNG' : 'JPEG';
        this.doc.addImage(
          this.relatorio.assinaturaCliente.dataUrl,
          fmt,
          larguraMm - esquerdaMm - 4 - sigW + (sigW - 32) / 2,
          this.cursorY + offsetAssinaturaY,
          32,
          8.5,
          undefined,
          'FAST'
        );
      } catch {
        // Fallback silencioso
      }
    }

    const linhaAssinaturaY = this.cursorY + offsetAssinaturaY + 9.5;

    this.doc.setDrawColor(...navy);
    this.doc.setLineWidth(0.35);
    this.doc.line(
      esquerdaMm + 4,
      linhaAssinaturaY,
      esquerdaMm + 4 + sigW,
      linhaAssinaturaY
    );
    this.doc.line(
      larguraMm - esquerdaMm - 4 - sigW,
      linhaAssinaturaY,
      larguraMm - esquerdaMm - 4,
      linhaAssinaturaY
    );

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'bold');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...navy);
    this.doc.text(
      this.respTecnicoFormatado,
      esquerdaMm + 4 + sigW / 2,
      linhaAssinaturaY + 4.5,
      { align: 'center' }
    );
    this.doc.text(
      `${this.respElaboracaoNome}`,
      larguraMm - esquerdaMm - 4 - sigW / 2,
      linhaAssinaturaY + 4.5,
      { align: 'center' }
    );

    this.doc.setFont(this.config.tipografia.familiaPadrao, 'normal');
    this.doc.setFontSize(7);
    this.doc.setTextColor(90, 100, 115);
    this.doc.text(
      'Responsável Técnico — Engenheiro Geólogo / Hidrogeólogo',
      esquerdaMm + 4 + sigW / 2,
      linhaAssinaturaY + 8.5,
      { align: 'center' }
    );
    this.doc.text(
      this.respElaboracaoCargo,
      larguraMm - esquerdaMm - 4 - sigW / 2,
      linhaAssinaturaY + 8.5,
      { align: 'center' }
    );

    this.cursorY += alturaTotalCaixaMm + 3;
  }

  /**
   * 3. ANEXOS TÉCNICOS DE TESTE DE BOMBEAMENTO (ANEXOS I.1, I.2 E I.3)
   * Utiliza `jspdf-autotable` para todas as planilhas hidrodinâmicas e desenha os gráficos semi-log vetoriais.
   */
  public renderizarAnexosTesteBombeamento(iniciarEmNovaPagina = true): void {
    const teste = this.relatorio.dadosPoco?.testeVazaoSEMA || {
      ativo: true,
      tipoEnsaio: 'Contínuo 24h a Vazão Constante',
      etapaLabel: '24H',
      referenciaMedidasM: '0,00',
      responsavelTecnicoNome: this.respTecnicoNome,
      responsavelTecnicoCREA: this.respTecnicoCREA,
      responsavelTecnicoCPF: '',
      artNumero: '[DADO A PREENCHER EM CAMPO]',
      dataInicioEnsaio: this.relatorio.cabecalho.dataExecucao || '2026-03-13',
      horaInicioBombeamento: '11:30:00',
      dataFinalBombeamento: this.relatorio.cabecalho.dataExecucao || '2026-03-13',
      horaFinalBombeamento: '18:10:00',
      dataInicioRecuperacao: this.relatorio.cabecalho.dataExecucao || '2026-03-13',
      horaInicioRecuperacao: '18:10:00',
      dataFinalRecuperacao: this.relatorio.cabecalho.dataExecucao || '2026-03-13',
      horaFinalRecuperacao: '18:45:00',
      tempoRecuperacaoMinutos: '35',
      nivelRecuperacaoFinalM: '33,60',
      vazaoOutorgaRecomendadaM3h: '10,29',
      regimeBombeamentoHorasDia: '16',
      etapas: this.relatorio.dadosPoco?.testeVazaoSEMA?.etapas || [
        {
          id: 'step-1',
          etapa: 1,
          duracaoMinutos: 120,
          vazaoM3h: '6,50',
          nivelDinamicoM: '46,20',
          observacao: '1ª Etapa Escalonada — Regime Laminar Predominante',
        },
        {
          id: 'step-2',
          etapa: 2,
          duracaoMinutos: 120,
          vazaoM3h: '8,40',
          nivelDinamicoM: '54,80',
          observacao: '2ª Etapa Escalonada — Transição Hidrodinâmica',
        },
        {
          id: 'step-3',
          etapa: 3,
          duracaoMinutos: 240,
          vazaoM3h: '10,29',
          nivelDinamicoM: '64,10',
          observacao: '3ª Etapa Nominal Estabilizada — Vazão Recomendada (24h)',
        },
      ],
    };
    const calc = calcularParametrosStepDrawdownSEMA(
      this.relatorio.dadosPoco?.nivelEstatico || '22,40 m',
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
            this.relatorio.dadosPoco?.pocoId,
            'PT01'
          )}  |  N.E.: ${valOuPreencherPDF(
            this.relatorio.dadosPoco?.nivelEstatico,
            '22,40 m'
          )}  |  Bomba: ${valOuPreencherPDF(
            this.relatorio.dadosPoco?.profundidadeBomba,
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
          `Poço: ${valOuPreencherPDF(this.relatorio.dadosPoco?.pocoId, 'PT01')}  |  N.E.: ${valOuPreencherPDF(
            this.relatorio.dadosPoco?.nivelEstatico,
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
          ? ''
          : `Página ${i} de ${totalPages}`;

      const textoRodape = sufixoPaginacao
        ? `${this.razaoEmpresa} | ${sufixoPaginacao}`
        : this.razaoEmpresa;

      this.doc.text(
        textoRodape,
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
    if (this.relatorio.secoesVisiveis?.anexos !== false && this.relatorio.dadosPoco?.testeVazaoSEMA?.ativo !== false) {
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
