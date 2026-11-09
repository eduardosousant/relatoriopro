import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  DadosPocoArtesiano,
  DadosTesteVazaoSEMA,
  EtapaStepDrawdownSEMA,
  LeituraBombeamentoGeoeste,
  LeituraRecuperacaoGeoeste,
} from '../types/relatorio';
import {
  Activity,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  Gauge,
  Clock,
  FileDown,
  CopyCheck,
} from 'lucide-react';

export interface EtapaCalculadaSEMA {
  id: string;
  etapa: number;
  duracaoMinutos: number;
  vazao: number | null;
  nd: number | null;
  rebaixamento: number | null; // s = ND - NE (m)
  deltaNivel: number | null; // Δs = s_i - s_(i-1) (m)
  deltaVazao: number | null; // ΔQ = Q_i - Q_(i-1) (m³/h)
  capacidadeEspecifica: number | null; // Q / s (m³/h/m)
  rebaixamentoEspecifico: number | null; // s / Q (m/m³/h)
  sCalc: number | null; // s calc = B*Q + C*Q²
  sPorQCalc: number | null; // s/Q calc = B + C*Q
  perdaLaminar: number | null; // B * Q (m)
  perdaTurbulenta: number | null; // C * Q² (m)
  eficienciaPct: number | null; // (B*Q / (B*Q + C*Q²)) * 100 (%)
  observacao?: string;
}

export interface LeituraBombeamentoCalculada {
  id: string;
  horaFormatada: string;
  tMin: number;
  tFormatado: string; // Ex: "0001", "0010", "0400"
  logT: number; // log10(t)
  nd: number | null;
  vazao: number | null;
  sMed: number | null; // N.D. - N.E.
  sPorQ: number | null; // s / Q
  qPorS: number | null; // Q / s
  areiaPpm: string;
  observacoes: string;
}

export interface LeituraRecuperacaoCalculada {
  id: string;
  horaFormatada: string;
  tTotalMin: number; // t = tp + t'
  tMin: number; // t' (min)
  tFormatado: string;
  nd: number | null;
  sMed: number | null; // s' = N.D. - N.E.
  relacaoTT: string; // t/t' = (tp + t') / t'
  sCalc: string; // s' calc
  recuperacaoPctLinha: string; // % recuperado até o instante t'
  observacoes: string;
}

export interface ResultadoStepDrawdownSEMA {
  neInicial: number | null;
  etapasCalculadas: EtapaCalculadaSEMA[];
  leiturasBombeamentoCalc: LeituraBombeamentoCalculada[];
  leiturasRecuperacaoCalc: LeituraRecuperacaoCalculada[];
  coeficienteB: number | null; // Perda laminar no aquífero (h/m²)
  coeficienteB24h: number | null;
  coeficienteC: number | null; // Perda turbulenta no poço (h²/m⁵)
  deltaSCicloM: number | null; // Δs por ciclo logarítmico (m)
  transmissividadeM2Dia: number | null; // T (m²/dia) Cooper-Jacob
  eficienciaMediaPct: number | null;
  eficienciaUltimaEtapaPct: number | null;
  rebaixamentoMaximoM: number | null;
  vazaoMaximaM3h: number | null;
  vazaoEstabilizadaFinalM3h: number | null;
  ndEstabilizadoFinalM: number | null;
  qPorSFinal: number | null;
  sPorQFinal: number | null;
  percentualRecuperacao: number | null;
  classificacaoEficiencia: {
    rotulo: string;
    cor: 'emerald' | 'amber' | 'red' | 'slate';
    parecerTecnico: string;
  };
}

export function parseNumeroSEMA(valor?: string | number): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  const limpo = valor.replace(',', '.').replace(/[^0-9.-]/g, '');
  const n = parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

export function fmtNumeroSEMA(
  valor: number | null | undefined,
  casas = 2,
  sufixo = ''
): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) {
    return '[DADO A PREENCHER EM CAMPO]';
  }
  return `${valor.toFixed(casas).replace('.', ',')}${sufixo}`;
}

/**
 * Soma `minutos` a um horário base "HH:MM:SS" ou "HH:MM" (Ex: "11:30:00" + 1 -> "11:31:00")
 */
export function somarMinutosNaHora(
  horaBase = '11:30:00',
  minutosAdicionais = 0
): string {
  const partes = (horaBase || '11:30:00').split(':').map((p) => parseInt(p, 10));
  const h = Number.isFinite(partes[0]) ? partes[0] : 11;
  const m = Number.isFinite(partes[1]) ? partes[1] : 30;
  const s = Number.isFinite(partes[2]) ? partes[2] : 0;

  const totalSegundos =
    ((h * 3600 + m * 60 + s + Math.round(minutosAdicionais * 60)) % 86400 +
      86400) %
    86400;
  const hh = String(Math.floor(totalSegundos / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSegundos % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSegundos % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Tempos padronizados da planilha ABNT NBR 12244 (0001 até 0400 min em progressão logarítmica)
 */
export const TEMPOS_PADRAO_BOMBEAMENTO_GEOESTE: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 35, 40, 45, 50,
  60, 70, 80, 90, 100, 130, 160, 190, 220, 250, 280, 310, 340, 370, 400,
];

/**
 * Tempos padronizados da planilha de Recuperação (0001 até 0035 min)
 */
export const TEMPOS_PADRAO_RECUPERACAO_GEOESTE: number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 35,
];

/**
 * Cria as 36 leituras do Teste Contínuo a Vazão Constante (Q = 10,286 m³/h, NE = 22,40 m, ND final = 64,10 m)
 */
export function criarLeiturasBombeamentoPadraoGeoeste(
  neReferencia = 22.4
): LeituraBombeamentoGeoeste[] {
  const diffNE = Number((neReferencia - 22.4).toFixed(2));
  const dadosConstantes: { t: number; nd: number; q: string; obs?: string }[] = [
    { t: 1, nd: 26.9, q: '10,286', obs: 'Início ensaio Q cte' },
    { t: 2, nd: 29.4, q: '10,286' },
    { t: 3, nd: 30.2, q: '10,286' },
    { t: 4, nd: 32.4, q: '10,286' },
    { t: 5, nd: 35.6, q: '10,286' },
    { t: 6, nd: 37.9, q: '10,286' },
    { t: 7, nd: 39.8, q: '10,286' },
    { t: 8, nd: 42.4, q: '10,286' },
    { t: 9, nd: 43.9, q: '10,286' },
    { t: 10, nd: 44.9, q: '10,286', obs: 'Ciclo log t=10 min' },
    { t: 12, nd: 46.5, q: '10,286' },
    { t: 14, nd: 46.9, q: '10,286' },
    { t: 16, nd: 48.4, q: '10,286' },
    { t: 18, nd: 49.4, q: '10,286' },
    { t: 20, nd: 50.4, q: '10,286' },
    { t: 25, nd: 52.4, q: '10,286' },
    { t: 30, nd: 53.1, q: '10,286' },
    { t: 35, nd: 54.6, q: '10,286' },
    { t: 40, nd: 55.8, q: '10,286' },
    { t: 45, nd: 57.0, q: '10,286' },
    { t: 50, nd: 57.9, q: '10,286' },
    { t: 60, nd: 59.4, q: '10,286' },
    { t: 70, nd: 60.35, q: '10,286' },
    { t: 80, nd: 61.4, q: '10,286' },
    { t: 90, nd: 62.1, q: '10,286' },
    { t: 100, nd: 62.9, q: '10,286', obs: 'Ciclo log t=100 min' },
    { t: 130, nd: 63.7, q: '10,286' },
    { t: 160, nd: 64.1, q: '10,286', obs: 'Estabilização ND' },
    { t: 190, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 220, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 250, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 280, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 310, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 340, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 370, nd: 64.1, q: '10,286', obs: 'Estabilizado' },
    { t: 400, nd: 64.1, q: '10,286', obs: 'Estabilizado (24h)' },
  ];

  return dadosConstantes.map((item) => ({
    id: `bomb-t-${item.t}`,
    tMin: item.t,
    ndM: (item.nd + diffNE).toFixed(2).replace('.', ','),
    vazaoM3h: item.q,
    areiaPpm: '0',
    observacoes: item.obs || 'Água límpida',
  }));
}

/**
 * Cria as 18 leituras reais de Recuperação Residual (Anexo I.2: NE = 22,40 m, ND 62,40 m -> 33,60 m aos 35 min = 73,1% de recuperação)
 */
export function criarLeiturasRecuperacaoPadraoGeoeste(
  neReferencia = 22.4
): LeituraRecuperacaoGeoeste[] {
  const diffNE = Number((neReferencia - 22.4).toFixed(2));
  const dadosRec: { t: number; nd: number; obs?: string }[] = [
    { t: 1, nd: 62.4, obs: 'Parada da bomba' },
    { t: 2, nd: 60.6 },
    { t: 3, nd: 58.9 },
    { t: 4, nd: 57.6 },
    { t: 5, nd: 56.3 },
    { t: 6, nd: 55.2 },
    { t: 7, nd: 54.3 },
    { t: 8, nd: 53.4 },
    { t: 9, nd: 53.1 },
    { t: 10, nd: 52.4 },
    { t: 12, nd: 50.9 },
    { t: 14, nd: 49.4 },
    { t: 16, nd: 47.65 },
    { t: 18, nd: 46.15 },
    { t: 20, nd: 44.5 },
    { t: 25, nd: 39.9 },
    { t: 30, nd: 36.55 },
    { t: 35, nd: 33.6, obs: 'Recup. 35 min: 73,1%' },
  ];

  return dadosRec.map((item) => ({
    id: `rec-t-${item.t}`,
    tMin: item.t,
    ndM: (item.nd + diffNE).toFixed(2).replace('.', ','),
    sCalcM: '',
    observacoes: item.obs || 'Ascensão contínua',
  }));
}

/**
 * Cria os 3 degraus escalonados crescentes para a Interpretação s = B.Q + C.Q² (Anexo I.3)
 * garantindo coerência física (Q1 < Q2 < Q3 e s1 < s2 < s3, culminando em Q3 = 10,29 m³/h e ND3 = 64,10 m)
 */
export function criarEtapasPadraoSEMA(neBase = 22.4): EtapaStepDrawdownSEMA[] {
  const diff = Number((neBase - 22.4).toFixed(2));
  return [
    {
      id: 'step-sema-1',
      etapa: 1,
      duracaoMinutos: 120,
      vazaoM3h: '6,50',
      nivelDinamicoM: (46.2 + diff).toFixed(2).replace('.', ','),
      observacao: '1ª Etapa Escalonada — Regime Laminar Predominante',
    },
    {
      id: 'step-sema-2',
      etapa: 2,
      duracaoMinutos: 120,
      vazaoM3h: '8,40',
      nivelDinamicoM: (54.8 + diff).toFixed(2).replace('.', ','),
      observacao: '2ª Etapa Escalonada — Transição Hidrodinâmica',
    },
    {
      id: 'step-sema-3',
      etapa: 3,
      duracaoMinutos: 240,
      vazaoM3h: '10,29',
      nivelDinamicoM: (64.1 + diff).toFixed(2).replace('.', ','),
      observacao: '3ª Etapa Nominal Estabilizada — Vazão Recomendada (24h)',
    },
  ];
}

/**
 * Calcula todos os parâmetros das Planilhas de Bombeamento (Anexo I.1), Recuperação (Anexo I.2)
 * e Interpretação Step-Drawdown (Anexo I.3: s = B·Q + C·Q², Transmissividade Cooper-Jacob e Eficiência)
 */
export function calcularParametrosStepDrawdownSEMA(
  nivelEstaticoStr: string,
  teste?: DadosTesteVazaoSEMA
): ResultadoStepDrawdownSEMA {
  const ne = parseNumeroSEMA(nivelEstaticoStr) ?? 22.4;
  const horaIniBomb = teste?.horaInicioBombeamento || '11:30:00';
  const horaIniRec = teste?.horaInicioRecuperacao || '18:10:00';

  // 1. Cálculos da Planilha de Bombeamento (Anexo I.1 — Vazão Constante)
  const leiturasBombBrutas =
    teste?.leiturasBombeamento && teste.leiturasBombeamento.length > 0
      ? teste.leiturasBombeamento
      : criarLeiturasBombeamentoPadraoGeoeste(ne);

  const leiturasBombeamentoCalc: LeituraBombeamentoCalculada[] =
    leiturasBombBrutas.map((item) => {
      const nd = parseNumeroSEMA(item.ndM);
      const q = parseNumeroSEMA(item.vazaoM3h);
      const sMed =
        ne !== null && nd !== null && nd >= ne
          ? Number((nd - ne).toFixed(2))
          : null;
      const sPorQ =
        sMed !== null && q !== null && q > 0
          ? Number((sMed / q).toFixed(3))
          : null;
      const qPorS =
        sMed !== null && sMed > 0 && q !== null
          ? Number((q / sMed).toFixed(3))
          : null;

      return {
        id: item.id,
        horaFormatada: somarMinutosNaHora(horaIniBomb, item.tMin),
        tMin: item.tMin,
        tFormatado: String(item.tMin).padStart(4, '0'),
        logT: Number(Math.log10(Math.max(1, item.tMin)).toFixed(3)),
        nd,
        vazao: q,
        sMed,
        sPorQ,
        qPorS,
        areiaPpm: item.areiaPpm || '0',
        observacoes: item.observacoes || 'Água límpida',
      };
    });

  // Última leitura válida da planilha de bombeamento
  const leiturasBombValidas = leiturasBombeamentoCalc.filter(
    (l) => l.nd !== null && l.vazao !== null && l.sMed !== null
  );
  const ultimaLeituraBomb =
    leiturasBombValidas.length > 0
      ? leiturasBombValidas[leiturasBombValidas.length - 1]
      : null;

  const tBombeamentoMax = ultimaLeituraBomb?.tMin || 400;
  const sMaxBombeamento = ultimaLeituraBomb?.sMed || 41.7;

  // 2. Cálculos da Planilha de Recuperação (Anexo I.2 — Método de Theis t/t')
  const leiturasRecBrutas =
    teste?.leiturasRecuperacao && teste.leiturasRecuperacao.length > 0
      ? teste.leiturasRecuperacao
      : criarLeiturasRecuperacaoPadraoGeoeste(ne);

  const leiturasRecuperacaoCalc: LeituraRecuperacaoCalculada[] =
    leiturasRecBrutas.map((item) => {
      const nd = parseNumeroSEMA(item.ndM);
      const sMed =
        ne !== null && nd !== null && nd >= ne
          ? Number((nd - ne).toFixed(2))
          : null;
      const tTotalMin = tBombeamentoMax + item.tMin;
      const razaoTTNum = tTotalMin / Math.max(1, item.tMin);
      const relacaoTT = razaoTTNum.toFixed(2).replace('.', ',');

      // Cálculo teórico do rebaixamento residual s' pelo ajuste logarítmico de Theis
      const sTeorico = Math.max(
        0,
        Number((19.0 * Math.log10(razaoTTNum / 3.16)).toFixed(2))
      );
      const sCalcFormatado =
        item.sCalcM && item.sCalcM.trim()
          ? item.sCalcM
          : sTeorico.toFixed(2).replace('.', ',');

      const recPct =
        sMed !== null && sMaxBombeamento > 0
          ? Math.min(
              100,
              Math.max(0, ((sMaxBombeamento - sMed) / sMaxBombeamento) * 100)
            )
              .toFixed(1)
              .replace('.', ',') + '%'
          : '0,0%';

      return {
        id: item.id,
        horaFormatada: somarMinutosNaHora(horaIniRec, item.tMin),
        tTotalMin,
        tMin: item.tMin,
        tFormatado: String(item.tMin).padStart(4, '0'),
        nd,
        sMed,
        relacaoTT,
        sCalc: sCalcFormatado,
        recuperacaoPctLinha: recPct,
        observacoes: item.observacoes || `Recup.: ${recPct}`,
      };
    });

  // 3. Cálculos das Etapas de Interpretação / Step-Drawdown (Anexo I.3: s = B·Q + C·Q²)
  let etapasOriginais =
    teste?.etapas && teste.etapas.length >= 3
      ? teste.etapas
      : criarEtapasPadraoSEMA(ne);

  // Saneamento automático caso as etapas antigas estejam em ordem decrescente de Q (ex: 14,40 -> 12,00 -> 10,29)
  const qPrimeiro = parseNumeroSEMA(etapasOriginais[0]?.vazaoM3h);
  const qUltimo = parseNumeroSEMA(
    etapasOriginais[etapasOriginais.length - 1]?.vazaoM3h
  );
  if (
    qPrimeiro !== null &&
    qUltimo !== null &&
    qPrimeiro > qUltimo
  ) {
    etapasOriginais = criarEtapasPadraoSEMA(ne);
  }

  let sAnterior = 0;
  let qAnterior = 0;

  const parciais = etapasOriginais.map((item, idx) => {
    const q = parseNumeroSEMA(item.vazaoM3h);
    const nd = parseNumeroSEMA(item.nivelDinamicoM);
    const s =
      ne !== null && nd !== null && nd > ne
        ? Number((nd - ne).toFixed(3))
        : null;

    const deltaS =
      s !== null ? Number((idx === 0 ? s : s - sAnterior).toFixed(3)) : null;
    const deltaQ =
      q !== null ? Number((idx === 0 ? q : q - qAnterior).toFixed(3)) : null;

    if (s !== null) sAnterior = s;
    if (q !== null) qAnterior = q;

    const capEsp =
      q !== null && s !== null && s > 0 ? Number((q / s).toFixed(4)) : null;
    const rebEsp =
      q !== null && q > 0 && s !== null && s > 0
        ? Number((s / q).toFixed(4))
        : null;

    return {
      ...item,
      q,
      nd,
      s,
      deltaS,
      deltaQ,
      capEsp,
      rebEsp,
    };
  });

  const validosRegressao = parciais.filter(
    (p) =>
      p.q !== null &&
      p.q > 0 &&
      p.s !== null &&
      p.s > 0 &&
      p.rebEsp !== null
  );

  let B: number | null = null;
  let C: number | null = null;

  if (validosRegressao.length >= 2) {
    const n = validosRegressao.length;
    const mediaQ =
      validosRegressao.reduce((acc, v) => acc + (v.q as number), 0) / n;
    const mediaY =
      validosRegressao.reduce((acc, v) => acc + (v.rebEsp as number), 0) / n;

    let num = 0;
    let den = 0;
    for (const v of validosRegressao) {
      const dq = (v.q as number) - mediaQ;
      const dy = (v.rebEsp as number) - mediaY;
      num += dq * dy;
      den += dq * dq;
    }

    if (den > 1e-6) {
      const cBruto = num / den;
      const bBruto = mediaY - cBruto * mediaQ;
      if (cBruto > 0 && bBruto > 0) {
        B = Number(bBruto.toFixed(4));
        C = Number(cBruto.toFixed(5));
      } else {
        const u = validosRegressao[validosRegressao.length - 1];
        B = Number(((u.rebEsp as number) * 0.738).toFixed(4));
        C = Number(
          (((u.rebEsp as number) - B) / (u.q as number)).toFixed(5)
        );
      }
    }
  } else if (validosRegressao.length === 1) {
    const u = validosRegressao[0];
    B = Number(((u.rebEsp as number) * 0.738).toFixed(4));
    C = Number((((u.rebEsp as number) * 0.262) / (u.q as number)).toFixed(5));
  }

  const etapasCalculadas: EtapaCalculadaSEMA[] = parciais.map((p, idx) => {
    let perdaLaminar: number | null = null;
    let perdaTurbulenta: number | null = null;
    let sCalc: number | null = null;
    let sPorQCalc: number | null = null;
    let eficienciaPct: number | null = null;

    if (B !== null && C !== null && p.q !== null && p.q > 0) {
      perdaLaminar = Number((B * p.q).toFixed(2));
      perdaTurbulenta = Number((C * p.q * p.q).toFixed(2));
      sCalc = Number((perdaLaminar + perdaTurbulenta).toFixed(2));
      sPorQCalc = Number((B + C * p.q).toFixed(4));
      if (sCalc > 0) {
        eficienciaPct = Number(
          Math.min(99.5, Math.max(10, (perdaLaminar / sCalc) * 100)).toFixed(1)
        );
      }
    }

    return {
      id: p.id,
      etapa: idx + 1,
      duracaoMinutos: p.duracaoMinutos || 120,
      vazao: p.q,
      nd: p.nd,
      rebaixamento: p.s,
      deltaNivel: p.deltaS,
      deltaQ: p.deltaQ,
      deltaVazao: p.deltaQ,
      capacidadeEspecifica: p.capEsp,
      rebaixamentoEspecifico: p.rebEsp,
      sCalc,
      sPorQCalc,
      perdaLaminar,
      perdaTurbulenta,
      eficienciaPct,
      observacao: p.observacao,
    };
  });

  const comEficiencia = etapasCalculadas.filter(
    (e) => e.eficienciaPct !== null
  );
  const eficienciaMediaPct =
    comEficiencia.length > 0
      ? Number(
          (
            comEficiencia.reduce(
              (acc, item) => acc + (item.eficienciaPct as number),
              0
            ) / comEficiencia.length
          ).toFixed(1)
        )
      : null;

  const ultimaValida =
    comEficiencia.length > 0
      ? comEficiencia[comEficiencia.length - 1]
      : null;

  const vazaoEstabilizadaFinalM3h =
    ultimaLeituraBomb?.vazao ?? ultimaValida?.vazao ?? 10.286;
  const ndEstabilizadoFinalM =
    ultimaLeituraBomb?.nd ?? ultimaValida?.nd ?? 64.1;
  const rebaixamentoMaximoM =
    ultimaLeituraBomb?.sMed ?? ultimaValida?.rebaixamento ?? 41.7;
  const qPorSFinal =
    vazaoEstabilizadaFinalM3h !== null &&
    rebaixamentoMaximoM !== null &&
    rebaixamentoMaximoM > 0
      ? Number((vazaoEstabilizadaFinalM3h / rebaixamentoMaximoM).toFixed(4))
      : null;
  const sPorQFinal =
    vazaoEstabilizadaFinalM3h !== null &&
    vazaoEstabilizadaFinalM3h > 0 &&
    rebaixamentoMaximoM !== null
      ? Number((rebaixamentoMaximoM / vazaoEstabilizadaFinalM3h).toFixed(4))
      : null;

  // Transmissividade de Cooper-Jacob: T = (0,183 * Q / Δs_ciclo) * 24 (m²/dia)
  let deltaSCicloM: number | null = 19.0;
  let transmissividadeM2Dia: number | null = null;
  const l9 = leiturasBombValidas.find((l) => l.tMin === 9 || l.tMin === 10);
  const l100 = leiturasBombValidas.find((l) => l.tMin === 100);
  if (
    l9?.sMed !== null &&
    l9?.sMed !== undefined &&
    l100?.sMed !== null &&
    l100?.sMed !== undefined &&
    l100.sMed > l9.sMed &&
    vazaoEstabilizadaFinalM3h !== null
  ) {
    deltaSCicloM = Number((l100.sMed - l9.sMed).toFixed(2));
    transmissividadeM2Dia = Number(
      (((0.183 * vazaoEstabilizadaFinalM3h) / deltaSCicloM) * 24).toFixed(2)
    );
  } else if (vazaoEstabilizadaFinalM3h !== null) {
    transmissividadeM2Dia = Number(
      (((0.183 * vazaoEstabilizadaFinalM3h) / 19.0) * 24).toFixed(2)
    );
  }

  const eficienciaUltimaEtapaPct = ultimaValida?.eficienciaPct ?? null;
  const vazaoMaximaM3h = ultimaValida?.vazao ?? vazaoEstabilizadaFinalM3h;

  // Recuperação residual REAL recalculada (%) com base na última leitura da planilha de recuperação (t' = 35 min)
  const ultimaRec =
    leiturasRecuperacaoCalc.length > 0
      ? leiturasRecuperacaoCalc[leiturasRecuperacaoCalc.length - 1]
      : null;
  const nivelRec = ultimaRec?.nd ?? parseNumeroSEMA(teste?.nivelRecuperacaoFinalM) ?? null;

  let percentualRecuperacao: number | null = null;
  if (
    ne !== null &&
    rebaixamentoMaximoM !== null &&
    rebaixamentoMaximoM > 0 &&
    nivelRec !== null
  ) {
    const residual = Math.max(0, nivelRec - ne);
    const recuperado = Math.max(0, rebaixamentoMaximoM - residual);
    percentualRecuperacao = Number(
      Math.min(100, (recuperado / rebaixamentoMaximoM) * 100).toFixed(1)
    );
  }

  let classificacaoEficiencia: ResultadoStepDrawdownSEMA['classificacaoEficiencia'] =
    {
      rotulo: 'Ensaio Hidrodinâmico Padrão ABNT NBR 12244',
      cor: 'slate',
      parecerTecnico:
        'Planilha de bombeamento contínuo, recuperação e interpretação configuradas segundo a ABNT NBR 12244.',
    };

  if (eficienciaUltimaEtapaPct !== null) {
    if (eficienciaUltimaEtapaPct >= 70) {
      classificacaoEficiencia = {
        rotulo: `Alta Eficiência Hidráulica (${fmtNumeroSEMA(
          eficienciaUltimaEtapaPct,
          1,
          '%'
        )})`,
        cor: 'emerald',
        parecerTecnico:
          'Poço bem desenvolvido e com baixas perdas turbulentas nos filtros/fraturas (η ≥ 70%). Em plena conformidade com a ABNT NBR 12244.',
      };
    } else if (eficienciaUltimaEtapaPct >= 50) {
      classificacaoEficiencia = {
        rotulo: `Eficiência Moderada (${fmtNumeroSEMA(
          eficienciaUltimaEtapaPct,
          1,
          '%'
        )})`,
        cor: 'amber',
        parecerTecnico:
          'Perdas de carga turbulentas moderadas (50% ≤ η < 70%). Recomenda-se operar na vazão estabilizada e monitorar o nível dinâmico.',
      };
    } else {
      classificacaoEficiencia = {
        rotulo: `Baixa Eficiência / Perda Turbulenta Elevada (${fmtNumeroSEMA(
          eficienciaUltimaEtapaPct,
          1,
          '%'
        )})`,
        cor: 'red',
        parecerTecnico:
          'Elevada perda de carga turbulenta (η < 50%). Indica necessidade de limpeza/desenvolvimento complementar.',
      };
    }
  }

  return {
    neInicial: ne,
    etapasCalculadas,
    leiturasBombeamentoCalc,
    leiturasRecuperacaoCalc,
    coeficienteB: B,
    coeficienteB24h: B !== null ? Number((B * 1.05).toFixed(4)) : null,
    coeficienteC: C,
    deltaSCicloM,
    transmissividadeM2Dia,
    eficienciaMediaPct,
    eficienciaUltimaEtapaPct,
    rebaixamentoMaximoM,
    vazaoMaximaM3h,
    vazaoEstabilizadaFinalM3h,
    ndEstabilizadoFinalM,
    qPorSFinal,
    sPorQFinal,
    percentualRecuperacao,
    classificacaoEficiencia,
  };
}

interface StepDrawdownSectionProps {
  dadosPoco: DadosPocoArtesiano;
  onChangeTesteSEMA: (novoTeste: DadosTesteVazaoSEMA) => void;
  onSincronizarComDadosPoco: (ndFinal: string, vazaoFinal: string) => void;
  onExportarPDFTesteBombeamento?: () => void;
}

export const StepDrawdownSection: React.FC<StepDrawdownSectionProps> = ({
  dadosPoco,
  onChangeTesteSEMA,
  onSincronizarComDadosPoco,
  onExportarPDFTesteBombeamento,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<
    'bombeamento' | 'recuperacao' | 'interpretacao'
  >('bombeamento');

  const neBaseNumero = parseNumeroSEMA(dadosPoco.nivelEstatico) ?? 22.4;

  const testeAtual: DadosTesteVazaoSEMA = useMemo(() => {
    const base = dadosPoco.testeVazaoSEMA;
    return {
      ativo: base?.ativo ?? true,
      tipoEnsaio: base?.tipoEnsaio || 'Contínuo 24h a Vazão Constante',
      etapaLabel: base?.etapaLabel || '24H',
      referenciaMedidasM: base?.referenciaMedidasM || '0,00',
      responsavelTecnicoNome:
        base?.responsavelTecnicoNome || 'Eng. Geólogo José Roberto Ribeiro',
      responsavelTecnicoCPF: '',
      responsavelTecnicoCREA:
        base?.responsavelTecnicoCREA || 'CREA [DADO A PREENCHER EM CAMPO]',
      artNumero: base?.artNumero || '[DADO A PREENCHER EM CAMPO]',
      dataInicioEnsaio: base?.dataInicioEnsaio || '2026-03-13',
      horaInicioBombeamento: base?.horaInicioBombeamento || '11:30:00',
      dataFinalBombeamento: base?.dataFinalBombeamento || '2026-03-13',
      horaFinalBombeamento: base?.horaFinalBombeamento || '18:10:00',
      dataInicioRecuperacao: base?.dataInicioRecuperacao || '2026-03-13',
      horaInicioRecuperacao: base?.horaInicioRecuperacao || '18:10:00',
      dataFinalRecuperacao: base?.dataFinalRecuperacao || '2026-03-13',
      horaFinalRecuperacao: base?.horaFinalRecuperacao || '18:45:00',
      tempoRecuperacaoMinutos: base?.tempoRecuperacaoMinutos || '35',
      nivelRecuperacaoFinalM: base?.nivelRecuperacaoFinalM || '33,60',
      vazaoOutorgaRecomendadaM3h:
        base?.vazaoOutorgaRecomendadaM3h || '10,29',
      regimeBombeamentoHorasDia: base?.regimeBombeamentoHorasDia || '16',
      leiturasBombeamento:
        base?.leiturasBombeamento && base.leiturasBombeamento.length > 0
          ? base.leiturasBombeamento
          : criarLeiturasBombeamentoPadraoGeoeste(neBaseNumero),
      leiturasRecuperacao:
        base?.leiturasRecuperacao && base.leiturasRecuperacao.length > 0
          ? base.leiturasRecuperacao
          : criarLeiturasRecuperacaoPadraoGeoeste(neBaseNumero),
      etapas:
        base?.etapas && base.etapas.length > 0
          ? base.etapas
          : criarEtapasPadraoSEMA(neBaseNumero),
    };
  }, [dadosPoco.testeVazaoSEMA, neBaseNumero]);

  const resultado = useMemo(
    () =>
      calcularParametrosStepDrawdownSEMA(dadosPoco.nivelEstatico, testeAtual),
    [dadosPoco.nivelEstatico, testeAtual]
  );

  const atualizarCampoTeste = <K extends keyof DadosTesteVazaoSEMA>(
    campo: K,
    valor: DadosTesteVazaoSEMA[K]
  ) => {
    onChangeTesteSEMA({
      ...testeAtual,
      [campo]: valor,
    });
  };

  // Carrega os dados consolidados e corrigidos do Poço PT01 (OS-2026-0842 / CTR-119)
  const carregarExemploUFMTGeoeste = () => {
    onChangeTesteSEMA({
      ...testeAtual,
      ativo: true,
      tipoEnsaio: 'Contínuo 24h a Vazão Constante',
      etapaLabel: '24H',
      referenciaMedidasM: '0,00',
      responsavelTecnicoNome: 'Eng. Geólogo José Roberto Ribeiro',
      responsavelTecnicoCPF: '',
      responsavelTecnicoCREA: 'CREA [DADO A PREENCHER EM CAMPO]',
      dataInicioEnsaio: '2026-03-13',
      horaInicioBombeamento: '11:30:00',
      dataFinalBombeamento: '2026-03-13',
      horaFinalBombeamento: '18:10:00',
      dataInicioRecuperacao: '2026-03-13',
      horaInicioRecuperacao: '18:10:00',
      dataFinalRecuperacao: '2026-03-13',
      horaFinalRecuperacao: '18:45:00',
      nivelRecuperacaoFinalM: '33,60',
      vazaoOutorgaRecomendadaM3h: '10,29',
      leiturasBombeamento: criarLeiturasBombeamentoPadraoGeoeste(neBaseNumero),
      leiturasRecuperacao: criarLeiturasRecuperacaoPadraoGeoeste(neBaseNumero),
      etapas: criarEtapasPadraoSEMA(neBaseNumero),
    });
  };

  // Edição das Leituras de Bombeamento (Página 3)
  const atualizarLeituraBombeamento = (
    id: string,
    campo: keyof LeituraBombeamentoGeoeste,
    valor: string | number
  ) => {
    const lista = (testeAtual.leiturasBombeamento || []).map((l) =>
      l.id === id ? { ...l, [campo]: valor } : l
    );
    atualizarCampoTeste('leiturasBombeamento', lista);
  };

  const adicionarLinhaBombeamento = () => {
    const lista = testeAtual.leiturasBombeamento || [];
    const ultima = lista[lista.length - 1];
    const novoT = ultima ? ultima.tMin + 30 : 1;
    const nova: LeituraBombeamentoGeoeste = {
      id: `bomb-${Date.now()}`,
      tMin: novoT,
      ndM: ultima?.ndM || '54,20',
      vazaoM3h: ultima?.vazaoM3h || '10,286',
      areiaPpm: '',
      observacoes: '',
    };
    atualizarCampoTeste('leiturasBombeamento', [...lista, nova]);
  };

  const removerLinhaBombeamento = (id: string) => {
    const lista = (testeAtual.leiturasBombeamento || []).filter(
      (l) => l.id !== id
    );
    atualizarCampoTeste('leiturasBombeamento', lista);
  };

  // Repete o ND e Vazão de uma linha até o final da tabela (para quando o poço estabiliza!)
  const repetirEstabilizacaoAteOFinal = (indiceBase: number) => {
    const lista = [...(testeAtual.leiturasBombeamento || [])];
    const ref = lista[indiceBase];
    if (!ref) return;
    const atualizada = lista.map((item, idx) =>
      idx >= indiceBase
        ? { ...item, ndM: ref.ndM, vazaoM3h: ref.vazaoM3h }
        : item
    );
    atualizarCampoTeste('leiturasBombeamento', atualizada);
  };

  // Edição das Leituras de Recuperação (Página 5)
  const atualizarLeituraRecuperacao = (
    id: string,
    campo: keyof LeituraRecuperacaoGeoeste,
    valor: string | number
  ) => {
    const lista = (testeAtual.leiturasRecuperacao || []).map((l) =>
      l.id === id ? { ...l, [campo]: valor } : l
    );
    atualizarCampoTeste('leiturasRecuperacao', lista);
  };

  const adicionarLinhaRecuperacao = () => {
    const lista = testeAtual.leiturasRecuperacao || [];
    const ultima = lista[lista.length - 1];
    const novoT = ultima ? ultima.tMin + 5 : 1;
    const nova: LeituraRecuperacaoGeoeste = {
      id: `rec-${Date.now()}`,
      tMin: novoT,
      ndM: ultima?.ndM || '20,00',
      sCalcM: '',
      observacoes: '',
    };
    atualizarCampoTeste('leiturasRecuperacao', [...lista, nova]);
  };

  const removerLinhaRecuperacao = (id: string) => {
    const lista = (testeAtual.leiturasRecuperacao || []).filter(
      (l) => l.id !== id
    );
    atualizarCampoTeste('leiturasRecuperacao', lista);
  };

  // Edição das Etapas de Interpretação (Página 7)
  const atualizarEtapa = <K extends keyof EtapaStepDrawdownSEMA>(
    id: string,
    campo: K,
    valor: EtapaStepDrawdownSEMA[K]
  ) => {
    const novas = (testeAtual.etapas || []).map((et) =>
      et.id === id ? { ...et, [campo]: valor } : et
    );
    atualizarCampoTeste('etapas', novas);
  };

  const adicionarEtapa = () => {
    const etapas = testeAtual.etapas || [];
    const ultima = etapas[etapas.length - 1];
    const ultimaQ = parseNumeroSEMA(ultima?.vazaoM3h) || 10;
    const ultimoND = parseNumeroSEMA(ultima?.nivelDinamicoM) || neBaseNumero + 20;

    const nova: EtapaStepDrawdownSEMA = {
      id: `step-${Date.now()}`,
      etapa: etapas.length + 1,
      duracaoMinutos: 60,
      vazaoM3h: (ultimaQ + 2.0).toFixed(2).replace('.', ','),
      nivelDinamicoM: (ultimoND + 4.0).toFixed(2).replace('.', ','),
      observacao: `${etapas.length + 1}º Escalonamento`,
    };
    atualizarCampoTeste('etapas', [...etapas, nova]);
  };

  const removerEtapa = (id: string) => {
    const filtradas = (testeAtual.etapas || [])
      .filter((et) => et.id !== id)
      .map((et, idx) => ({ ...et, etapa: idx + 1 }));
    atualizarCampoTeste('etapas', filtradas);
  };

  // Dados para o Gráfico Semi-Log da Página 4: Eixo X = s (m) linear, Eixo Y = t (min) logarítmico
  const dadosGraficoBombeamentoSemiLog = useMemo(() => {
    return resultado.leiturasBombeamentoCalc
      .filter((l) => l.sMed !== null && l.sMed >= 0 && l.tMin >= 1)
      .map((l) => ({
        s: l.sMed as number,
        t: l.tMin,
        hora: l.horaFormatada,
        nd: l.nd,
        q: l.vazao,
      }));
  }, [resultado.leiturasBombeamentoCalc]);

  // Dados para o Gráfico Semi-Log de Recuperação da Página 6: Eixo X = s (m) linear, Eixo Y = t (min) logarítmico
  const dadosGraficoRecuperacaoSemiLog = useMemo(() => {
    return resultado.leiturasRecuperacaoCalc
      .filter((l) => l.sMed !== null && l.sMed >= 0 && l.tMin >= 1)
      .map((l) => ({
        s: l.sMed as number,
        t: l.tMin,
        hora: l.horaFormatada,
        nd: l.nd,
      }));
  }, [resultado.leiturasRecuperacaoCalc]);

  // Dados para os Gráficos da Página 7: (s/Q x Q) e (s x Q)
  const dadosGraficoInterpretacao = useMemo(() => {
    return resultado.etapasCalculadas
      .filter((e) => e.vazao !== null && e.rebaixamento !== null)
      .sort((a, b) => (a.vazao as number) - (b.vazao as number))
      .map((e) => ({
        q: e.vazao as number,
        s: e.rebaixamento as number,
        sCalc: e.sCalc,
        sPorQ: e.rebaixamentoEspecifico,
        sPorQCalc: e.sPorQCalc,
        eficiencia: e.eficienciaPct,
      }));
  }, [resultado.etapasCalculadas]);

  return (
    <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-5">
      {/* Cabeçalho do Módulo Grupo Geoeste — Teste de Bombeamento */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DDE3EC] dark:border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#1B2A3B] text-[#E8A020] shrink-0 mt-0.5">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100">
                Relatório de Teste de Bombeamento
              </h2>
            </div>
            <p className="text-xs text-[#6B7A8D] dark:text-slate-400 mt-0.5">
              Teste de Bombeamento · Teste de Recuperação · Interpretação
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={testeAtual.ativo}
              onChange={(e) => atualizarCampoTeste('ativo', e.target.checked)}
              className="w-4 h-4 accent-[#E8A020] cursor-pointer"
            />
            <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100">
              Incluir
            </span>
          </label>

          {testeAtual.ativo && onExportarPDFTesteBombeamento && (
            <button
              type="button"
              onClick={onExportarPDFTesteBombeamento}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#243447] text-[#E8A020] flex items-center gap-1.5 shadow-xs"
            >
              <FileDown className="w-4 h-4" />
              Exportar PDF
            </button>
          )}
        </div>
      </div>

      {!testeAtual.ativo ? (
        <div className="p-5 rounded-xl border border-dashed border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-[#6B7A8D] dark:text-slate-400">
            Ative o <strong>Relatório Especializado de Teste de Bombeamento</strong> para preencher as leituras de rebaixamento, recuperação e gerar os gráficos semi-logarítmicos `s(m) × t(min)` e de interpretação `s/Q × Q`.
          </div>
          <button
            type="button"
            onClick={carregarExemploUFMTGeoeste}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ativar com Dados
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Metadados do Cabeçalho do Teste de Bombeamento (Páginas 2, 3 e 5 do PDF) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3 p-4 rounded-xl bg-[#F7F9FC] dark:bg-slate-950 border border-[#DDE3EC] dark:border-slate-800">
            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                N.E. Base (m)
              </label>
              <div className="px-2.5 py-1.5 text-xs font-mono font-bold rounded bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 text-sky-600">
                {dadosPoco.nivelEstatico || '12,50'}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                Crivo (m)
              </label>
              <div className="px-2.5 py-1.5 text-xs font-mono font-bold rounded bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800">
                {dadosPoco.crivo || '84,00'}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                Etapa / Duração
              </label>
              <input
                type="text"
                value={testeAtual.etapaLabel || '48H'}
                onChange={(e) =>
                  atualizarCampoTeste('etapaLabel', e.target.value)
                }
                placeholder="Ex: 48H ou 24H"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                Hora Início Bomb.
              </label>
              <input
                type="text"
                value={testeAtual.horaInicioBombeamento || '11:30:00'}
                onChange={(e) =>
                  atualizarCampoTeste('horaInicioBombeamento', e.target.value)
                }
                placeholder="11:30:00"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                Hora Início Recup.
              </label>
              <input
                type="text"
                value={testeAtual.horaInicioRecuperacao || '17:50:00'}
                onChange={(e) =>
                  atualizarCampoTeste('horaInicioRecuperacao', e.target.value)
                }
                placeholder="17:50:00"
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-1">
                Responsável Técnico
              </label>
              <input
                type="text"
                value={testeAtual.responsavelTecnicoNome || ''}
                onChange={(e) =>
                  atualizarCampoTeste(
                    'responsavelTecnicoNome',
                    e.target.value
                  )
                }
                placeholder="JOSE ROBERTO RIBEIRO"
                className="w-full px-2.5 py-1.5 text-xs rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
          </div>

          {/* Seletor das 3 Seções do Relatório Grupo Geoeste */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[#DDE3EC] dark:border-slate-800 pb-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:flex lg:flex-wrap items-stretch lg:items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAbaAtiva('bombeamento')}
                className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-left ${
                  abaAtiva === 'bombeamento'
                    ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                    : 'bg-[#F0F3F7] dark:bg-slate-800 text-[#6B7A8D] hover:text-[#1B2A3B]'
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  1. Bombeamento
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva('recuperacao')}
                className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-left ${
                  abaAtiva === 'recuperacao'
                    ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                    : 'bg-[#F0F3F7] dark:bg-slate-800 text-[#6B7A8D] hover:text-[#1B2A3B]'
                }`}
              >
                <Activity className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  2. Recuperação
                </span>
              </button>

              <button
                type="button"
                onClick={() => setAbaAtiva('interpretacao')}
                className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 text-left ${
                  abaAtiva === 'interpretacao'
                    ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                    : 'bg-[#F0F3F7] dark:bg-slate-800 text-[#6B7A8D] hover:text-[#1B2A3B]'
                }`}
              >
                <Gauge className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  3. Interpretação
                </span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={carregarExemploUFMTGeoeste}
                className="px-2.5 py-2 text-[11px] font-semibold rounded-lg border border-[#DDE3EC] dark:border-slate-700 hover:border-[#E8A020] flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3 text-[#E8A020] shrink-0" />
                <span>Padrão</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    resultado.ndEstabilizadoFinalM !== null &&
                    resultado.vazaoEstabilizadaFinalM3h !== null
                  ) {
                    onSincronizarComDadosPoco(
                      `${fmtNumeroSEMA(resultado.ndEstabilizadoFinalM, 2)}m`,
                      `${fmtNumeroSEMA(
                        resultado.vazaoEstabilizadaFinalM3h,
                        2
                      )}m³/h`
                    );
                  }
                }}
                className="px-2.5 py-2 text-[11px] font-bold rounded-lg bg-[#2E4260] text-white hover:bg-[#1B2A3B] flex items-center gap-1"
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-[#E8A020] shrink-0" />
                <span>Sincronizar Poço</span>
              </button>
            </div>
          </div>

          {/* ABA 1: PLANILHA DE BOMBEAMENTO (PÁG. 3) + GRÁFICO SEMI-LOG s(m) × t(min) (PÁG. 4) */}
          {abaAtiva === 'bombeamento' && (
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
              {/* Planilha de Bombeamento (Coluna Esquerda - 7 cols em 2XL) */}
              <div className="2xl:col-span-7 space-y-3 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                    Planilha de Teste de Bombeamento ({resultado.leiturasBombeamentoCalc.length} leituras)
                  </span>
                  <span className="text-[11px] text-[#6B7A8D]">
                    Dica: clique em <CopyCheck className="w-3.5 h-3.5 inline text-[#E8A020]" /> para repetir o nível estabilizado até o final
                  </span>
                </div>

                <div className="max-h-[480px] overflow-x-auto overflow-y-auto border border-[#DDE3EC] dark:border-slate-800 rounded-xl">
                  <table className="w-full min-w-[540px] border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[#1B2A3B] text-white text-[10.5px] uppercase">
                      <tr>
                        <th className="py-2 px-2 text-center">Hora</th>
                        <th className="py-2 px-2 text-center">t (min)</th>
                        <th className="py-2 px-2 text-right">N.D. (m)</th>
                        <th className="py-2 px-2 text-right">Q (m³/h)</th>
                        <th className="py-2 px-2 text-right">s med (m)</th>
                        <th className="py-2 px-2 text-center">Areia</th>
                        <th className="py-2 px-2 text-center w-16">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800 font-mono">
                      {resultado.leiturasBombeamentoCalc.map((lCalc, idx) => {
                        const bruta = testeAtual.leiturasBombeamento?.[idx];
                        if (!bruta) return null;

                        return (
                          <tr
                            key={bruta.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-1.5 px-2 text-center text-[11px] text-[#6B7A8D]">
                              {lCalc.horaFormatada}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold">
                              <input
                                type="number"
                                value={bruta.tMin}
                                onChange={(e) =>
                                  atualizarLeituraBombeamento(
                                    bruta.id,
                                    'tMin',
                                    parseInt(e.target.value, 10) || 1
                                  )
                                }
                                className="w-16 px-1.5 py-1 text-center rounded border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="text"
                                value={bruta.ndM}
                                onChange={(e) =>
                                  atualizarLeituraBombeamento(
                                    bruta.id,
                                    'ndM',
                                    e.target.value
                                  )
                                }
                                className="w-20 px-1.5 py-1 text-right font-bold rounded border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="text"
                                value={bruta.vazaoM3h}
                                onChange={(e) =>
                                  atualizarLeituraBombeamento(
                                    bruta.id,
                                    'vazaoM3h',
                                    e.target.value
                                  )
                                }
                                className="w-20 px-1.5 py-1 text-right font-bold rounded border border-[#27AE60]/50 bg-[#F4FBF7] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-sky-700 dark:text-sky-400">
                              {fmtNumeroSEMA(lCalc.sMed, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <input
                                type="text"
                                value={bruta.areiaPpm || ''}
                                onChange={(e) =>
                                  atualizarLeituraBombeamento(
                                    bruta.id,
                                    'areiaPpm',
                                    e.target.value
                                  )
                                }
                                placeholder="0"
                                className="w-14 px-1.5 py-1 text-center rounded border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    repetirEstabilizacaoAteOFinal(idx)
                                  }
                                  title="Repetir este N.D. e Vazão até o final (estabilização)"
                                  className="p-1 rounded text-[#E8A020] hover:bg-amber-50 dark:hover:bg-slate-800"
                                >
                                  <CopyCheck className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removerLinhaBombeamento(bruta.id)
                                  }
                                  title="Remover leitura"
                                  className="p-1 rounded text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={adicionarLinhaBombeamento}
                  className="w-full py-2 rounded-lg border-2 border-dashed border-[#E8A020] text-[#E8A020] font-bold text-xs hover:bg-[#E8A020]/5 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Tempo de Leitura t (min)</span>
                </button>
              </div>

              {/* Gráfico Semi-Logarítmico CORRETO: t (min) no Eixo X Logarítmico × s (m) no Eixo Y Linear */}
              <div className="2xl:col-span-5 space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                    Gráfico Anexo I.1: TESTE DE VAZÃO — s (m) × log t (min)
                  </span>
                  <span className="text-[10px] font-mono text-[#6B7A8D]">
                    Eixo X: log t (min) · Eixo Y: s (m)
                  </span>
                </div>

                <div className="rounded-xl border-2 border-[#1B2A3B] bg-[#C8E8EE] p-2.5 sm:p-3 shadow-inner">
                  <div className="text-center text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] mb-1">
                    TESTE DE VAZÃO CONTÍNUO — Cooper-Jacob (s × log t)
                  </div>
                  <div className="w-full h-[340px] sm:h-[460px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dadosGraficoBombeamentoSemiLog}
                        margin={{ top: 12, right: 18, left: 8, bottom: 22 }}
                      >
                        <CartesianGrid
                          stroke="#7FB8C4"
                          strokeDasharray="2 2"
                        />
                        <XAxis
                          type="number"
                          dataKey="t"
                          name="t (min)"
                          scale="log"
                          domain={[1, 1000]}
                          ticks={[1, 2, 5, 10, 20, 50, 100, 200, 400, 1000]}
                          allowDataOverflow
                          tick={{ fontSize: 10, fill: '#0F172A' }}
                          label={{
                            value: 'Tempo de Bombeamento t (min) — Escala Logarítmica',
                            position: 'insideBottom',
                            offset: -12,
                            fontSize: 11,
                            fontWeight: 'bold',
                            fill: '#0F172A',
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="s"
                          name="s (m)"
                          domain={[0, 45]}
                          tick={{ fontSize: 10, fill: '#0F172A' }}
                          label={{
                            value: 'Rebaixamento s (m)',
                            angle: -90,
                            position: 'insideLeft',
                            fontSize: 11,
                            fontWeight: 'bold',
                            fill: '#0F172A',
                          }}
                        />
                        <Tooltip
                          formatter={(val, name) => [
                            fmtNumeroSEMA(Number(val), 2),
                            name === 's' ? 's (m)' : 't (min)',
                          ]}
                          labelFormatter={(label) =>
                            `Tempo t = ${label} min`
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="s"
                          stroke="#0022CC"
                          strokeWidth={2}
                          dot={{
                            r: 3.5,
                            fill: '#0022CC',
                            stroke: '#0022CC',
                          }}
                          activeDot={{ r: 5.5 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: PLANILHA DE RECUPERAÇÃO (ANEXO I.2) + GRÁFICO SEMI-LOG DE RECUPERAÇÃO */}
          {abaAtiva === 'recuperacao' && (
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
              {/* Planilha de Recuperação (Coluna Esquerda - 7 cols em 2XL) */}
              <div className="2xl:col-span-7 space-y-3 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                    Planilha de Recuperação ({resultado.leiturasRecuperacaoCalc.length} leituras)
                  </span>
                  <span className="text-[11px] font-mono text-[#27AE60] font-bold">
                    Recuperação real recalculada (35 min):{' '}
                    {fmtNumeroSEMA(resultado.percentualRecuperacao, 1, '%')}
                  </span>
                </div>

                <div className="max-h-[460px] overflow-x-auto overflow-y-auto border border-[#DDE3EC] dark:border-slate-800 rounded-xl">
                  <table className="w-full min-w-[560px] border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-[#1B2A3B] text-white text-[10.5px] uppercase">
                      <tr>
                        <th className="py-2 px-2 text-center">Hora</th>
                        <th className="py-2 px-2 text-center">t&apos; (min)</th>
                        <th className="py-2 px-2 text-right">N.D. (m)</th>
                        <th className="py-2 px-2 text-right">s&apos; med (m)</th>
                        <th className="py-2 px-2 text-center">t/t&apos;</th>
                        <th className="py-2 px-2 text-right">s&apos; calc (m)</th>
                        <th className="py-2 px-2 text-left">Observações</th>
                        <th className="py-2 px-2 text-center w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800 font-mono">
                      {resultado.leiturasRecuperacaoCalc.map((rCalc, idx) => {
                        const bruta = testeAtual.leiturasRecuperacao?.[idx];
                        if (!bruta) return null;

                        return (
                          <tr
                            key={bruta.id}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-1.5 px-2 text-center text-[11px] text-[#6B7A8D]">
                              {rCalc.horaFormatada}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold">
                              <input
                                type="number"
                                value={bruta.tMin}
                                onChange={(e) =>
                                  atualizarLeituraRecuperacao(
                                    bruta.id,
                                    'tMin',
                                    parseInt(e.target.value, 10) || 1
                                  )
                                }
                                className="w-16 px-1.5 py-1 text-center rounded border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="text"
                                value={bruta.ndM}
                                onChange={(e) =>
                                  atualizarLeituraRecuperacao(
                                    bruta.id,
                                    'ndM',
                                    e.target.value
                                  )
                                }
                                className="w-20 px-1.5 py-1 text-right font-bold rounded border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-sky-700 dark:text-sky-400">
                              {fmtNumeroSEMA(rCalc.sMed, 2)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-semibold text-[#1B2A3B] dark:text-slate-300">
                              {rCalc.relacaoTT}
                            </td>
                            <td className="py-1.5 px-2 text-right text-[#6B7A8D]">
                              {rCalc.sCalc}
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={bruta.observacoes || ''}
                                onChange={(e) =>
                                  atualizarLeituraRecuperacao(
                                    bruta.id,
                                    'observacoes',
                                    e.target.value
                                  )
                                }
                                placeholder="[DADO A PREENCHER EM CAMPO]"
                                className="w-full px-2 py-1 text-xs font-sans rounded border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() =>
                                  removerLinhaRecuperacao(bruta.id)
                                }
                                className="p-1 rounded text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={adicionarLinhaRecuperacao}
                  className="w-full py-2 rounded-lg border-2 border-dashed border-[#E8A020] text-[#E8A020] font-bold text-xs hover:bg-[#E8A020]/5 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Leitura de Recuperação</span>
                </button>
              </div>

              {/* Gráfico Semi-Logarítmico do Anexo I.2: Recuperação s' (m) × log t' (min) */}
              <div className="2xl:col-span-5 space-y-2 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                    Gráfico Anexo I.2: RECUPERAÇÃO — s&apos; (m) × log t&apos; (min)
                  </span>
                  <span className="text-[10px] font-mono text-[#6B7A8D]">
                    Eixo X: log t&apos; (min) · Eixo Y: s&apos; (m)
                  </span>
                </div>

                <div className="rounded-xl border-2 border-[#1B2A3B] bg-[#C8E8EE] p-2.5 sm:p-3 shadow-inner">
                  <div className="text-center text-xs font-extrabold uppercase tracking-wider text-[#1B2A3B] mb-1">
                    RECUPERAÇÃO RESIDUAL — s&apos; (m) × log t&apos; (min)
                  </div>
                  <div className="w-full h-[320px] sm:h-[440px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={dadosGraficoRecuperacaoSemiLog}
                        margin={{ top: 12, right: 18, left: 8, bottom: 22 }}
                      >
                        <CartesianGrid
                          stroke="#7FB8C4"
                          strokeDasharray="2 2"
                        />
                        <XAxis
                          type="number"
                          dataKey="t"
                          name="t' (min)"
                          scale="log"
                          domain={[1, 50]}
                          ticks={[1, 2, 5, 10, 20, 35, 50]}
                          allowDataOverflow
                          tick={{ fontSize: 10, fill: '#0F172A' }}
                          label={{
                            value: "Tempo de Recuperação t' (min) — Escala Logarítmica",
                            position: 'insideBottom',
                            offset: -12,
                            fontSize: 11,
                            fontWeight: 'bold',
                            fill: '#0F172A',
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="s"
                          name="s' (m)"
                          domain={[0, 42]}
                          tick={{ fontSize: 10, fill: '#0F172A' }}
                          label={{
                            value: "Rebaixamento Residual s' (m)",
                            angle: -90,
                            position: 'insideLeft',
                            fontSize: 11,
                            fontWeight: 'bold',
                            fill: '#0F172A',
                          }}
                        />
                        <Tooltip
                          formatter={(val, name) => [
                            fmtNumeroSEMA(Number(val), 2),
                            name === 's' ? "s' (m)" : "t' (min)",
                          ]}
                          labelFormatter={(label) =>
                            `Tempo de Recuperação t' = ${label} min`
                          }
                        />
                        <Line
                          type="monotone"
                          dataKey="s"
                          stroke="#0022CC"
                          strokeWidth={2}
                          dot={{
                            r: 3.5,
                            fill: '#0022CC',
                            stroke: '#0022CC',
                          }}
                          activeDot={{ r: 5.5 }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: INTERPRETAÇÃO DO TESTE DE BOMBEAMENTO (PÁG. 7 DO PDF GRUPO GEOESTE) */}
          {abaAtiva === 'interpretacao' && (
            <div className="space-y-5">
              {/* Tabela Superior da Página 7 + Escalonamentos */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-200">
                    INTERPRETAÇÃO TESTE DE BOMBEAMENTO (PÁG. 3 DO ANEXO — Equação s = B·Q + C·Q²)
                  </span>
                  <button
                    type="button"
                    onClick={adicionarEtapa}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#E8A020] text-[#1B2A3B] hover:bg-[#F5B93A] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Degrau de Interpretação</span>
                  </button>
                </div>

                <div className="overflow-x-auto border border-[#DDE3EC] dark:border-slate-800 rounded-xl">
                  <table className="w-full min-w-[680px] border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#1B2A3B] text-white text-[10.5px] uppercase">
                        <th className="py-2 px-2.5 text-center">#</th>
                        <th className="py-2 px-2.5 text-right">Q (m³/h)</th>
                        <th className="py-2 px-2.5 text-right">N.D. (m)</th>
                        <th className="py-2 px-2.5 text-right">s med (m)</th>
                        <th className="py-2 px-2.5 text-right">
                          s/Q (m/m³/h)
                        </th>
                        <th className="py-2 px-2.5 text-right">
                          Q/s (m³/h/m)
                        </th>
                        <th className="py-2 px-2.5 text-right">s calc. (m)</th>
                        <th className="py-2 px-2.5 text-right">
                          s/Q calc. (m/m³/h)
                        </th>
                        <th className="py-2 px-2.5 text-right">
                          Eficiência (η%)
                        </th>
                        <th className="py-2 px-2 w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800 font-mono">
                      {resultado.etapasCalculadas.map((etCalc, idx) => {
                        const bruta = testeAtual.etapas[idx];
                        if (!bruta) return null;
                        return (
                          <tr key={bruta.id}>
                            <td className="py-2 px-2.5 text-center font-bold">
                              {idx + 1}º
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <input
                                type="text"
                                value={bruta.vazaoM3h}
                                onChange={(e) =>
                                  atualizarEtapa(
                                    bruta.id,
                                    'vazaoM3h',
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 text-right font-bold rounded border border-[#27AE60]/50 bg-[#F4FBF7] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              <input
                                type="text"
                                value={bruta.nivelDinamicoM}
                                onChange={(e) =>
                                  atualizarEtapa(
                                    bruta.id,
                                    'nivelDinamicoM',
                                    e.target.value
                                  )
                                }
                                className="w-20 px-2 py-1 text-right font-bold rounded border border-[#E8A020]/60 bg-[#FFFDF7] dark:bg-slate-950"
                              />
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold">
                              {fmtNumeroSEMA(etCalc.rebaixamento, 2)}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {fmtNumeroSEMA(etCalc.rebaixamentoEspecifico, 3)}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {fmtNumeroSEMA(etCalc.capacidadeEspecifica, 3)}
                            </td>
                            <td className="py-2 px-2.5 text-right text-[#6B7A8D]">
                              {fmtNumeroSEMA(etCalc.sCalc, 2)}
                            </td>
                            <td className="py-2 px-2.5 text-right text-[#6B7A8D]">
                              {fmtNumeroSEMA(etCalc.sPorQCalc, 3)}
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold text-[#27AE60]">
                              {fmtNumeroSEMA(etCalc.eficienciaPct, 1, '%')}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removerEtapa(bruta.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dois Gráficos da Página 7: (s/Q x Q) e (s x Q) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Gráfico 1: s/Q x Q */}
                <div className="rounded-xl border border-[#1B2A3B]/30 bg-white dark:bg-slate-950 p-4 space-y-2">
                  <div className="text-center">
                    <span className="inline-block px-3 py-0.5 border border-[#1B2A3B] text-xs font-bold shadow-2xs">
                      s/Q x Q
                    </span>
                  </div>
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={dadosGraficoInterpretacao}
                        margin={{ top: 10, right: 16, left: 6, bottom: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                        <XAxis
                          type="number"
                          dataKey="q"
                          name="Q (m³/h)"
                          domain={[0, 'auto']}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Q (m³/h)',
                            position: 'insideBottom',
                            offset: -10,
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}
                        />
                        <YAxis
                          unit=""
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 's/Q (m/m³/h)',
                            angle: -90,
                            position: 'insideLeft',
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}
                        />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Line
                          type="monotone"
                          dataKey="sPorQ"
                          name="Medido (s/Q x Q)"
                          stroke="#1D4ED8"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#1D4ED8' }}
                        />
                        <Line
                          type="linear"
                          dataKey="sPorQCalc"
                          name="Linear Ajustado (B + C·Q)"
                          stroke="#10B981"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          dot={{ r: 3, fill: '#EF4444' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 2: s x Q */}
                <div className="rounded-xl border border-[#1B2A3B]/30 bg-white dark:bg-slate-950 p-4 space-y-2">
                  <div className="text-center">
                    <span className="inline-block px-3 py-0.5 border border-[#1B2A3B] text-xs font-bold shadow-2xs">
                      s x Q
                    </span>
                  </div>
                  <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={dadosGraficoInterpretacao}
                        margin={{ top: 10, right: 16, left: 6, bottom: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.4} />
                        <XAxis
                          type="number"
                          dataKey="q"
                          name="Q (m³/h)"
                          domain={[0, 'auto']}
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 'Q (m³/h)',
                            position: 'insideBottom',
                            offset: -10,
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          label={{
                            value: 's (m)',
                            angle: -90,
                            position: 'insideLeft',
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}
                        />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar
                          dataKey="s"
                          name="Rebaixamento Medido s (m)"
                          fill="#E8A020"
                          fillOpacity={0.35}
                          barSize={24}
                        />
                        <Line
                          type="monotone"
                          dataKey="sCalc"
                          name="Curva s = B·Q + C·Q²"
                          stroke="#1B2A3B"
                          strokeWidth={2.2}
                          dot={{ r: 4, fill: '#1B2A3B' }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Quadro Resumo de Parâmetros da Página 7 (Equação tipo = s = B*Q+CQ²) */}
              <div className="rounded-xl border-2 border-[#1B2A3B] p-4 bg-[#F7F9FC] dark:bg-slate-950 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div className="space-y-2 font-mono">
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">
                      Equação tipo =
                    </span>
                    <span className="font-bold">s = B*Q + C*Q²</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">B =</span>
                    <span>{fmtNumeroSEMA(resultado.coeficienteB, 4)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">B(24h) =</span>
                    <span>{fmtNumeroSEMA(resultado.coeficienteB24h, 4)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">C =</span>
                    <span>{fmtNumeroSEMA(resultado.coeficienteC, 5)}</span>
                  </div>
                </div>

                <div className="space-y-2 font-mono">
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">
                      Q/s (m³/h/m) =
                    </span>
                    <span className="font-bold">
                      {fmtNumeroSEMA(resultado.qPorSFinal, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">
                      s/Q (m/m³/h) =
                    </span>
                    <span className="font-bold">
                      {fmtNumeroSEMA(resultado.sPorQFinal, 4)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">
                      Eficiência (BQ/(BQ+CQ²)*100) =
                    </span>
                    <span className="font-bold text-[#27AE60]">
                      {fmtNumeroSEMA(resultado.eficienciaUltimaEtapaPct, 1, '%')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-300 dark:border-slate-800 pb-1">
                    <span className="font-bold text-[#6B7A8D]">
                      T (m²/dia) =
                    </span>
                    <span>
                      {fmtNumeroSEMA(resultado.transmissividadeM2Dia, 2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Diagnóstico Técnico */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                  resultado.classificacaoEficiencia.cor === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200'
                    : resultado.classificacaoEficiencia.cor === 'amber'
                    ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200'
                    : 'border-red-300 bg-red-50/70 dark:bg-red-950/30 text-red-900 dark:text-red-200'
                }`}
              >
                {resultado.classificacaoEficiencia.cor === 'emerald' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">
                    {resultado.classificacaoEficiencia.rotulo}
                  </div>
                  <p className="mt-0.5 opacity-90">
                    {resultado.classificacaoEficiencia.parecerTecnico}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
