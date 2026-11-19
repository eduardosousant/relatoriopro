import { RelatorioTecnico } from '../types/relatorio';
import {
  calcularParametrosStepDrawdownSEMA,
  fmtNumeroSEMA,
  parseNumeroSEMA,
} from '../components/StepDrawdownSection';
import {
  extrairCoordenadasGeograficas,
  latLngParaUTM,
} from './coordenadasParser';

export type StatusAuditoriaRelatorio =
  | 'APROVADO'
  | 'BLOQUEADO_INCONSISTENCIA'
  | 'DADOS_INSUFICIENTES';

export interface ClassificacaoEnsaioNormativo {
  duracaoSelecionadaHoras: number;
  enquadramentoNormativo: string;
  variacaoNDHorasFinais_m_h: number;
  estabilizacaoAtingida: boolean;
  justificativaTecnicaDuracao: string;
}

export interface ItemChecklistAuditadoIA {
  item: string;
  status: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
  observacao: string;
}

export interface RelatorioSecoesEstruturadasIA {
  '1_identificacaoLocal': string;
  '2_dadosContratuaisRT': string;
  '3_geometriaConstrutivaPoco': string;
  '4_servicosManutencaoExecutados': string;
  '5_testeVazaoMetodologia': string;
  '6_interpretacaoHidrogeologicaJacobRorabaugh': string;
  '7_parecerVazaoRecomendada': string;
  '8_checklistConformidadeSeguranca': ItemChecklistAuditadoIA[];
  '9_listaAnexosObrigatorios': string[];
}

export interface ResultadoAuditoriaRelatorio {
  statusAuditoria: StatusAuditoriaRelatorio;
  alertasBloqueio: string[];
  classificacaoEnsaio: ClassificacaoEnsaioNormativo;
  relatorioSecoes?: RelatorioSecoesEstruturadasIA;
  coeficientesCalculados?: {
    B_h_m2: number | null;
    C_h2_m5: number | null;
    equacaoGeral: string;
    equacaoLinearizada: string;
  };
}

/**
 * Extrai a duração declarada do ensaio em horas (12, 24, 48 ou 72h)
 */
export function extrairDuracaoEnsaioHoras(relatorio: RelatorioTecnico): number {
  const teste = relatorio.dadosPoco?.testeVazaoSEMA;
  const label = (
    teste?.etapaLabel ||
    teste?.tipoEnsaio ||
    relatorio.cabecalho?.tipoServico ||
    ''
  ).toUpperCase();

  if (label.includes('72')) return 72;
  if (label.includes('48')) return 48;
  if (label.includes('36')) return 36;
  if (label.includes('24')) return 24;
  if (label.includes('12')) return 12;
  if (/\b6\s*H\b/.test(label) || label.trim() === '6H') return 6;

  const leituras = teste?.leiturasBombeamento || [];
  if (leituras.length > 0) {
    const maxMin = Math.max(...leituras.map((l) => l.tMin || 0));
    if (maxMin >= 4320) return 72;
    if (maxMin >= 2880) return 48;
    if (maxMin >= 2160) return 36;
    if (maxMin >= 1440) return 24;
    if (maxMin >= 720) return 12;
    if (maxMin >= 360) return 6;
  }

  return 24;
}

/**
 * Calcula a variação de ND (m/h) nas horas finais da planilha de bombeamento
 */
export function calcularVariacaoNDHorasFinais(
  relatorio: RelatorioTecnico,
  horasJanelaFinal = 6
): { variacao_m_h: number; estabilizado: boolean; temLeiturasSuficientes: boolean } {
  const leituras = (relatorio.dadosPoco?.testeVazaoSEMA?.leiturasBombeamento || [])
    .map((l) => ({
      tMin: l.tMin,
      nd: parseNumeroSEMA(l.ndM),
    }))
    .filter((l): l is { tMin: number; nd: number } => l.nd !== null && l.tMin > 0)
    .sort((a, b) => a.tMin - b.tMin);

  if (leituras.length < 3) {
    return {
      variacao_m_h: 0,
      estabilizado: true,
      temLeiturasSuficientes: false,
    };
  }

  const ultima = leituras[leituras.length - 1];
  const janelaMin = horasJanelaFinal * 60;
  const tCorte = Math.max(ultima.tMin - janelaMin, Math.floor(ultima.tMin * 0.5));

  // Busca a leitura mais próxima de tCorte (ou as últimas 4 leituras se o teste for curto em minutos)
  const candidatas = leituras.filter((l) => l.tMin >= tCorte);
  const primeiraJanela =
    candidatas.length >= 2
      ? candidatas[0]
      : leituras[Math.max(0, leituras.length - 4)];

  const deltaT_h = Math.max(0.25, (ultima.tMin - primeiraJanela.tMin) / 60);
  const deltaND_m = Math.abs(ultima.nd - primeiraJanela.nd);
  const variacao_m_h = Number((deltaND_m / deltaT_h).toFixed(3));

  return {
    variacao_m_h,
    estabilizado: variacao_m_h <= 0.1,
    temLeiturasSuficientes: true,
  };
}

/**
 * Verifica se as coordenadas geográficas são grosseiramente incompatíveis com a UF informada
 */
function verificarConsistenciaCoordenadasUF(
  lat: number,
  lng: number,
  cidadeUF?: string
): string | null {
  if (!cidadeUF) return null;
  const upper = cidadeUF.toUpperCase();

  // Faixas aproximadas para detectar erro clássico (ex.: coordenadas de Ribeirão Preto/SP em poço de MT)
  if (
    (/\bMT\b/.test(upper) || upper.includes('MATO GROSSO')) &&
    !upper.includes('SUL')
  ) {
    if (lat < -18.5 || lat > -7.0 || lng < -62.0 || lng > -50.0) {
      return `Trava 6 (Georreferenciamento): Coordenadas informadas (Lat ${lat.toFixed(
        4
      )}°, Lng ${lng.toFixed(
        4
      )}°) estão fora dos limites geográficos do estado de Mato Grosso (${cidadeUF}).`;
    }
  }

  if (/\bSP\b/.test(upper) || upper.includes('SAO PAULO') || upper.includes('SÃO PAULO')) {
    if (lat > -19.5 || lat < -25.5 || lng < -53.5 || lng > -44.0) {
      return `Trava 6 (Georreferenciamento): Coordenadas informadas (Lat ${lat.toFixed(
        4
      )}°, Lng ${lng.toFixed(
        4
      )}°) estão fora dos limites geográficos de São Paulo (${cidadeUF}).`;
    }
  }

  return null;
}

/**
 * Executa as 8 Travas de Consistência e Auditoria (ABNT NBR 12.212 / NBR 12.244 / SEMA-MT)
 * de forma determinística e instantânea no frontend antes de liberar a emissão ou chamar a IA.
 */
export function executarAuditoriaDeterministicaRelatorio(
  relatorio: RelatorioTecnico
): ResultadoAuditoriaRelatorio {
  const alertasBloqueio: string[] = [];
  let possuiDadosInsuficientes = false;

  const dp = relatorio.dadosPoco;
  const cab = relatorio.cabecalho;
  const teste = dp?.testeVazaoSEMA;

  const profTotal = parseNumeroSEMA(dp?.profundidadeTotal);
  const profBomba = parseNumeroSEMA(dp?.crivo);
  const ne = parseNumeroSEMA(dp?.nivelEstatico);
  const nd = parseNumeroSEMA(dp?.nivelDinamico);
  const vazaoOperacao = parseNumeroSEMA(dp?.vazaoTeste);
  const vazaoRecomendada = parseNumeroSEMA(teste?.vazaoOutorgaRecomendadaM3h);

  const calc = calcularParametrosStepDrawdownSEMA(dp?.nivelEstatico, teste);
  const duracaoHoras = extrairDuracaoEnsaioHoras(relatorio);
  const janelaEstabHoras = duracaoHoras === 24 ? 4 : 6;
  const analiseEstab = calcularVariacaoNDHorasFinais(relatorio, janelaEstabHoras);

  // TRAVA 8: Ausência de parâmetros obrigatórios (NE, ND, Profundidade, Vazão)
  const camposAusentes: string[] = [];
  if (ne === null || ne <= 0) camposAusentes.push('Nível Estático (NE)');
  if (nd === null || nd <= 0) camposAusentes.push('Nível Dinâmico (ND)');
  if (profTotal === null || profTotal <= 0)
    camposAusentes.push('Profundidade Total do Poço');
  if (vazaoOperacao === null || vazaoOperacao <= 0)
    camposAusentes.push('Vazão de Operação/Teste (Q)');

  if (camposAusentes.length > 0) {
    possuiDadosInsuficientes = true;
    alertasBloqueio.push(
      `Trava 8 (Parâmetros Obrigatórios Ausentes): Preencha os dados essenciais de campo antes de emitir o laudo: ${camposAusentes.join(
        ', '
      )}.`
    );
  }

  // TRAVA 1: Geometria incoerente
  if (profBomba !== null && profTotal !== null && profBomba > profTotal) {
    alertasBloqueio.push(
      `Trava 1 (Geometria Incoerente): Profundidade de instalação da bomba (${fmtNumeroSEMA(
        profBomba,
        2
      )} m) é maior que a Profundidade Total do poço (${fmtNumeroSEMA(
        profTotal,
        2
      )} m).`
    );
  }

  if (nd !== null && profBomba !== null && nd > profBomba) {
    alertasBloqueio.push(
      `Trava 1 (Risco de Operação a Seco / Cavitação): O Nível Dinâmico (${fmtNumeroSEMA(
        nd,
        2
      )} m) está abaixo da profundidade de instalação da motobomba (${fmtNumeroSEMA(
        profBomba,
        2
      )} m). A bomba deve operar sempre submersa abaixo do ND.`
    );
  }

  if (ne !== null && nd !== null && nd < ne) {
    alertasBloqueio.push(
      `Trava 1 (Hidrodinâmica Incoerente): O Nível Dinâmico (${fmtNumeroSEMA(
        nd,
        2
      )} m) está mais raso que o Nível Estático (${fmtNumeroSEMA(
        ne,
        2
      )} m). O bombeamento obrigatoriamente provoca rebaixamento positivo (ND ≥ NE).`
    );
  }

  // TRAVA 2 e TRAVA 3: Regras de decisão do Teste de Vazão (12h vs 24h vs 48h vs 72h)
  if (teste?.ativo) {
    const qRef = vazaoOperacao ?? calc.vazaoEstabilizadaFinalM3h ?? 0;

    if (duracaoHoras === 12 && qRef >= 5.0) {
      alertasBloqueio.push(
        `Trava 2 (Divergência Normativa de Duração — NBR 12.244): Foi declarado ensaio de 12 horas, porém a vazão de operação Q = ${fmtNumeroSEMA(
          qRef,
          2
        )} m³/h é ≥ 5,00 m³/h (5.000 L/h). O teste de 12 h é exclusivo para Q < 5,0 m³/h em poços já outorgados; exija ensaio de 24 horas.`
      );
    }

    if (duracaoHoras === 12) {
      if (!analiseEstab.temLeiturasSuficientes) {
        alertasBloqueio.push(
          `Trava 3 (Teste de 12 h sem Comprovação Numérica): O ensaio de 12 horas exige comprovação de estabilização do ND nas 6 horas finais (variação ≤ 0,10 m/h) na planilha de leituras.`
        );
      } else if (!analiseEstab.estabilizado) {
        alertasBloqueio.push(
          `Trava 3 (Falha de Estabilização no Teste de 12 h): A variação do ND nas horas finais foi de ${fmtNumeroSEMA(
            analiseEstab.variacao_m_h,
            3
          )} m/h (> limite de 0,10 m/h). Recomenda-se prolongamento imediato do ensaio para 24 horas.`
        );
      }
    }

    if (duracaoHoras === 24 && analiseEstab.temLeiturasSuficientes && !analiseEstab.estabilizado) {
      alertasBloqueio.push(
        `Trava 2 (Ausência de Estabilização em 24 h): Variação residual de ${fmtNumeroSEMA(
          analiseEstab.variacao_m_h,
          3
        )} m/h nas 4 horas finais (> 0,10 m/h). Recomenda-se redução de 20% na vazão e prolongamento por +12 h (36 h) ou ensaio de 48 h.`
      );
    }

    // TRAVA 4: Ensaio escalonado com etapas incompletas
    if (teste.tipoEnsaio.includes('Escalonado')) {
      const etapasInvalidas = (teste.etapas || []).filter(
        (et) =>
          parseNumeroSEMA(et.vazaoM3h) === null ||
          parseNumeroSEMA(et.nivelDinamicoM) === null ||
          (ne !== null && (parseNumeroSEMA(et.nivelDinamicoM) ?? 0) <= ne)
      );
      if ((teste.etapas || []).length < 2 || etapasInvalidas.length > 0) {
        alertasBloqueio.push(
          `Trava 4 (Ensaio Escalonado Incompleto): O ensaio Step-Drawdown possui etapas sem vazão (Q) ou sem Nível Dinâmico (ND > NE) devidamente preenchidos.`
        );
      }
    }

    // TRAVA 7: Vazão "Depois da manutenção" divergente da vazão recomendada sem justificativa
    if (
      vazaoOperacao !== null &&
      vazaoRecomendada !== null &&
      vazaoOperacao > 0 &&
      vazaoRecomendada > 0
    ) {
      const diffRelativa =
        Math.abs(vazaoOperacao - vazaoRecomendada) /
        Math.max(vazaoOperacao, vazaoRecomendada);
      const temJustificativaNoParecer = Boolean(
        dp?.parecerHidrogeologico && dp.parecerHidrogeologico.trim().length > 40
      );
      if (diffRelativa > 0.15 && !temJustificativaNoParecer) {
        alertasBloqueio.push(
          `Trava 7 (Divergência de Vazão sem Justificativa): A vazão operacional medida após a manutenção (${fmtNumeroSEMA(
            vazaoOperacao,
            2
          )} m³/h) diverge em mais de 15% da vazão de outorga recomendada (${fmtNumeroSEMA(
            vazaoRecomendada,
            2
          )} m³/h) sem justificativa técnica descrita no parecer.`
        );
      }
    }
  }

  // TRAVA 5: Contradição entre Checklist de Segurança e Anotações/Carimbo de Campo
  const obsCampoUpper = (
    (relatorio.ocorrenciasCampo?.observacoesGerais || '') +
    ' ' +
    (relatorio.ocorrenciasCampo?.ocorrencias || '') +
    ' ' +
    (relatorio.ocorrenciasCampo?.pendencias || '')
  ).toUpperCase();

  const carimboAterramentoNao =
    /ATERRAMENTO\s*[:=-]?\s*(N[ÃA]O|AUSENTE|INEXISTENTE|SEM\b)/i.test(
      obsCampoUpper
    );
  const checklistAterramentoConforme = (relatorio.checklist || []).some(
    (c) =>
      c.concluido &&
      c.texto.toUpperCase().includes('ATERRAMENTO') &&
      !(c.observacao || '').toUpperCase().includes('NÃO')
  );

  if (carimboAterramentoNao && checklistAterramentoConforme) {
    alertasBloqueio.push(
      `Trava 5 (Contradição de Segurança Elétrica): O carimbo/observação de campo registra "Aterramento: Não", mas o Checklist de Conformidade marca o Aterramento como "CONFORME". Corrija o checklist ou a observação antes de emitir.`
    );
  }

  const carimboCavaleteNao =
    /CAVALETE\s*[:=-]?\s*(N[ÃA]O|AUSENTE|INEXISTENTE|SEM\b)/i.test(
      obsCampoUpper
    );
  const checklistCavaleteConforme = (relatorio.checklist || []).some(
    (c) =>
      c.concluido &&
      (c.texto.toUpperCase().includes('CAVALETE') ||
        c.texto.toUpperCase().includes('HIDRÔMETRO')) &&
      !(c.observacao || '').toUpperCase().includes('NÃO')
  );

  if (carimboCavaleteNao && checklistCavaleteConforme) {
    alertasBloqueio.push(
      `Trava 5 (Contradição de Cavalete/Hidrômetro): As anotações de campo registram ausência de cavalete, mas o Checklist de Conformidade o declara como "CONFORME".`
    );
  }

  // TRAVA 6: Coordenadas Geográficas incompatíveis com Município/UF
  const coordExtraida = extrairCoordenadasGeograficas(
    dp?.coordenadasGeograficas,
    cab?.coordenadasGeograficas
  );
  if (coordExtraida) {
    const erroUF = verificarConsistenciaCoordenadasUF(
      coordExtraida.lat,
      coordExtraida.lng,
      cab?.cidadeUF
    );
    if (erroUF) {
      alertasBloqueio.push(erroUF);
    }
  }

  // Monta classificação normativa do ensaio
  const qFinal = vazaoOperacao ?? calc.vazaoEstabilizadaFinalM3h ?? 0;
  let enquadramentoNormativo = 'Ensaio de Bombeamento ABNT NBR 12.244';
  let justificativaTecnicaDuracao = '';

  if (!teste?.ativo) {
    enquadramentoNormativo =
      'Aferição Operacional de Manutenção Preventiva (Poço Outorgado)';
    justificativaTecnicaDuracao =
      qFinal > 0 && qFinal < 5.0
        ? `Poço já outorgado em manutenção preventiva com vazão operacional Q = ${fmtNumeroSEMA(
            qFinal,
            2
          )} m³/h (< 5,0 m³/h), enquadrado em aferição hidrodinâmica de manutenção.`
        : `Aferição operacional de nível estático, nível dinâmico e vazão pós-manutenção preventiva conforme NBR 12.244.`;
  } else if (duracaoHoras === 12) {
    enquadramentoNormativo =
      'Teste de 12 Horas — Manutenção Preventiva em Poço Outorgado (Q < 5,0 m³/h)';
    justificativaTecnicaDuracao = `Aplicável exclusivamente a poço já outorgado em manutenção preventiva com Q = ${fmtNumeroSEMA(
      qFinal,
      2
    )} m³/h (< 5,0 m³/h) e variação de ND de ${fmtNumeroSEMA(
      analiseEstab.variacao_m_h,
      3
    )} m/h nas 6 horas finais (critério ≤ 0,10 m/h).`;
  } else if (duracaoHoras === 48) {
    enquadramentoNormativo =
      'Teste Contínuo de 48 Horas — Exigência de Órgão Gestor / Estabilização Prolongada';
    justificativaTecnicaDuracao = `Ensaio de 48 horas conduzido a vazão constante (Q = ${fmtNumeroSEMA(
      qFinal,
      2
    )} m³/h) com verificação de estabilização do ND nas 6 horas finais.`;
  } else if (duracaoHoras === 72) {
    enquadramentoNormativo =
      'Teste Especial de 72 Horas — Aquífero de Estabilização Lenta / Operação Contínua';
    justificativaTecnicaDuracao = `Ensaio de 72 horas especificado para aquífero fraturado/baixa condutividade ou comprovação de operação contínua do conjunto motobomba instalado.`;
  } else {
    enquadramentoNormativo =
      'Teste Padrão de 24 Horas — Regra Geral ABNT NBR 12.244';
    justificativaTecnicaDuracao = `Ensaio contínuo de 24 horas conforme ABNT NBR 12.244 (obrigatório para Q ≥ 5,0 m³/h ou padrão de outorga), com estabilização do ND nas 4 horas finais (variação medida: ${fmtNumeroSEMA(
      analiseEstab.variacao_m_h,
      3
    )} m/h).`;
  }

  const coefB = calc.coeficienteB;
  const coefC = calc.coeficienteC;
  const bStr = coefB !== null ? fmtNumeroSEMA(coefB, 4) : 'B';
  const cStr = coefC !== null ? fmtNumeroSEMA(coefC, 5) : 'C';

  let statusAuditoria: StatusAuditoriaRelatorio = 'APROVADO';
  if (alertasBloqueio.length > 0) {
    statusAuditoria =
      possuiDadosInsuficientes && alertasBloqueio.length === 1
        ? 'DADOS_INSUFICIENTES'
        : 'BLOQUEADO_INCONSISTENCIA';
  }

  return {
    statusAuditoria,
    alertasBloqueio,
    classificacaoEnsaio: {
      duracaoSelecionadaHoras: duracaoHoras,
      enquadramentoNormativo,
      variacaoNDHorasFinais_m_h: analiseEstab.variacao_m_h,
      estabilizacaoAtingida: analiseEstab.estabilizado,
      justificativaTecnicaDuracao,
    },
    coeficientesCalculados: {
      B_h_m2: coefB,
      C_h2_m5: coefC,
      equacaoGeral: `s = ${bStr}·Q + ${cStr}·Q² (s em m; Q em m³/h; B em h/m²; C em h²/m⁵)`,
      equacaoLinearizada: `s/Q = ${bStr} + ${cStr}·Q`,
    },
  };
}

/**
 * Monta o payload estruturado com os parâmetros do relatório e os coeficientes B e C
 * já calculados em TypeScript para enviar à rota POST /api/gerar-parecer-hidrogeologico
 */
export function montarPayloadParecerHidrogeologico(relatorio: RelatorioTecnico) {
  const dp = relatorio.dadosPoco;
  const cab = relatorio.cabecalho;
  const teste = dp?.testeVazaoSEMA;
  const calc = calcularParametrosStepDrawdownSEMA(dp?.nivelEstatico, teste);
  const auditoriaLocal = executarAuditoriaDeterministicaRelatorio(relatorio);

  const coordExtraida = extrairCoordenadasGeograficas(
    dp?.coordenadasGeograficas,
    cab?.coordenadasGeograficas
  );
  const utmCalc = coordExtraida
    ? latLngParaUTM(coordExtraida.lat, coordExtraida.lng)
    : null;
  const coordenadasFormatadas =
    dp?.coordenadasUTM && !dp.coordenadasUTM.includes('DADO A PREENCHER')
      ? `${dp.coordenadasUTM} (${dp?.coordenadasGeograficas || cab?.coordenadasGeograficas || ''})`
      : utmCalc
      ? `${utmCalc.zona}${utmCalc.banda} E:${utmCalc.easting} N:${utmCalc.northing} (${coordExtraida?.lat.toFixed(
          5
        )}°, ${coordExtraida?.lng.toFixed(5)}°)`
      : dp?.coordenadasGeograficas || cab?.coordenadasGeograficas || 'Não informado';

  const etapasResumo =
    (teste?.etapas || []).length > 0
      ? teste!.etapas
          .map(
            (et) =>
              `Etapa ${et.etapa} (${et.duracaoMinutos} min): Q = ${et.vazaoM3h} m³/h | ND = ${et.nivelDinamicoM} m`
          )
          .join(' ; ')
      : 'Sem etapas escalonadas cadastradas';

  const leiturasBombResumo =
    (teste?.leiturasBombeamento || []).length > 0
      ? teste!.leiturasBombeamento!
          .filter((_, idx, arr) => idx < 5 || idx >= arr.length - 6)
          .map((l) => `t=${l.tMin}min: ND=${l.ndM}m, Q=${l.vazaoM3h}m³/h`)
          .join(' | ')
      : 'Leituras contínuas não preenchidas na planilha';

  const listaServicosMateriais = [
    ...(relatorio.servicosConduzidos || [])
      .filter((s) => s.descricao.trim())
      .map((s) => `[Serviço] ${s.descricao} (${s.quantidade} ${s.unidade || 'UN'} - ${s.status})`),
    ...(relatorio.materiaisAplicados || [])
      .filter((m) => m.descricao.trim())
      .map((m) => `[Material] ${m.descricao} (${m.quantidade} ${m.unidade} - ${m.situacao})`),
  ].join('\n  ');

  return {
    cliente: cab.cliente || 'Não informado',
    orgaoGestor: cab.cidadeUF?.toUpperCase().includes('GO')
      ? 'SANEAGO / SEMAD-GO'
      : 'SEMA-MT / ANA',
    cidadeUF: cab.cidadeUF || 'Não informado',
    coordenadas: coordenadasFormatadas,
    numeroOS: cab.contratoOS || 'Não informado',
    contrato: cab.contratoRef || 'Não informado',
    responsavelTecnico: `${cab.responsavelTecnicoNome || 'José Roberto Ribeiro'} (${
      cab.responsavelTecnicoCREA || 'CREA MT1561'
    })`,
    pocoTag: dp.pocoId || 'PT-01',
    diametro: dp.diametroRevestimento || 'Não informado',
    profundidadeTotal: dp.profundidadeTotal || 'Não informado',
    crivo:
      dp.crivoInicial && dp.crivoInicial.trim() && dp.crivoInicial !== dp.crivo
        ? `Antes: ${dp.crivoInicial} | Depois: ${dp.crivo || 'Não informado'}`
        : dp.crivo || dp.crivoInicial || 'Não informado',
    tuboEdutor: dp.tuboEdutor || 'Não informado',
    motobomba: `${dp.especificacaoBomba || 'Não informado'} (${dp.motobombaEstado || 'Usado'})`,
    profundidadeBomba: dp.crivo || dp.crivoInicial || 'Não informado',
    painel: `${dp.painelEletrico || 'Não informado'} (${dp.painelEstado || 'Usado'})`,
    aterramento:
      relatorio.ocorrenciasCampo?.observacoesGerais?.match(
        /Aterramento\s*:\s*([^|\n]+)/i
      )?.[1]?.trim() || 'Verificado em checklist',
    cavalete:
      relatorio.ocorrenciasCampo?.observacoesGerais?.match(
        /Cavalete\s*:\s*([^|\n]+)/i
      )?.[1]?.trim() || 'Verificado em checklist',
    neAntes: dp.nivelEstaticoInicial || dp.nivelEstatico || 'Não informado',
    neDepois: dp.nivelEstatico || dp.nivelEstaticoInicial || 'Não informado',
    ndAntes: dp.nivelDinamicoInicial || dp.nivelDinamico || 'Não informado',
    ndDepois: dp.nivelDinamico || dp.nivelDinamicoInicial || 'Não informado',
    vazaoAntes: dp.vazaoInicial || dp.vazaoTeste || 'Não informado',
    vazaoDepois: dp.vazaoTeste || dp.vazaoInicial || 'Não informado',
    duracaoTeste: String(auditoriaLocal.classificacaoEnsaio.duracaoSelecionadaHoras),
    testeAtivo: Boolean(teste?.ativo),
    dadosPlanilhaCampo: `Tipo: ${teste?.tipoEnsaio || 'Manutenção Preventiva'} | Variação ND horas finais: ${fmtNumeroSEMA(
      auditoriaLocal.classificacaoEnsaio.variacaoNDHorasFinais_m_h,
      3
    )} m/h | Coeficientes Jacob-Rorabaugh pré-calculados por regressão linear: B = ${
      calc.coeficienteB !== null ? fmtNumeroSEMA(calc.coeficienteB, 4) : 'N/A'
    } h/m², C = ${
      calc.coeficienteC !== null ? fmtNumeroSEMA(calc.coeficienteC, 5) : 'N/A'
    } h²/m⁵, Transmissividade Cooper-Jacob T = ${
      calc.transmissividadeM2Dia !== null
        ? fmtNumeroSEMA(calc.transmissividadeM2Dia, 2)
        : 'N/A'
    } m²/dia | Escalões: ${etapasResumo} | Amostra Leituras: ${leiturasBombResumo}`,
    listaServicosMateriais:
      listaServicosMateriais || relatorio.descricaoServico || 'Serviços de manutenção preventiva.',
    observacoesCampo:
      relatorio.ocorrenciasCampo?.observacoesGerais ||
      relatorio.ocorrenciasCampo?.recomendacoes ||
      '',
    checklistAtual: (relatorio.checklist || []).map((c) => ({
      texto: c.texto,
      concluido: c.concluido,
      observacao: c.observacao || '',
    })),
    auditoriaLocalPrevia: auditoriaLocal,
  };
}
