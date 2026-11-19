import {
  RelatorioTecnico,
  TemplateServico,
  DadosCabecalho,
  ItemChecklistConformidade,
  CadastroPoco,
} from '../types/relatorio';

export const CABECALHO_INSTITUCIONAL_PADRAO: Pick<
  DadosCabecalho,
  | 'razaoSocial'
  | 'cnpj'
  | 'enderecoEmpresa'
  | 'cidadeContatoEmpresa'
  | 'emailEmpresa'
> = {
  razaoSocial: 'Parecis Perfuração de Poços e Sondagens Ltda',
  cnpj: '31.386.206/0001-25',
  enderecoEmpresa: 'End. Av. Los Angeles, 269 – Bairro Jardim Califórnia',
  cidadeContatoEmpresa:
    'Sorriso-MT / CEP 78894-183 / Fone: (65) 3624-1389 Celular: (65) 99972-3112',
  emailEmpresa: 'diretoria.geo@geoeste.com.br',
};

export const TIPOS_SERVICO_PADRAO = [
  'Manutenção Preventiva',
  'Manutenção Corretiva',
  'Manutenção Conjunto-Motobomba',
  'Limpeza Completa de Poço',
  'Perfuração de Poço Tubular',
  'Teste de Vazão / Bombeamento',
  'Sondagem SPT / Geotecnia',
] as const;

export type TipoServicoPadrao = (typeof TIPOS_SERVICO_PADRAO)[number];

function normalizarTextoSimples(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Mapeia qualquer texto livre ou extraído de PDF para uma das 7 opções oficiais
 * de Tipo de Serviço cadastradas em Identificação do Serviço.
 */
export function normalizarTipoServico(
  textoBruto?: string | null,
  fallback: string = 'Manutenção Preventiva'
): string {
  const limpo = (textoBruto || '').trim();
  if (!limpo) return fallback;

  const norm = normalizarTextoSimples(limpo);

  // 1. Correspondência exata (ignorando maiúsculas/acentos)
  const exata = TIPOS_SERVICO_PADRAO.find(
    (op) => normalizarTextoSimples(op) === norm
  );
  if (exata) return exata;

  // 2. Mapeamento semântico por palavras-chave técnicas
  if (/\b(spt|sondagem|geotecni|ensaios?\s+geotecni)/.test(norm)) {
    return 'Sondagem SPT / Geotecnia';
  }
  if (/(perfurac|perfurar|poco\s+novo|abertura\s+de\s+poco)/.test(norm)) {
    return 'Perfuração de Poço Tubular';
  }
  if (/(teste\s+de\s+vazao|bombeamento|ensaio\s+de\s+vazao|curva\s+caracteristica|sema)/.test(norm)) {
    return 'Teste de Vazão / Bombeamento';
  }
  if (/(limpeza|air[\s-]?lift|desinfecc|clorac|desenvolvimento\s+de\s+poco|compresso)/.test(norm)) {
    return 'Limpeza Completa de Poço';
  }
  if (
    /(motobomba|conjunto[\s-]?bomba|submersa|troca\s+de\s+bomba|substituic.*bomba|instalac.*bomba|retirada.*bomba|i[cç]amento|bomba)/.test(
      norm
    ) &&
    !norm.includes('preventiva')
  ) {
    return 'Manutenção Conjunto-Motobomba';
  }
  if (/(corretiv|emergenc|reparo|conserto|defeito|quebra|falha|queimad)/.test(norm)) {
    return 'Manutenção Corretiva';
  }
  if (/(preventiv|manutenc|inspec|revisao|avaliacao|poco\s+artesiano|poco\s+tubular)/.test(norm)) {
    return 'Manutenção Preventiva';
  }

  return fallback;
}

export const CHECKLIST_PADRAO_ITENS: {
  texto: string;
  observacao: string;
}[] = [
  {
    texto: 'Uso completo dos Equipamentos de Proteção Individual (EPIs)',
    observacao:
      'CONFORME — Equipe técnica integralmente equipada (NR-06 / NR-18).',
  },
  {
    texto: 'Sinalização e isolamento do perímetro de trabalho',
    observacao:
      'CONFORME — Perímetro de operação e boca do poço sinalizados e isolados.',
  },
  {
    texto: 'Verificação de aterramento e isolamento do painel elétrico',
    observacao:
      'CONFORME — Isolação ôhmica aferida e aterramento do quadro elétrico validado.',
  },
  {
    texto: 'Vedação hermética e proteção sanitária da boca do poço',
    observacao:
      'CONFORME — Proteção sanitária e vedação da boca do poço verificadas (NBR 12244).',
  },
  {
    texto: 'Limpeza, recolhimento e destinação adequada de resíduos e insumos',
    observacao:
      'CONFORME — Área desmobilizada e limpa, sem passivos ambientais.',
  },
];

export function criarChecklistPadrao(
  marcarTodos = true
): ItemChecklistConformidade[] {
  const hoje = new Date().toLocaleDateString('pt-BR');
  return CHECKLIST_PADRAO_ITENS.map((item, idx) => ({
    id: `chk_${idx}`,
    texto: item.texto,
    concluido: marcarTodos,
    dataVerificacao: hoje,
    observacao: item.observacao,
  }));
}

export const TEMPLATES_SERVICO: TemplateServico[] = [
  {
    id: 'manutencao-preventiva-completa',
    titulo: 'Manutenção Preventiva: Limpeza Air-Lift, Teste e Análise de Água',
    categoria: 'Preventiva',
    conteudo: `1. TRANSPORTE E MOBILIZAÇÃO DE EQUIPAMENTOS
Mobilização de equipe técnica operacional e equipamentos especializados até o poço tubular profundo, incluindo caminhão guincho/munk, compressor de ar de alta pressão (mín. 750 CFM / 250 PSI), tubulação auxiliar de injeção, coluna edutora e instrumentos de calibração metrológica. Isolamento e sinalização da área de intervenção.

2. LIMPEZA E DESENVOLVIMENTO COM COMPRESSOR DE AR (AIR-LIFT)
Execução dos serviços de limpeza interna da coluna de revestimento e desobstrução mecânica das seções filtrantes/fraturas aquíferas pelo método de injeção contínua e intermitente de ar comprimido (Air-Lift). Foram efetuados ciclos de pistoneamento pneumático para arraste e remoção completa de finos, decantação de incrustações e decréscimo de turbidez, até que a água bombeada apresentasse aspecto 100% límpido, sem arraste de areia ou material particulado em suspensão (ABNT NBR 12212 / NBR 12244).

3. DESINFECÇÃO COM PRODUTO QUÍMICO
Tratamento químico e choque oxidante com aplicação de solução bactericida e desincrustante (hipoclorito de sódio em dosagem técnica controlada) introduzida ao longo de toda a coluna de água do poço, garantindo a desinfecção microbiológica, eliminação de biofilmes bacterianos, controle de ferrobactérias e higienização do aquífero com o tempo de contato técnico mínimo normativo antes do expurgo.

4. TESTE DE VAZÃO COM MEDIÇÃO DE NÍVEL DINÂMICO, ESTÁTICO E ENSAIO DE RECUPERAÇÃO
Execução de ensaio hidrodinâmico de bombeamento para avaliação da vazão sustentável e comportamento operacional:
- Aferição prévia do Nível Estático (NE) estabilizado;
- Bombeamento com acompanhamento da vazão contínua (Q em m³/h) através de hidrômetro/cavalete de medição calibrado;
- Monitoramento sistemático do rebaixamento da lâmina d'água até a estabilização do Nível Dinâmico (ND);
- Ensaio de recuperação residual imediatamente após o corte do bombeamento, cronometrando a curva de ascensão do nível (s') até o reequilíbrio das condições piezométricas do poço.

5. COLETA DE AMOSTRA PARA ANÁLISE FÍSICO-QUÍMICA E BACTERIOLÓGICA DA ÁGUA
Realizada coleta criteriosa e asséptica de amostra de água na saída do cavalete do poço, após o expurgo completo do residual de cloro e estabilização dos parâmetros organolépticos. Acondicionamento em caixas térmicas refrigeradas e envio a laboratório credenciado para ensaios físico-químicos e bacteriológicos (coliformes totais e Escherichia coli) de potabilidade, atendendo rigorosamente aos parâmetros da Portaria GM/MS nº 888/2021.`,
  },
  {
    id: 'entrega-poco-nbr12244',
    titulo: 'Entrega Técnica de Poço e Teste 24h (NBR 12212 / 12244)',
    categoria: 'Hidrogeologia',
    conteudo: `1. OBJETIVO DO SERVIÇO\nConclusão da perfuração de Poço Tubular Profundo, desenvolvimento pneumático por Air-Lift, execução de Teste de Bombeamento Contínuo de 24 horas a vazão constante conforme ABNT NBR 12212 e ABNT NBR 12244, seguido de instalação definitiva do conjunto motobomba submerso e comissionamento elétrico.\n\n2. PROCEDIMENTOS DE PERFURAÇÃO E CONSTRUÇÃO\n- Perfuração rotopneumática finalizada conforme projeto construtivo, com revestimento adequado e proteção sanitária;\n- Aplicação de cimentação sanitária contínua no espaço anelar superior e execução de laje de proteção sanitária em concreto armado.\n\n3. DESENVOLVIMENTO AIR-LIFT E TESTE DE BOMBEAMENTO CONTÍNUO (24H)\n- Desenvolvimento completo por injeção de ar comprimido (Air-Lift) até total ausência de partículas em suspensão e turbidez;\n- Teste de bombeamento contínuo de 24 horas a vazão constante com acompanhamento de Nível Estático (NE), Nível Dinâmico (ND), vazão estabilizada e curva de recuperação.\n\n4. INSTALAÇÃO E COMISSIONAMENTO ELETROMECÂNICO\n- Descida do conjunto motobomba submerso com cabeamento submersível apropriado, coluna edutora e comissionamento elétrico completo com verificação de corrente nominal e proteções do painel.`,
  },
  {
    id: 'manutencao-motobomba',
    titulo: 'Manutenção Conjunto-Motobomba',
    categoria: 'Eletromecânica',
    conteudo: `Mobilização de equipe técnica e caminhão guincho até o local do poço. Realizado bloqueio elétrico do painel de comando, desconexão do cabeamento submersível e sacamento da coluna edutora e conjunto motobomba para inspeção em superfície. Efetuada substituição do conjunto motobomba submerso, revisão das emendas vulcanizadas com aferição de isolação ôhmica (megôhmetro), descida controlada acima do topo do crivo e testes operacionais de vazão e corrente elétrica nas três fases.`,
  },
  {
    id: 'limpeza-poco',
    titulo: 'Limpeza Completa de Poço',
    categoria: 'Hidrogeologia',
    conteudo: `Retirada do equipamento de bombeamento existente e descida de tubulação auxiliar de ar comprimido. Aplicação de dispersante químico homologado (polifosfato) e desenvolvimento pneumático por sistema Air-Lift em etapas sucessivas ao longo de toda a seção filtrante até completa remoção de incrustações e clarificação total da água bombeada, seguido de desinfecção com hipoclorito.`,
  },
  {
    id: 'manutencao-preventiva',
    titulo: 'Manutenção Preventiva e Painel',
    categoria: 'Preventiva',
    conteudo: `Inspeção técnica preventiva contemplando aferição dos níveis estático (NE) e dinâmico (ND), medição de vazão no hidrômetro/tubo Pitot, reaperto de conexões bornes no quadro elétrico de comando, aferição de corrente nominal (Amperes) e tensão entre fases (Volts), teste de atuação do relé de nível e relé falta de fase, e verificação das condições sanitárias da laje de proteção.`,
  },
];

let logoGeoesteCache: string | null = null;

/**
 * Gera o logotipo institucional padrão do Grupo Geoeste / Parecis Perfuração de Poços e Sondagens Ltda
 * em PNG DataURL para compatibilidade total com o preview A4 e exportação jsPDF.
 */
export function gerarLogoGeoestePadrao(): string {
  if (logoGeoesteCache) return logoGeoesteCache;
  if (typeof document === 'undefined') return '';

  const canvas = document.createElement('canvas');
  canvas.width = 566;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Fundo transparente
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Emblema institucional (azul marinho profundo)
  ctx.fillStyle = '#0F1E36';
  ctx.beginPath();
  ctx.roundRect(10, 18, 124, 124, 16);
  ctx.fill();

  // Torre de perfuração estilizada
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(46, 110);
  ctx.lineTo(72, 36);
  ctx.lineTo(98, 110);
  ctx.stroke();

  // Travessas e haste central
  ctx.strokeStyle = '#E8A020';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(54, 84);
  ctx.lineTo(90, 84);
  ctx.moveTo(61, 62);
  ctx.lineTo(83, 62);
  ctx.moveTo(72, 36);
  ctx.lineTo(72, 116);
  ctx.stroke();

  // Ondas do aquífero
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(30, 124);
  ctx.quadraticCurveTo(51, 114, 72, 124);
  ctx.quadraticCurveTo(93, 134, 114, 124);
  ctx.stroke();

  // Tipografia institucional Grupo Geoeste / Parecis
  ctx.fillStyle = '#000080';
  ctx.font = 'bold 40px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.fillText('GEOESTE', 152, 68);

  ctx.fillStyle = '#E8A020';
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText('GRUPO GEOESTE · PARECIS', 154, 96);

  ctx.fillStyle = '#475569';
  ctx.font = '600 12.5px "Public Sans", Arial, sans-serif';
  ctx.fillText('PERFURAÇÃO DE POÇOS E SONDAGENS LTDA', 154, 122);

  logoGeoesteCache = canvas.toDataURL('image/png');
  return logoGeoesteCache;
}

export function gerarUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function criarRelatorioEmBranco(
  cabecalhoPadrao?: Partial<DadosCabecalho>,
  pocoVinculado?: CadastroPoco
): RelatorioTecnico {
  const agora = Date.now();
  const dataHoje = new Date().toISOString().split('T')[0];

  return {
    id: agora,
    uuid: gerarUuidV4(),
    clienteUuid: pocoVinculado?.clienteUuid,
    pocoUuid: pocoVinculado?.uuid,
    status: 'rascunho',
    cabecalho: {
      razaoSocial:
        cabecalhoPadrao?.razaoSocial ||
        CABECALHO_INSTITUCIONAL_PADRAO.razaoSocial,
      cnpj: cabecalhoPadrao?.cnpj || CABECALHO_INSTITUCIONAL_PADRAO.cnpj,
      enderecoEmpresa:
        cabecalhoPadrao?.enderecoEmpresa ||
        CABECALHO_INSTITUCIONAL_PADRAO.enderecoEmpresa,
      cidadeContatoEmpresa:
        cabecalhoPadrao?.cidadeContatoEmpresa ||
        CABECALHO_INSTITUCIONAL_PADRAO.cidadeContatoEmpresa,
      emailEmpresa:
        cabecalhoPadrao?.emailEmpresa ||
        CABECALHO_INSTITUCIONAL_PADRAO.emailEmpresa,
      cliente: pocoVinculado?.cliente || '',
      clienteCNPJ: pocoVinculado?.clienteCNPJ || '',
      contratoOS: '',
      contratoRef: '',
      tipoServico: '',
      statusOS: 'Concluído',
      localizacao: pocoVinculado?.enderecoLocal || '',
      cidadeUF: pocoVinculado?.cidadeUF || '',
      coordenadasGeograficas: '',
      contatoLocal: pocoVinculado?.contatoLocal || '',
      telefoneContato: pocoVinculado?.telefoneContato || '',
      dataExecucao: dataHoje,
      logoBase64: cabecalhoPadrao?.logoBase64 || gerarLogoGeoestePadrao(),
    },
    dadosPoco: {
      incluirNoRelatorio: true,
      pocoId: pocoVinculado?.tag || '',
      profundidadeTotal: pocoVinculado?.profundidadeTotal || '',
      diametroRevestimento: pocoVinculado?.diametroRevestimento || '',
      crivoInicial: pocoVinculado?.crivoPadrao || '',
      crivo: pocoVinculado?.crivoPadrao || '',
      profundidadeBomba: '',
      aquiferoLitologia: pocoVinculado?.aquiferoLitologia || '',
      nivelEstaticoInicial: '',
      nivelEstatico: '',
      nivelDinamicoInicial: '',
      nivelDinamico: '',
      vazaoInicial: '',
      vazaoTeste: '',
      tuboEdutor: pocoVinculado?.tuboEdutorPadrao || '',
      eletrodoSuperiorInicial: pocoVinculado?.eletrodoSuperiorPadrao || '',
      eletrodoSuperior: pocoVinculado?.eletrodoSuperiorPadrao || '',
      eletrodoInferiorInicial: pocoVinculado?.eletrodoInferiorPadrao || '',
      eletrodoInferior: pocoVinculado?.eletrodoInferiorPadrao || '',
      coordenadasUTM: pocoVinculado?.coordenadasUTM || '',
      coordenadasGeograficas: '',
      especificacaoBomba: pocoVinculado?.bombaAtual || '',
      motobombaEstado: 'Usado',
      painelEletrico: pocoVinculado?.painelAtual || '',
      painelEstado: 'Usado',
      testeVazaoSEMA: {
        ativo: false,
        tipoEnsaio: 'Contínuo 24h a Vazão Constante',
        etapaLabel: '24H',
        referenciaMedidasM: '0,00',
        responsavelTecnicoNome: 'José Roberto Ribeiro',
        responsavelTecnicoCPF: '',
        responsavelTecnicoCREA: '',
        artNumero: '',
        dataInicioEnsaio: dataHoje,
        horaInicioBombeamento: '08:00:00',
        dataFinalBombeamento: dataHoje,
        horaFinalBombeamento: '18:00:00',
        dataInicioRecuperacao: dataHoje,
        horaInicioRecuperacao: '18:00:00',
        dataFinalRecuperacao: dataHoje,
        horaFinalRecuperacao: '18:35:00',
        tempoRecuperacaoMinutos: '35',
        nivelRecuperacaoFinalM: '',
        vazaoOutorgaRecomendadaM3h: '',
        regimeBombeamentoHorasDia: '16',
        etapas: [],
      },
    },
    descricaoServico: '',
    equipe: [],
    servicosConduzidos: [],
    materiaisAplicados: [],
    checklist: criarChecklistPadrao(true),
    ocorrenciasCampo: {
      ocorrencias: '',
      pendencias: '',
      recomendacoes: '',
      observacoesGerais: '',
    },
    fotos: [],
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

/**
 * Verifica se o relatório possui dados reais preenchidos pelo usuário antes de acionar o auto-save no Supabase,
 * evitando poluir a nuvem com formulários em branco recém-iniciados.
 */
export function relatorioTemDadosReais(relatorio: RelatorioTecnico): boolean {
  const limpo = (v?: string) => {
    const s = (v || '').trim();
    if (!s || s.includes('[DADO A PREENCHER')) return '';
    return s;
  };

  return Boolean(
    limpo(relatorio.cabecalho.contratoOS) ||
      limpo(relatorio.cabecalho.cliente) ||
      limpo(relatorio.cabecalho.localizacao) ||
      limpo(relatorio.descricaoServico) ||
      limpo(relatorio.dadosPoco.pocoId) ||
      limpo(relatorio.dadosPoco.profundidadeTotal) ||
      limpo(relatorio.dadosPoco.nivelEstatico) ||
      limpo(relatorio.dadosPoco.nivelDinamico) ||
      limpo(relatorio.dadosPoco.vazaoTeste) ||
      relatorio.pocoUuid ||
      relatorio.fotos.length > 0 ||
      relatorio.equipe.length > 0 ||
      relatorio.servicosConduzidos.length > 0 ||
      relatorio.materiaisAplicados.length > 0 ||
      relatorio.assinaturaResponsavel?.dataUrl ||
      relatorio.assinaturaCliente?.dataUrl
  );
}

/**
 * Remove definitivamente o banco local legado (IndexedDB 'RelatorPRO_DB') do navegador.
 */
export function limparBancoLocalLegado(): Promise<void> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let concluido = false;
    const finalizar = () => {
      if (!concluido) {
        concluido = true;
        resolve();
      }
    };
    const timeout = window.setTimeout(finalizar, 1500);
    try {
      const req = window.indexedDB.deleteDatabase('RelatorPRO_DB');
      req.onsuccess = () => {
        window.clearTimeout(timeout);
        finalizar();
      };
      req.onerror = () => {
        window.clearTimeout(timeout);
        finalizar();
      };
      req.onblocked = () => {
        window.clearTimeout(timeout);
        finalizar();
      };
    } catch {
      window.clearTimeout(timeout);
      finalizar();
    }
  });
}

/**
 * Exporta templates personalizados para string JSON para backup/compartilhamento.
 */
export function exportarTemplatesJson(templates: TemplateServico[]): string {
  const customizados = templates.filter((t) => t.isCustom);
  return JSON.stringify(
    {
      formato: 'hidrogeo_templates_v1',
      exportadoEm: new Date().toISOString(),
      templates: customizados,
    },
    null,
    2
  );
}

/**
 * Faz o parse de um arquivo JSON de templates para importação na nuvem (Supabase).
 */
export function parsearTemplatesJson(jsonStr: string): TemplateServico[] {
  try {
    const dados = JSON.parse(jsonStr);
    const lista: unknown[] = Array.isArray(dados)
      ? dados
      : Array.isArray(dados?.templates)
      ? dados.templates
      : [];
    const resultado: TemplateServico[] = [];
    for (const raw of lista) {
      const item = raw as Record<string, unknown>;
      if (item && item.titulo && item.conteudo) {
        const id =
          typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        resultado.push({
          id,
          titulo: String(item.titulo).trim(),
          categoria: String(item.categoria || 'Importado').trim(),
          conteudo: String(item.conteudo).trim(),
          isCustom: true,
          criadoEm: Number(item.criadoEm || Date.now()),
        });
      }
    }
    return resultado;
  } catch {
    return [];
  }
}
