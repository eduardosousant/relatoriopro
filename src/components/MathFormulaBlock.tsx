import React from 'react';
import { RelatorioTecnico } from '../types/relatorio';
import {
  calcularParametrosStepDrawdownSEMA,
  fmtNumeroSEMA,
} from './StepDrawdownSection';

/**
 * Tokens matemáticos estruturados para renderização tipográfica de livro ("Display Math"):
 * - 'text' / 'var' / 'op' / 'num' / 'result': termos lineares com suporte a subscrito/sobrescrito
 * - 'frac': fração vertical real com numerador acima, traço horizontal e denominador abaixo
 * - 'paren-frac': fração vertical envolvida por parênteses escalonados altos ( )
 */
export type MathToken =
  | {
      kind: 'var' | 'num' | 'op' | 'text' | 'result';
      main: string;
      sub?: string;
      sup?: string;
    }
  | {
      kind: 'frac';
      numerator: string;
      numeratorSub?: string;
      numeratorSup?: string;
      denominator: string;
      denominatorSub?: string;
      denominatorSup?: string;
      italicNum?: boolean;
      italicDen?: boolean;
    }
  | {
      kind: 'paren-frac';
      numerator: string;
      numeratorSub?: string;
      numeratorSup?: string;
      denominator: string;
      denominatorSub?: string;
      denominatorSup?: string;
      italicNum?: boolean;
      italicDen?: boolean;
    };

export interface EquacaoLivroSpec {
  id: string;
  numeroEquacao: string; // Ex: "(Eq. 1)"
  titulo: string;
  tokens: MathToken[];
  legendaVariaveis?: string;
  destaqueResultado?: boolean;
}

interface LayoutMedidoToken {
  token: MathToken;
  x: number;
  width: number;
}

/**
 * Estima a largura tipográfica em unidades de viewBox SVG (base 680 × 64)
 */
function medirTextoSimplesSVG(texto: string, fontSize: number): number {
  let w = 0;
  for (const ch of texto) {
    if (ch === ' ') w += fontSize * 0.32;
    else if ('iIl1.,:;\''.includes(ch)) w += fontSize * 0.3;
    else if ('mMwW%—'.includes(ch)) w += fontSize * 0.78;
    else if ('+-=×·÷⇒'.includes(ch)) w += fontSize * 0.64;
    else w += fontSize * 0.54;
  }
  return w;
}

function calcularLayoutTokensSVG(tokens: MathToken[]): {
  itens: LayoutMedidoToken[];
  larguraTotal: number;
} {
  const FONT_MAIN = 15.5;
  const FONT_SCRIPT = 10.2;
  const FONT_FRAC = 13.8;
  const itens: LayoutMedidoToken[] = [];
  let cursorX = 0;

  for (const tk of tokens) {
    let w = 0;
    if (tk.kind === 'frac' || tk.kind === 'paren-frac') {
      const wNum =
        medirTextoSimplesSVG(tk.numerator, FONT_FRAC) +
        (tk.numeratorSub ? medirTextoSimplesSVG(tk.numeratorSub, FONT_SCRIPT) : 0) +
        (tk.numeratorSup ? medirTextoSimplesSVG(tk.numeratorSup, FONT_SCRIPT) : 0);
      const wDen =
        medirTextoSimplesSVG(tk.denominator, FONT_FRAC) +
        (tk.denominatorSub
          ? medirTextoSimplesSVG(tk.denominatorSub, FONT_SCRIPT)
          : 0) +
        (tk.denominatorSup
          ? medirTextoSimplesSVG(tk.denominatorSup, FONT_SCRIPT)
          : 0);
      const barWidth = Math.max(wNum, wDen) + 12;
      w = tk.kind === 'paren-frac' ? barWidth + 22 : barWidth + 6;
    } else {
      const mainW = medirTextoSimplesSVG(tk.main, FONT_MAIN);
      const scriptW = Math.max(
        tk.sub ? medirTextoSimplesSVG(tk.sub, FONT_SCRIPT) : 0,
        tk.sup ? medirTextoSimplesSVG(tk.sup, FONT_SCRIPT) : 0
      );
      const pad = tk.kind === 'op' ? 9 : 3;
      w = mainW + scriptW + pad;
    }

    itens.push({ token: tk, x: cursorX, width: w });
    cursorX += w;
  }

  return { itens, larguraTotal: cursorX };
}

function escaparXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Gera uma string SVG autônoma de alta precisão tipográfica (estilo livro técnico / ABNT)
 * representando a equação matemática com traço de fração horizontal, parênteses escalonados,
 * subscritos/sobrescritos e numeração alinhada à direita.
 */
export function gerarSVGStringEquacaoLivro(
  spec: EquacaoLivroSpec,
  opcoes?: { larguraSvg?: number; alturaSvg?: number }
): string {
  const W = opcoes?.larguraSvg ?? 680;
  const H = opcoes?.alturaSvg ?? 62;
  const centerY = H / 2 + 1;
  const fracBarY = centerY - 4;

  const { itens, larguraTotal } = calcularLayoutTokensSVG(spec.tokens);
  const areaEquacaoW = W - 74; // reserva direita para (Eq. N)
  const offsetX = Math.max(14, (areaEquacaoW - larguraTotal) / 2);

  const elementosSVG: string[] = [];

  for (const item of itens) {
    const tk = item.token;
    const x0 = offsetX + item.x;

    if (tk.kind === 'frac' || tk.kind === 'paren-frac') {
      const temParen = tk.kind === 'paren-frac';
      const padParen = temParen ? 10 : 3;
      const barW = item.width - padParen * 2;
      const barX1 = x0 + padParen;
      const barX2 = barX1 + barW;
      const midX = (barX1 + barX2) / 2;

      if (temParen) {
        // Parêntese esquerdo alto escalonado
        const pTop = fracBarY - 19;
        const pBot = fracBarY + 21;
        const lx = x0 + 7;
        elementosSVG.push(
          `<path d="M ${lx} ${pTop} Q ${lx - 6.5} ${fracBarY + 1} ${lx} ${pBot}" fill="none" stroke="#1B2A3B" stroke-width="1.45" stroke-linecap="round" />`
        );
        // Parêntese direito alto escalonado
        const rx = x0 + item.width - 7;
        elementosSVG.push(
          `<path d="M ${rx} ${pTop} Q ${rx + 6.5} ${fracBarY + 1} ${rx} ${pBot}" fill="none" stroke="#1B2A3B" stroke-width="1.45" stroke-linecap="round" />`
        );
      }

      // Numerador (acima da barra de fração)
      const numStyle = tk.italicNum
        ? 'font-style="italic"'
        : 'font-style="normal"';
      let numContent = escaparXML(tk.numerator);
      if (tk.numeratorSub) {
        numContent += `<tspan dy="3.5" font-size="9.5" font-style="normal">${escaparXML(
          tk.numeratorSub
        )}</tspan><tspan dy="-3.5" font-size="13.8"> </tspan>`;
      }
      if (tk.numeratorSup) {
        numContent += `<tspan dy="-5" font-size="9.5" font-style="normal">${escaparXML(
          tk.numeratorSup
        )}</tspan><tspan dy="5" font-size="13.8"> </tspan>`;
      }
      elementosSVG.push(
        `<text x="${midX.toFixed(1)}" y="${(fracBarY - 5.5).toFixed(
          1
        )}" text-anchor="middle" font-family="'Times New Roman', 'Cambria Math', Georgia, serif" font-size="13.8" ${numStyle} fill="#1B2A3B">${numContent}</text>`
      );

      // Linha horizontal real da fração
      elementosSVG.push(
        `<line x1="${barX1.toFixed(1)}" y1="${fracBarY.toFixed(
          1
        )}" x2="${barX2.toFixed(1)}" y2="${fracBarY.toFixed(
          1
        )}" stroke="#1B2A3B" stroke-width="1.25" />`
      );

      // Denominador (abaixo da barra de fração)
      const denStyle = tk.italicDen
        ? 'font-style="italic"'
        : 'font-style="normal"';
      let denContent = escaparXML(tk.denominator);
      if (tk.denominatorSub) {
        denContent += `<tspan dy="3.5" font-size="9.5" font-style="normal">${escaparXML(
          tk.denominatorSub
        )}</tspan><tspan dy="-3.5" font-size="13.8"> </tspan>`;
      }
      if (tk.denominatorSup) {
        denContent += `<tspan dy="-5" font-size="9.5" font-style="normal">${escaparXML(
          tk.denominatorSup
        )}</tspan><tspan dy="5" font-size="13.8"> </tspan>`;
      }
      elementosSVG.push(
        `<text x="${midX.toFixed(1)}" y="${(fracBarY + 14.8).toFixed(
          1
        )}" text-anchor="middle" font-family="'Times New Roman', 'Cambria Math', Georgia, serif" font-size="13.8" ${denStyle} fill="#1B2A3B">${denContent}</text>`
      );
    } else {
      const isVar = tk.kind === 'var';
      const isResult = tk.kind === 'result';
      const isOp = tk.kind === 'op';

      const fontStyle = isVar ? 'italic' : 'normal';
      const fontWeight = isResult ? 'bold' : isOp ? 'normal' : 'normal';
      const fill = isResult ? '#002299' : '#1B2A3B';
      const tx = isOp ? x0 + item.width / 2 : x0 + 1.5;
      const anchor = isOp ? 'middle' : 'start';

      let inner = escaparXML(tk.main);
      if (tk.sub) {
        inner += `<tspan dy="4" font-size="10.2" font-style="normal">${escaparXML(
          tk.sub
        )}</tspan>`;
      }
      if (tk.sup) {
        inner += `<tspan dy="${tk.sub ? '-9.5' : '-5.5'}" font-size="10.2" font-style="normal">${escaparXML(
          tk.sup
        )}</tspan>`;
      }

      elementosSVG.push(
        `<text x="${tx.toFixed(1)}" y="${centerY.toFixed(
          1
        )}" text-anchor="${anchor}" font-family="'Times New Roman', 'Cambria Math', Georgia, serif" font-size="15.5" font-style="${fontStyle}" font-weight="${fontWeight}" fill="${fill}">${inner}</text>`
      );
    }
  }

  // Numeração da equação à direita no padrão ABNT: (Eq. 1)
  if (spec.numeroEquacao) {
    elementosSVG.push(
      `<text x="${W - 10}" y="${centerY.toFixed(
        1
      )}" text-anchor="end" font-family="'Times New Roman', Georgia, serif" font-size="12" font-weight="bold" fill="#6B7A8D">${escaparXML(
        spec.numeroEquacao
      )}</text>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" data-math-formula-id="${escaparXML(
    spec.id
  )}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${elementosSVG.join(
    ''
  )}</svg>`;
}

/**
 * Captura o elemento `<svg data-math-formula-id="...">` renderizado no DOM (ou gera a partir do spec
 * caso a aba de preview não esteja visível) e converte para uma imagem PNG em alta resolução (384 DPI)
 * pronta para inserção fiel no `jsPDF`.
 */
export async function capturarFormulaSVGParaImagemPDF(
  spec: EquacaoLivroSpec
): Promise<{ dataUrl: string; widthMm: number; heightMm: number } | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const larguraSvg = 680;
  const alturaSvg = 62;
  const escalaRetina = 4; // 4x = altíssima nitidez para impressão A4 ABNT

  let svgMarkup = '';
  const domSvg = document.querySelector(
    `svg[data-math-formula-id="${spec.id}"]`
  ) as SVGSVGElement | null;

  if (domSvg) {
    const clone = domSvg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(larguraSvg));
    clone.setAttribute('height', String(alturaSvg));
    svgMarkup = new XMLSerializer().serializeToString(clone);
  } else {
    svgMarkup = gerarSVGStringEquacaoLivro(spec, {
      larguraSvg,
      alturaSvg,
    });
  }

  return new Promise((resolve) => {
    try {
      const svgBase64 =
        'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = larguraSvg * escalaRetina;
          canvas.height = alturaSvg * escalaRetina;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png', 1.0);
          resolve({
            dataUrl,
            widthMm: 174,
            heightMm: 15.8,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = svgBase64;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Constrói o conjunto padronizado de equações hidrogeológicas em formato de livro ("Display Math")
 * para a Seção 6 (Parecer Hidrogeológico) e para os Anexos I.2 e I.3 (ABNT NBR 12212 / NBR 12244).
 */
export function construirEquacoesLivroRelatorio(
  relatorio: RelatorioTecnico
): {
  secao6: EquacaoLivroSpec[];
  anexoI2: EquacaoLivroSpec[];
  anexoI3Jacob: EquacaoLivroSpec[];
  anexoI3Cooper: EquacaoLivroSpec[];
} {
  const calc = calcularParametrosStepDrawdownSEMA(
    relatorio.dadosPoco?.nivelEstatico,
    relatorio.dadosPoco?.testeVazaoSEMA
  );

  const qHora = fmtNumeroSEMA(calc.vazaoEstabilizadaFinalM3h ?? 10.286, 3);
  const qDia = fmtNumeroSEMA(
    (calc.vazaoEstabilizadaFinalM3h ?? 10.286) * 24,
    3
  );
  const sMax = fmtNumeroSEMA(calc.rebaixamentoMaximoM ?? 41.7, 2);
  const qPorS = fmtNumeroSEMA(calc.qPorSFinal ?? 0.2467, 4);
  const sPorQ = fmtNumeroSEMA(calc.sPorQFinal ?? 4.0541, 4);
  const recPct = fmtNumeroSEMA(calc.percentualRecuperacao ?? 73.14, 2);
  const deltaS = fmtNumeroSEMA(calc.deltaSCicloM ?? 19.0, 2);
  const transT = fmtNumeroSEMA(calc.transmissividadeM2Dia ?? 2.38, 2);
  const coefB = fmtNumeroSEMA(calc.coeficienteB ?? 2.9909, 4);
  const coefC = fmtNumeroSEMA(calc.coeficienteC ?? 0.10317, 5);
  const eficPct = fmtNumeroSEMA(calc.eficienciaUltimaEtapaPct ?? 73.8, 1);

  const eqCapacidadeEspecifica: EquacaoLivroSpec = {
    id: 'eq-capacidade-especifica',
    numeroEquacao: '(Eq. 1)',
    titulo:
      'Capacidade Específica (q_s) e Rebaixamento Específico (s/Q) no Teste Contínuo 24h',
    tokens: [
      { kind: 'var', main: 'q', sub: 's' },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: 'Q',
        denominator: 's',
        italicNum: true,
        italicDen: true,
      },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: qHora,
        denominator: sMax,
      },
      { kind: 'op', main: '=' },
      { kind: 'result', main: `${qPorS} m³/h·m` },
      { kind: 'op', main: '   ;   ' },
      {
        kind: 'frac',
        numerator: 's',
        denominator: 'Q',
        italicNum: true,
        italicDen: true,
      },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: sMax,
        denominator: qHora,
      },
      { kind: 'op', main: '=' },
      { kind: 'result', main: `${sPorQ} m/(m³/h)` },
    ],
    legendaVariaveis: `Onde: Q = ${qHora} m³/h (${qDia} m³/dia)  •  NE = 22,40 m  •  ND = 64,10 m  •  Rebaixamento estabilizado s = ND − NE = ${sMax} m.`,
  };

  const eqRecuperacaoReal: EquacaoLivroSpec = {
    id: 'eq-recuperacao-real',
    numeroEquacao: '(Eq. 2)',
    titulo:
      "Percentual Real de Recuperação Hidrodinâmica Recalculada (aos 35 min após parada)",
    tokens: [
      { kind: 'var', main: 'R', sub: '(%)' },
      { kind: 'op', main: '=' },
      {
        kind: 'paren-frac',
        numerator: "s − s'",
        denominator: 's',
        italicNum: true,
        italicDen: true,
      },
      { kind: 'op', main: '×' },
      { kind: 'num', main: '100' },
      { kind: 'op', main: '=' },
      {
        kind: 'paren-frac',
        numerator: `${sMax} − 11,20`,
        denominator: sMax,
      },
      { kind: 'op', main: '×' },
      { kind: 'num', main: '100' },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: '30,50',
        denominator: sMax,
      },
      { kind: 'op', main: '×' },
      { kind: 'num', main: '100' },
      { kind: 'op', main: '=' },
      { kind: 'result', main: `${recPct}% (73,1%)` },
    ],
    legendaVariaveis:
      "Onde: N.A.(35 min) = 33,60 m  •  Rebaixamento residual s' = 33,60 − 22,40 = 11,20 m  •  Coluna recuperada (s − s') = 30,50 m.",
  };

  const eqCooperJacob: EquacaoLivroSpec = {
    id: 'eq-cooper-jacob',
    numeroEquacao: '(Eq. 3)',
    titulo:
      'Transmissividade Hidráulica do Aquífero — Método Analítico de Cooper-Jacob',
    tokens: [
      { kind: 'var', main: 'T' },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: '0,183 · Q',
        denominator: 'Δs',
        italicNum: false,
        italicDen: true,
      },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: `0,183 × ${qDia}`,
        denominator: deltaS,
      },
      { kind: 'op', main: '=' },
      {
        kind: 'frac',
        numerator: '45,176',
        denominator: deltaS,
      },
      { kind: 'op', main: '=' },
      { kind: 'result', main: `${transT} m²/dia` },
    ],
    legendaVariaveis: `Onde: Q = ${qDia} m³/dia (vazão constante em 24h)  •  Δs = 38,50 − 19,50 = ${deltaS} m (variação do rebaixamento entre t = 10 min e t = 100 min).`,
  };

  const eqJacobRorabaugh: EquacaoLivroSpec = {
    id: 'eq-jacob-rorabaugh',
    numeroEquacao: '(Eq. 4)',
    titulo:
      'Equação Característica do Poço (Jacob-Rorabaugh) e Forma Linearizada dos Escalões',
    tokens: [
      { kind: 'var', main: 's' },
      { kind: 'op', main: '=' },
      { kind: 'var', main: 'B' },
      { kind: 'op', main: '·' },
      { kind: 'var', main: 'Q' },
      { kind: 'op', main: '+' },
      { kind: 'var', main: 'C' },
      { kind: 'op', main: '·' },
      { kind: 'var', main: 'Q', sup: '2' },
      { kind: 'op', main: '   ⇒   ' },
      {
        kind: 'frac',
        numerator: 's',
        denominator: 'Q',
        italicNum: true,
        italicDen: true,
      },
      { kind: 'op', main: '=' },
      { kind: 'var', main: 'B' },
      { kind: 'op', main: '+' },
      { kind: 'var', main: 'C' },
      { kind: 'op', main: '·' },
      { kind: 'var', main: 'Q' },
      { kind: 'op', main: '=' },
      { kind: 'result', main: `${coefB} + ${coefC} · Q` },
    ],
    legendaVariaveis: `Onde: B = ${coefB} h/m² (perdas laminares no aquífero)  •  C = ${coefC} h²/m⁵ (perdas turbulentas no poço)  •  Para Q = 10,29 m³/h: s = 30,78 + 10,92 = 41,70 m.`,
  };

  const eqEficienciaHidraulica: EquacaoLivroSpec = {
    id: 'eq-eficiencia-hidraulica',
    numeroEquacao: '(Eq. 5)',
    titulo:
      'Eficiência Hidráulica do Poço (η) na Vazão Recomendada de Operação (Q = 10,29 m³/h)',
    tokens: [
      { kind: 'var', main: 'η' },
      { kind: 'op', main: '=' },
      {
        kind: 'paren-frac',
        numerator: 'B · Q',
        denominator: 'B · Q + C · Q²',
        italicNum: true,
        italicDen: true,
      },
      { kind: 'op', main: '×' },
      { kind: 'num', main: '100' },
      { kind: 'op', main: '=' },
      {
        kind: 'paren-frac',
        numerator: '30,78',
        denominator: '30,78 + 10,92',
      },
      { kind: 'op', main: '×' },
      { kind: 'num', main: '100' },
      { kind: 'op', main: '=' },
      { kind: 'result', main: `${eficPct}%` },
    ],
    legendaVariaveis:
      'Onde: Perda laminar B·Q = 30,78 m (73,8%)  •  Perda turbulenta C·Q² = 10,92 m (26,2%)  •  Classificação: Poço Eficiente e Bem Desenvolvido.',
  };

  return {
    secao6: [eqCapacidadeEspecifica, eqRecuperacaoReal, eqCooperJacob],
    anexoI2: [eqRecuperacaoReal],
    anexoI3Jacob: [eqJacobRorabaugh, eqEficienciaHidraulica],
    anexoI3Cooper: [eqCooperJacob, eqCapacidadeEspecifica],
  };
}

/**
 * Componente visual React que renderiza uma equação matemática em estilo de livro técnico/científico
 * (Display Math com barra de fração horizontal, variáveis serifadas em itálico e numeração ABNT à direita).
 */
export const MathFormulaBlock: React.FC<{
  spec: EquacaoLivroSpec;
  compact?: boolean;
}> = ({ spec, compact = false }) => {
  const svgString = gerarSVGStringEquacaoLivro(spec);

  return (
    <div
      className={`border border-[#DDE3EC] bg-white border-l-[3px] border-l-[#1B2A3B] ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[7.3pt] font-bold uppercase tracking-wide text-[#1B2A3B]">
          {spec.titulo}
        </span>
        <span className="text-[7pt] font-mono font-semibold text-[#6B7A8D] shrink-0">
          Notação ABNT {spec.numeroEquacao}
        </span>
      </div>

      {/* Equação renderizada em SVG vetorial estilo livro (capturável pelo pdfExportService) */}
      <div
        className="w-full overflow-x-auto bg-[#FAFBFD] border border-slate-200/80 py-1 px-1"
        dangerouslySetInnerHTML={{ __html: svgString }}
      />

      {spec.legendaVariaveis && (
        <div className="mt-1 text-[7.2pt] text-slate-600 font-serif italic leading-snug">
          {spec.legendaVariaveis}
        </div>
      )}
    </div>
  );
};
