import React, { useState, useRef, useEffect } from 'react';
import {
  CadastroCliente,
  CadastroPoco,
  DadosTesteVazaoSEMA,
  EtapaStepDrawdownSEMA,
  LeituraBombeamentoGeoeste,
  LeituraRecuperacaoGeoeste,
} from '../types/relatorio';
import {
  OPCOES_ETAPA_DURACAO,
  TEMPOS_PADRAO_RECUPERACAO_GEOESTE,
  gerarTemposBombeamentoParaDuracao,
  parseNumeroSEMA,
} from './StepDrawdownSection';
import { DadosExtraidosOSCampo } from './ImportarOSCampoModal';
import {
  X,
  FileSpreadsheet,
  FileUp,
  Download,
  Plus,
  Trash2,
  Sparkles,
  Check,
  Link2,
  ClipboardPaste,
  Loader2,
  ChevronDown,
  ChevronUp,
  Users,
  Database,
  Calendar,
  Info,
  Copy,
} from 'lucide-react';

export interface LinhaLancamentoHistoricoOS {
  id: string;
  selecionada: boolean;
  clienteNome: string;
  clienteCNPJ: string;
  pocoTag: string;
  nomeLocalPoco: string;
  cidadeUF: string;
  numeroOS: string;
  dataExecucaoISO: string; // YYYY-MM-DD
  tipoServico: string;
  profundidadeTotal: string;
  diametroRevestimento: string;
  neAntes: string;
  neDepois: string;
  ndAntes: string;
  ndDepois: string;
  vazaoAntes: string;
  vazaoDepois: string;
  crivoAntes: string;
  crivoDepois: string;
  eletrodoSup: string;
  eletrodoInf: string;
  tuboEdutor: string;
  especificacaoBomba: string;
  painelEletrico: string;
  simularTesteVazao: boolean;
  duracaoTesteLabel: string; // '6H' | '12H' | '24H' | '36H' | '48H' | '72H'
  equipeTexto: string;
  materiaisTexto: string;
  servicosTexto: string;
  observacoesCampo: string;
  origem: 'manual' | 'pdf' | 'csv' | 'exemplo';
}

interface ModalLancamentoRapidoHistoricoProps {
  isOpen: boolean;
  onClose: () => void;
  clientes: CadastroCliente[];
  pocos: CadastroPoco[];
  clienteInicialUuid?: string;
  pocoInicialUuid?: string;
  onImportarLoteOS: (linhas: LinhaLancamentoHistoricoOS[]) => Promise<void>;
  showToast: (mensagem: string, tipo?: 'success' | 'error') => void;
}

export const CABECALHOS_CSV_MODELO = [
  'Cliente',
  'CNPJ_Cliente',
  'Poco_TAG',
  'Nome_Local_Poco',
  'Cidade_UF',
  'Numero_OS',
  'Data_Execucao',
  'Tipo_Servico',
  'Profundidade_Total_m',
  'Diametro_Pol',
  'NE_Antes_m',
  'NE_Depois_m',
  'ND_Antes_m',
  'ND_Depois_m',
  'Vazao_Antes_m3h',
  'Vazao_Depois_m3h',
  'Crivo_Antes_m',
  'Crivo_Depois_m',
  'Eletrodo_Sup_m',
  'Eletrodo_Inf_m',
  'Tubo_Edutor',
  'Motobomba',
  'Painel_Eletrico',
  'Simular_Teste_Vazao',
  'Duracao_Teste',
  'Equipe',
  'Materiais_Aplicados',
  'Servicos_Executados',
  'Observacoes_Campo',
];

const LINHAS_EXEMPLO_HISTORICO: Omit<LinhaLancamentoHistoricoOS, 'id'>[] = [
  {
    selecionada: true,
    clienteNome: 'SECRETARIA DE ESTADO DE FAZENDA - SEFAZ',
    clienteCNPJ: '03.507.415/0001-44',
    pocoTag: 'PT-01',
    nomeLocalPoco: 'SEFAZ Sede - Bloco A',
    cidadeUF: 'Cuiabá - MT',
    numeroOS: '08410/2024',
    dataExecucaoISO: '2024-03-15',
    tipoServico: 'MANUTENÇÃO PREVENTIVA E LIMPEZA',
    profundidadeTotal: '160,00 m',
    diametroRevestimento: '6"',
    neAntes: '23,10',
    neDepois: '22,40',
    ndAntes: '68,50',
    ndDepois: '64,10',
    vazaoAntes: '9,50',
    vazaoDepois: '10,29',
    crivoAntes: '84,00',
    crivoDepois: '84,00',
    eletrodoSup: '76,00',
    eletrodoInf: '80,00',
    tuboEdutor: 'Geomecânico 2"',
    especificacaoBomba: 'Ebara 4BHS-15 7,5 CV Trifásica 380V',
    painelEletrico: 'Painel Comando 7,5 CV 380V',
    simularTesteVazao: true,
    duracaoTesteLabel: '24H',
    equipeTexto: 'José Augusto (Líder) | Daniel Diego (Auxiliar)',
    materiaisTexto: 'Ácido Cítrico (10 KG) | Hipoclorito de Sódio (10 L)',
    servicosTexto:
      'Limpeza e desenvolvimento de poço | Desinfecção bacteriológica | Teste de vazão 24h',
    observacoesCampo:
      'Manutenção preventiva 2024 concluída com recuperação de capacidade específica.',
    origem: 'exemplo',
  },
  {
    selecionada: true,
    clienteNome: 'SECRETARIA DE ESTADO DE FAZENDA - SEFAZ',
    clienteCNPJ: '03.507.415/0001-44',
    pocoTag: 'PT-01',
    nomeLocalPoco: 'SEFAZ Sede - Bloco A',
    cidadeUF: 'Cuiabá - MT',
    numeroOS: '09320/2025',
    dataExecucaoISO: '2025-06-18',
    tipoServico: 'MANUTENÇÃO PREVENTIVA ANUAL',
    profundidadeTotal: '160,00 m',
    diametroRevestimento: '6"',
    neAntes: '22,40',
    neDepois: '22,10',
    ndAntes: '64,10',
    ndDepois: '63,80',
    vazaoAntes: '10,29',
    vazaoDepois: '10,45',
    crivoAntes: '84,00',
    crivoDepois: '84,00',
    eletrodoSup: '76,00',
    eletrodoInf: '80,00',
    tuboEdutor: 'Geomecânico 2"',
    especificacaoBomba: 'Ebara 4BHS-15 7,5 CV Trifásica 380V',
    painelEletrico: 'Painel Comando 7,5 CV 380V',
    simularTesteVazao: true,
    duracaoTesteLabel: '24H',
    equipeTexto: 'José Augusto (Líder) | Daniel Diego (Auxiliar)',
    materiaisTexto: 'Ácido Cítrico (10 KG) | Hipoclorito de Sódio (10 L)',
    servicosTexto:
      'Limpeza química e desinfecção | Revisão de painel elétrico | Teste de vazão',
    observacoesCampo: 'Atendimento anual 2025 sem intercorrências.',
    origem: 'exemplo',
  },
  {
    selecionada: true,
    clienteNome: 'SECRETARIA DE ESTADO DE FAZENDA - SEFAZ',
    clienteCNPJ: '03.507.415/0001-44',
    pocoTag: 'PT-03',
    nomeLocalPoco: 'SEFAZ Sede - Av. Hist. Rubens de Mendonça, 3415',
    cidadeUF: 'Cuiabá - MT',
    numeroOS: '10260',
    dataExecucaoISO: '2026-10-23',
    tipoServico: 'MANUTENÇÃO PREVENTIVA - SEFAZ SEDE',
    profundidadeTotal: '200,00 m',
    diametroRevestimento: '6"',
    neAntes: '36,20',
    neDepois: '36,20',
    ndAntes: '116,80',
    ndDepois: '116,80',
    vazaoAntes: '2,60',
    vazaoDepois: '2,60',
    crivoAntes: '180,00',
    crivoDepois: '180,00',
    eletrodoSup: 'Cabo 3x10 mm²',
    eletrodoInf: 'Cabo 3x6 mm²',
    tuboEdutor: 'CRI 1 1/2"',
    especificacaoBomba: 'Motobomba Submersa Ebara',
    painelEletrico: 'Partida Direta 220V 11,4A',
    simularTesteVazao: true,
    duracaoTesteLabel: '12H',
    equipeTexto: 'José Augusto (Líder) | Daniel Diego (Auxiliar)',
    materiaisTexto: 'Ácido Cítrico (10 KG) | Hipoclorito de Sódio (10 GL)',
    servicosTexto:
      'Limpeza e desenvolvimento de poço | Desinfecção bacteriológica | Análise de água',
    observacoesCampo: 'Aterramento: OK. Cavalete: OK. Tubo de nível: Mangueira 3/4".',
    origem: 'exemplo',
  },
  {
    selecionada: true,
    clienteNome: 'SECRETARIA DE ESTADO DE FAZENDA - SEFAZ',
    clienteCNPJ: '03.507.415/0001-44',
    pocoTag: 'PT-01 (SONORA)',
    nomeLocalPoco: 'Posto Fiscal Sonora',
    cidadeUF: 'Sonora - MT/MS',
    numeroOS: '10235-SONORA',
    dataExecucaoISO: '2026-10-16',
    tipoServico: 'MANUTENÇÃO PREVENTIVA - UNIDADE SONORA',
    profundidadeTotal: '150,00 m',
    diametroRevestimento: '6"',
    neAntes: '18,00',
    neDepois: '17,50',
    ndAntes: '52,00',
    ndDepois: '48,00',
    vazaoAntes: '4,00',
    vazaoDepois: '8,00',
    crivoAntes: '90,00',
    crivoDepois: '90,00',
    eletrodoSup: '82,00',
    eletrodoInf: '86,00',
    tuboEdutor: 'Geon DN 1 1/2"',
    especificacaoBomba: 'Motobomba Submersa Existente',
    painelEletrico: 'Painel de Comando Existente',
    simularTesteVazao: true,
    duracaoTesteLabel: '12H',
    equipeTexto: 'Estevan (Líder) | Reinaldo (Auxiliar)',
    materiaisTexto: 'Ácido Cítrico (10 KG) | Hipoclorito de Sódio (10 L)',
    servicosTexto:
      'Limpeza e desenvolvimento | Retirada e instalação de motobomba | Desinfecção',
    observacoesCampo:
      'Solicitar ao zelador retirada de galhos sobre o poço na próxima limpeza.',
    origem: 'exemplo',
  },
  {
    selecionada: true,
    clienteNome: 'SECRETARIA DE ESTADO DE FAZENDA - SEFAZ',
    clienteCNPJ: '03.507.415/0001-44',
    pocoTag: 'PT-01 (PF CACHIMBO)',
    nomeLocalPoco: 'BR 163 - PF Cachimbo - Zona Rural',
    cidadeUF: 'Guarantã do Norte - MT',
    numeroOS: '10235-CACHIMBO',
    dataExecucaoISO: '2026-10-20',
    tipoServico: 'MANUTENÇÃO PREVENTIVA - PF CACHIMBO',
    profundidadeTotal: '35,00 m',
    diametroRevestimento: '4"',
    neAntes: '4,50',
    neDepois: '8,00',
    ndAntes: '6,40',
    ndDepois: '30,00',
    vazaoAntes: '4,00',
    vazaoDepois: '4,10',
    crivoAntes: '12,00',
    crivoDepois: '12,00',
    eletrodoSup: '3,00',
    eletrodoInf: '11,50',
    tuboEdutor: '1 1/4" Galvanizado',
    especificacaoBomba: 'ESUB 4/9 1,5 HP 220V Monof.',
    painelEletrico: 'Painel Comando 1,5 HP 220V 5A',
    simularTesteVazao: true,
    duracaoTesteLabel: '12H',
    equipeTexto: 'Ednilson (Líder) | Everton (Auxiliar)',
    materiaisTexto: 'Ácido Cítrico (10 KG) | Hipoclorito de Sódio (12 GL)',
    servicosTexto:
      'Limpeza e desenvolvimento | Desinfecção | Análise padrão SEMA',
    observacoesCampo: 'Recebido por José Maurício de Mattos. Cavalete: Sim.',
    origem: 'exemplo',
  },
  {
    selecionada: true,
    clienteNome: 'AGROPECUÁRIA PARECIS S/A',
    clienteCNPJ: '12.345.678/0001-90',
    pocoTag: 'PT-01',
    nomeLocalPoco: 'Fazenda Santa Luzia - Sede',
    cidadeUF: 'Sorriso - MT',
    numeroOS: '07812/2024',
    dataExecucaoISO: '2024-08-10',
    tipoServico: 'MANUTENÇÃO CORRETIVA E SUBSTITUIÇÃO DE BOMBA',
    profundidadeTotal: '140,00 m',
    diametroRevestimento: '6"',
    neAntes: '19,50',
    neDepois: '19,00',
    ndAntes: '54,00',
    ndDepois: '49,50',
    vazaoAntes: '11,20',
    vazaoDepois: '14,80',
    crivoAntes: '78,00',
    crivoDepois: '78,00',
    eletrodoSup: '70,00',
    eletrodoInf: '74,00',
    tuboEdutor: 'Geomecânico 2"',
    especificacaoBomba: 'Leão 4R5PB-16 5,0 CV 380V',
    painelEletrico: 'Quadro Comando Soft-Starter 5 CV',
    simularTesteVazao: false,
    duracaoTesteLabel: '24H',
    equipeTexto: 'Estevan (Líder) | Reinaldo (Auxiliar)',
    materiaisTexto: 'Cabo Submersível 3x6mm² (80 M) | Luva de Emenda Resina (1 UN)',
    servicosTexto: 'Substituição de conjunto motobomba | Revisão elétrica',
    observacoesCampo: 'Troca de motobomba e adequação de submergência.',
    origem: 'exemplo',
  },
];

/**
 * Converte string de data (DD/MM/YYYY ou YYYY-MM-DD) para formato ISO YYYY-MM-DD
 */
export function normalizarDataParaISO(valor: string): string {
  const limpo = (valor || '').trim();
  if (!limpo) return new Date().toISOString().split('T')[0];

  const matchBR = limpo.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchBR) {
    const dia = matchBR[1].padStart(2, '0');
    const mes = matchBR[2].padStart(2, '0');
    const ano = matchBR[3];
    return `${ano}-${mes}-${dia}`;
  }

  const matchISO = limpo.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (matchISO) {
    return `${matchISO[1]}-${matchISO[2].padStart(2, '0')}-${matchISO[3].padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

/**
 * Formata data ISO YYYY-MM-DD para DD/MM/YYYY para exportação Excel/CSV
 */
function formatarDataParaCSV(iso: string): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso || '';
}

/**
 * Gera curva completa de Teste de Bombeamento Cooper-Jacob + Vazão Q(t) coerente
 * para relatórios históricos quando o usuário marca "Simular Teste".
 */
export function gerarDadosTesteSimuladoParaHistorico(
  neStr: string,
  ndStr: string,
  vazaoStr: string,
  duracaoLabel: string,
  dataExecucaoISO: string,
  responsavelNome?: string,
  responsavelCREA?: string
): DadosTesteVazaoSEMA | undefined {
  const neVal = parseNumeroSEMA(neStr);
  const ndVal = parseNumeroSEMA(ndStr);
  const qVal = parseNumeroSEMA(vazaoStr);

  if (neVal === null || ndVal === null || qVal === null || ndVal <= neVal || qVal <= 0) {
    return undefined;
  }

  const normDur = (duracaoLabel || '24H').trim().toUpperCase();
  const opcao =
    OPCOES_ETAPA_DURACAO.find(
      (o) => o.valor !== 'PERSONALIZADO' && o.valor === normDur
    ) || OPCOES_ETAPA_DURACAO[2];
  const duracaoMinutos = opcao.minutos || 1440;
  const horas = opcao.horas || 24;
  const tempos = gerarTemposBombeamentoParaDuracao(duracaoMinutos);

  const sMax = Math.max(0.1, Number((ndVal - neVal).toFixed(2)));
  const tEstab = Math.min(160, Math.max(60, Math.floor(duracaoMinutos * 0.22)));

  const leiturasBombeamento: LeituraBombeamentoGeoeste[] = tempos.map((t) => {
    let sT: number;
    let qT: number;

    if (t >= tEstab) {
      sT = sMax;
      qT = qVal;
    } else {
      const x = Math.log10(t) / Math.log10(tEstab);
      sT = sMax * (0.08 + 0.92 * Math.pow(x, 0.92));

      const progressoRebaix = Math.min(1, Math.max(0, sT / sMax));
      const decaimentoValvula = Math.exp(-t / 15);
      const sobreVazaoInicial =
        qVal * 0.04 * (1 - 0.55 * progressoRebaix) * decaimentoValvula;
      const pseudoRandQ = ((Math.sin(t * 27.1357 + qVal) * 43758.5453) % 1) - 0.5;
      const ruidoQ = pseudoRandQ * qVal * 0.012 * Math.max(0.15, 1 - t / tEstab);
      qT = Math.max(qVal * 0.96, qVal + sobreVazaoInicial + ruidoQ);

      if (t > 5) {
        const pseudoRandND = ((Math.sin(t * 12.9898) * 43758.5453) % 1) - 0.5;
        sT += pseudoRandND * 0.04;
      }
    }

    sT = Math.min(sMax, Math.max(0.1, sT));
    const ndT = Number((neVal + sT).toFixed(2));
    const qTArred = Number(qT.toFixed(3));

    return {
      id: `bomb-hist-${t}`,
      tMin: t,
      ndM: ndT.toFixed(2).replace('.', ','),
      vazaoM3h: qTArred.toFixed(3).replace('.', ','),
      areiaPpm: '0',
      observacoes:
        t === 1
          ? 'Início do ensaio — ajuste inicial de registro'
          : t >= tEstab
          ? 'Nível e Vazão Estabilizados'
          : 'Água límpida',
    };
  });

  const taxaRecupFrac = 0.75;
  const leiturasRecuperacao: LeituraRecuperacaoGeoeste[] =
    TEMPOS_PADRAO_RECUPERACAO_GEOESTE.map((t) => {
      const xRec = Math.log10(t + 1) / Math.log10(36);
      const recupInst = taxaRecupFrac * Math.pow(xRec, 0.75);
      const sRes = Math.max(0.05, sMax * (1 - recupInst));
      const ndRec = Number((neVal + sRes).toFixed(2));
      return {
        id: `rec-hist-${t}`,
        tMin: t,
        ndM: ndRec.toFixed(2).replace('.', ','),
        sCalcM: '',
        observacoes: t === 1 ? 'Desligamento do bombeamento' : 'Ascensão contínua',
      };
    });

  const efFrac = 0.75;
  const B = (efFrac * sMax) / qVal;
  const C = ((1 - efFrac) * sMax) / Math.pow(qVal, 2);
  const q1 = Number((qVal * 0.6).toFixed(2));
  const q2 = Number((qVal * 0.82).toFixed(2));
  const q3 = Number(qVal.toFixed(2));

  const etapas: EtapaStepDrawdownSEMA[] = [
    {
      id: 'step-hist-1',
      etapa: 1,
      duracaoMinutos: 120,
      vazaoM3h: q1.toFixed(2).replace('.', ','),
      nivelDinamicoM: (neVal + B * q1 + C * q1 * q1).toFixed(2).replace('.', ','),
      observacao: '1ª Etapa Escalonada — Regime Laminar Predominante',
    },
    {
      id: 'step-hist-2',
      etapa: 2,
      duracaoMinutos: 120,
      vazaoM3h: q2.toFixed(2).replace('.', ','),
      nivelDinamicoM: (neVal + B * q2 + C * q2 * q2).toFixed(2).replace('.', ','),
      observacao: '2ª Etapa Escalonada — Transição Hidrodinâmica',
    },
    {
      id: 'step-hist-3',
      etapa: 3,
      duracaoMinutos: 240,
      vazaoM3h: q3.toFixed(2).replace('.', ','),
      nivelDinamicoM: (neVal + sMax).toFixed(2).replace('.', ','),
      observacao: `3ª Etapa Nominal Estabilizada — Vazão Recomendada (${opcao.valor})`,
    },
  ];

  // Cálculo simples de data/hora final
  const dataBase = dataExecucaoISO || '2026-03-13';
  const dtIni = new Date(`${dataBase}T08:00:00`);
  const dtFimBomb = new Date(dtIni.getTime() + duracaoMinutos * 60000);
  const dtFimRec = new Date(dtFimBomb.getTime() + 35 * 60000);
  const fmtData = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  const fmtHora = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0'
    )}:00`;

  return {
    ativo: true,
    tipoEnsaio:
      `Contínuo ${horas}h a Vazão Constante` as DadosTesteVazaoSEMA['tipoEnsaio'],
    etapaLabel: opcao.valor,
    referenciaMedidasM: '0,00',
    responsavelTecnicoNome: responsavelNome || 'Eng. Geólogo José Roberto Ribeiro',
    responsavelTecnicoCPF: '',
    responsavelTecnicoCREA: responsavelCREA || 'CREA MT1561',
    dataInicioEnsaio: dataBase,
    horaInicioBombeamento: '08:00:00',
    dataFinalBombeamento: fmtData(dtFimBomb),
    horaFinalBombeamento: fmtHora(dtFimBomb),
    dataInicioRecuperacao: fmtData(dtFimBomb),
    horaInicioRecuperacao: fmtHora(dtFimBomb),
    dataFinalRecuperacao: fmtData(dtFimRec),
    horaFinalRecuperacao: fmtHora(dtFimRec),
    tempoRecuperacaoMinutos: '35',
    nivelRecuperacaoFinalM:
      leiturasRecuperacao[leiturasRecuperacao.length - 1]?.ndM || '33,60',
    vazaoOutorgaRecomendadaM3h: qVal.toFixed(2).replace('.', ','),
    regimeBombeamentoHorasDia: '16',
    leiturasBombeamento,
    leiturasRecuperacao,
    etapas,
  };
}

/**
 * Divide uma linha CSV respeitando aspas duplas
 */
function dividirLinhaCSV(linha: string, delimitador: string): string[] {
  const resultado: string[] = [];
  let atual = '';
  let dentroAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (dentroAspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        dentroAspas = !dentroAspas;
      }
    } else if (ch === delimitador && !dentroAspas) {
      resultado.push(atual.trim());
      atual = '';
    } else {
      atual += ch;
    }
  }
  resultado.push(atual.trim());
  return resultado;
}

export const ModalLancamentoRapidoHistorico: React.FC<
  ModalLancamentoRapidoHistoricoProps
> = ({
  isOpen,
  onClose,
  clientes,
  pocos,
  clienteInicialUuid = '',
  pocoInicialUuid = '',
  onImportarLoteOS,
  showToast,
}) => {
  const [clientePadraoUuid, setClientePadraoUuid] =
    useState<string>(clienteInicialUuid);
  const [pocoPadraoUuid, setPocoPadraoUuid] = useState<string>(pocoInicialUuid);
  const [linhas, setLinhas] = useState<LinhaLancamentoHistoricoOS[]>(() =>
    LINHAS_EXEMPLO_HISTORICO.map((l, idx) => ({
      ...l,
      id: `lote-init-${idx}-${Date.now()}`,
    }))
  );
  const [linhaExpandidaId, setLinhaExpandidaId] = useState<string | null>(null);
  const [abaEntrada, setAbaEntrada] = useState<'grade' | 'excel_csv' | 'pdf_lote'>(
    'grade'
  );
  const [textoColadoExcel, setTextoColadoExcel] = useState<string>('');
  const [lendoPdfs, setLendoPdfs] = useState<boolean>(false);
  const [progressoPdf, setProgressoPdf] = useState<string>('');
  const [salvandoLote, setSalvandoLote] = useState<boolean>(false);

  const inputCsvRef = useRef<HTMLInputElement | null>(null);
  const inputPdfsRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (clienteInicialUuid) setClientePadraoUuid(clienteInicialUuid);
      if (pocoInicialUuid) setPocoPadraoUuid(pocoInicialUuid);
    }
  }, [isOpen, clienteInicialUuid, pocoInicialUuid]);

  if (!isOpen) return null;

  const clientePadraoObj = clientes.find((c) => c.uuid === clientePadraoUuid);
  const pocosDoClientePadrao = clientePadraoObj
    ? pocos.filter(
        (p) =>
          p.clienteUuid === clientePadraoObj.uuid ||
          p.cliente.trim().toLowerCase() ===
            clientePadraoObj.razaoSocial.trim().toLowerCase()
      )
    : pocos;
  const pocoPadraoObj = pocos.find((p) => p.uuid === pocoPadraoUuid);

  // Gera e baixa o arquivo CSV Modelo compatível com Excel PT-BR (BOM UTF-8 + separador ;)
  const handleBaixarModeloExcelCSV = (incluirExemplos: boolean) => {
    const cabecalho = CABECALHOS_CSV_MODELO.join(';');
    const linhasDados = incluirExemplos
      ? LINHAS_EXEMPLO_HISTORICO.map((l) =>
          [
            l.clienteNome,
            l.clienteCNPJ,
            l.pocoTag,
            l.nomeLocalPoco,
            l.cidadeUF,
            l.numeroOS,
            formatarDataParaCSV(l.dataExecucaoISO),
            l.tipoServico,
            l.profundidadeTotal.replace(/\s*m$/i, ''),
            l.diametroRevestimento,
            l.neAntes,
            l.neDepois,
            l.ndAntes,
            l.ndDepois,
            l.vazaoAntes,
            l.vazaoDepois,
            l.crivoAntes,
            l.crivoDepois,
            l.eletrodoSup,
            l.eletrodoInf,
            l.tuboEdutor,
            l.especificacaoBomba,
            l.painelEletrico,
            l.simularTesteVazao ? 'SIM' : 'NÃO',
            l.duracaoTesteLabel,
            l.equipeTexto,
            l.materiaisTexto,
            l.servicosTexto,
            l.observacoesCampo,
          ]
            .map((v) => {
              const str = String(v ?? '').replace(/"/g, '""');
              return str.includes(';') || str.includes('\n') ? `"${str}"` : str;
            })
            .join(';')
        )
      : [
          [
            clientePadraoObj?.razaoSocial || 'NOME DO CLIENTE EXEMPLO',
            clientePadraoObj?.cnpjCpf || '00.000.000/0001-00',
            pocoPadraoObj?.tag || 'PT-01',
            pocoPadraoObj?.enderecoLocal || 'Sede / Unidade 01',
            pocoPadraoObj?.cidadeUF || clientePadraoObj?.cidadeUF || 'Cuiabá - MT',
            '0001/2024',
            '15/03/2024',
            'MANUTENÇÃO PREVENTIVA',
            pocoPadraoObj?.profundidadeTotal || '150,00',
            pocoPadraoObj?.diametroRevestimento || '6"',
            '22,00',
            '21,50',
            '64,00',
            '60,00',
            '9,00',
            '10,50',
            pocoPadraoObj?.crivoPadrao || '84,00',
            pocoPadraoObj?.crivoPadrao || '84,00',
            pocoPadraoObj?.eletrodoSuperiorPadrao || '76,00',
            pocoPadraoObj?.eletrodoInferiorPadrao || '80,00',
            pocoPadraoObj?.tuboEdutorPadrao || 'Geomecânico 2"',
            pocoPadraoObj?.bombaAtual || 'Motobomba Submersa Ebara',
            pocoPadraoObj?.painelAtual || 'Painel Comando 380V',
            'SIM',
            '24H',
            'Técnico Líder | Auxiliar',
            'Ácido Cítrico (10 KG) | Hipoclorito (10 L)',
            'Limpeza de poço | Desinfecção | Teste de vazão',
            'Atendimento realizado conforme programação.',
          ].join(';'),
        ];

    // BOM UTF-8 (\uFEFF) garante que o Microsoft Excel abra acentos e colunas com ';' perfeitamente
    const conteudoCSV = `\uFEFF${[cabecalho, ...linhasDados].join('\r\n')}`;
    const blob = new Blob([conteudoCSV], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = incluirExemplos
      ? 'Modelo_Importacao_OS_Historico_2024_2026.csv'
      : 'Planilha_Branco_Importacao_OS.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(
      incluirExemplos
        ? 'Planilha Modelo (Excel/CSV) com exemplos baixada com sucesso!'
        : 'Planilha em branco baixada! Preencha no Excel e importe aqui.',
      'success'
    );
  };

  // Adiciona uma nova linha inteligente (encadeando da última linha do mesmo poço ou do poço padrão)
  const handleAdicionarNovaLinha = (copiarDaUltima = true) => {
    const ultimaRef = copiarDaUltima ? linhas[linhas.length - 1] : undefined;

    const clienteBase =
      clientePadraoObj?.razaoSocial ||
      pocoPadraoObj?.cliente ||
      ultimaRef?.clienteNome ||
      '';
    const cnpjBase =
      clientePadraoObj?.cnpjCpf ||
      pocoPadraoObj?.clienteCNPJ ||
      ultimaRef?.clienteCNPJ ||
      '';
    const tagBase = pocoPadraoObj?.tag || ultimaRef?.pocoTag || 'PT-01';
    const localBase =
      pocoPadraoObj?.enderecoLocal ||
      pocoPadraoObj?.nomeIdentificacao ||
      ultimaRef?.nomeLocalPoco ||
      '';
    const cidadeBase =
      pocoPadraoObj?.cidadeUF ||
      clientePadraoObj?.cidadeUF ||
      ultimaRef?.cidadeUF ||
      'Cuiabá - MT';

    // Encadeamento: o "Depois" da OS anterior vira o "Antes" da nova OS
    const nova: LinhaLancamentoHistoricoOS = {
      id: `lote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      selecionada: true,
      clienteNome: clienteBase,
      clienteCNPJ: cnpjBase,
      pocoTag: tagBase,
      nomeLocalPoco: localBase,
      cidadeUF: cidadeBase,
      numeroOS: '',
      dataExecucaoISO: new Date().toISOString().split('T')[0],
      tipoServico: ultimaRef?.tipoServico || 'MANUTENÇÃO PREVENTIVA',
      profundidadeTotal:
        pocoPadraoObj?.profundidadeTotal ||
        ultimaRef?.profundidadeTotal ||
        '150,00 m',
      diametroRevestimento:
        pocoPadraoObj?.diametroRevestimento ||
        ultimaRef?.diametroRevestimento ||
        '6"',
      neAntes: ultimaRef?.neDepois || ultimaRef?.neAntes || '',
      neDepois: ultimaRef?.neDepois || '',
      ndAntes: ultimaRef?.ndDepois || ultimaRef?.ndAntes || '',
      ndDepois: ultimaRef?.ndDepois || '',
      vazaoAntes: ultimaRef?.vazaoDepois || ultimaRef?.vazaoAntes || '',
      vazaoDepois: ultimaRef?.vazaoDepois || '',
      crivoAntes:
        ultimaRef?.crivoDepois || pocoPadraoObj?.crivoPadrao || '',
      crivoDepois:
        ultimaRef?.crivoDepois || pocoPadraoObj?.crivoPadrao || '',
      eletrodoSup:
        ultimaRef?.eletrodoSup || pocoPadraoObj?.eletrodoSuperiorPadrao || '',
      eletrodoInf:
        ultimaRef?.eletrodoInf || pocoPadraoObj?.eletrodoInferiorPadrao || '',
      tuboEdutor:
        ultimaRef?.tuboEdutor || pocoPadraoObj?.tuboEdutorPadrao || 'Geomecânico',
      especificacaoBomba:
        ultimaRef?.especificacaoBomba || pocoPadraoObj?.bombaAtual || '',
      painelEletrico:
        ultimaRef?.painelEletrico || pocoPadraoObj?.painelAtual || '',
      simularTesteVazao: ultimaRef ? ultimaRef.simularTesteVazao : true,
      duracaoTesteLabel: ultimaRef?.duracaoTesteLabel || '24H',
      equipeTexto: ultimaRef?.equipeTexto || '',
      materiaisTexto: ultimaRef?.materiaisTexto || '',
      servicosTexto: ultimaRef?.servicosTexto || '',
      observacoesCampo: '',
      origem: 'manual',
    };

    setLinhas((prev) => [...prev, nova]);
  };

  // Duplica uma linha específica encadeando o Depois -> Antes
  const handleEncadearProximoAtendimentoDaLinha = (
    origem: LinhaLancamentoHistoricoOS
  ) => {
    const nova: LinhaLancamentoHistoricoOS = {
      ...origem,
      id: `lote-enc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      numeroOS: '',
      neAntes: origem.neDepois || origem.neAntes,
      ndAntes: origem.ndDepois || origem.ndAntes,
      vazaoAntes: origem.vazaoDepois || origem.vazaoAntes,
      crivoAntes: origem.crivoDepois || origem.crivoAntes,
      observacoesCampo: '',
      origem: 'manual',
    };
    setLinhas((prev) => [...prev, nova]);
    showToast(
      `Nova linha criada para ${origem.pocoTag} puxando os dados Pós-Manutenção da O.S. ${origem.numeroOS || 'anterior'}!`,
      'success'
    );
  };

  // Ordena cronologicamente por Poço + Data e encadeia automaticamente os dados Antes <- Depois
  const handleEncadearCronologicamenteTodas = () => {
    setLinhas((prev) => {
      const ordenadas = [...prev].sort((a, b) => {
        const chaveA = `${a.clienteNome.toLowerCase()}_${a.pocoTag.toLowerCase()}`;
        const chaveB = `${b.clienteNome.toLowerCase()}_${b.pocoTag.toLowerCase()}`;
        if (chaveA !== chaveB) return chaveA.localeCompare(chaveB);
        return (a.dataExecucaoISO || '').localeCompare(b.dataExecucaoISO || '');
      });

      const ultimoPorPoco = new Map<string, LinhaLancamentoHistoricoOS>();
      return ordenadas.map((item) => {
        const chave = `${item.clienteNome.trim().toLowerCase()}_${item.pocoTag
          .trim()
          .toLowerCase()}`;
        const anterior = ultimoPorPoco.get(chave);
        let atualizado = item;
        if (anterior) {
          atualizado = {
            ...item,
            profundidadeTotal:
              item.profundidadeTotal || anterior.profundidadeTotal,
            diametroRevestimento:
              item.diametroRevestimento || anterior.diametroRevestimento,
            neAntes: item.neAntes || anterior.neDepois || anterior.neAntes,
            ndAntes: item.ndAntes || anterior.ndDepois || anterior.ndAntes,
            vazaoAntes:
              item.vazaoAntes || anterior.vazaoDepois || anterior.vazaoAntes,
            crivoAntes:
              item.crivoAntes || anterior.crivoDepois || anterior.crivoAntes,
            tuboEdutor: item.tuboEdutor || anterior.tuboEdutor,
            especificacaoBomba:
              item.especificacaoBomba || anterior.especificacaoBomba,
            painelEletrico: item.painelEletrico || anterior.painelEletrico,
          };
        }
        ultimoPorPoco.set(chave, atualizado);
        return atualizado;
      });
    });

    showToast(
      'Linhas ordenadas cronologicamente por Poço (2024 → 2026) e medições "Antes" encadeadas!',
      'success'
    );
  };

  const atualizarCampoLinha = <K extends keyof LinhaLancamentoHistoricoOS>(
    id: string,
    campo: K,
    valor: LinhaLancamentoHistoricoOS[K]
  ) => {
    setLinhas((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [campo]: valor } : l))
    );
  };

  const removerLinha = (id: string) => {
    setLinhas((prev) => prev.filter((l) => l.id !== id));
  };

  // Parseia texto CSV ou células coladas do Excel
  const processarTextoPlanilha = (textoBruto: string) => {
    const linhasTexto = textoBruto
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (linhasTexto.length === 0) {
      showToast('Nenhuma linha encontrada na planilha.', 'error');
      return;
    }

    // Detecta delimitador predominante na 1ª linha (\t do Excel, ; do CSV PT-BR, ou ,)
    const primeira = linhasTexto[0];
    const qtdTab = (primeira.match(/\t/g) || []).length;
    const qtdPontoVirgula = (primeira.match(/;/g) || []).length;
    const delimitador =
      qtdTab >= qtdPontoVirgula && qtdTab >= 2
        ? '\t'
        : qtdPontoVirgula >= 2
        ? ';'
        : ',';

    const colPrimeira = dividirLinhaCSV(primeira, delimitador);
    const temCabecalho = colPrimeira.some((c) =>
      /^(cliente|poco_tag|poço|numero_os|nº\s*os|data_execucao)/i.test(
        c.trim()
      )
    );

    const indiceInicio = temCabecalho ? 1 : 0;
    const novasLinhas: LinhaLancamentoHistoricoOS[] = [];

    for (let i = indiceInicio; i < linhasTexto.length; i++) {
      const cols = dividirLinhaCSV(linhasTexto[i], delimitador);
      if (cols.length < 3) continue;

      const simStr = (cols[23] || 'SIM').trim().toUpperCase();
      const simular =
        simStr === 'SIM' ||
        simStr === 'S' ||
        simStr === 'TRUE' ||
        simStr === '1';

      const durStr = (cols[24] || '24H').trim().toUpperCase();
      const durValida = ['6H', '12H', '24H', '36H', '48H', '72H'].includes(durStr)
        ? durStr
        : '24H';

      novasLinhas.push({
        id: `csv-${Date.now()}-${i}`,
        selecionada: true,
        clienteNome:
          cols[0] ||
          clientePadraoObj?.razaoSocial ||
          pocoPadraoObj?.cliente ||
          '',
        clienteCNPJ:
          cols[1] ||
          clientePadraoObj?.cnpjCpf ||
          pocoPadraoObj?.clienteCNPJ ||
          '',
        pocoTag: cols[2] || pocoPadraoObj?.tag || `PT-0${i}`,
        nomeLocalPoco: cols[3] || pocoPadraoObj?.enderecoLocal || '',
        cidadeUF:
          cols[4] ||
          pocoPadraoObj?.cidadeUF ||
          clientePadraoObj?.cidadeUF ||
          'Cuiabá - MT',
        numeroOS: cols[5] || `OS-${i}`,
        dataExecucaoISO: normalizarDataParaISO(cols[6] || ''),
        tipoServico: cols[7] || 'MANUTENÇÃO PREVENTIVA',
        profundidadeTotal: cols[8] || pocoPadraoObj?.profundidadeTotal || '',
        diametroRevestimento:
          cols[9] || pocoPadraoObj?.diametroRevestimento || '6"',
        neAntes: cols[10] || cols[11] || '',
        neDepois: cols[11] || cols[10] || '',
        ndAntes: cols[12] || cols[13] || '',
        ndDepois: cols[13] || cols[12] || '',
        vazaoAntes: cols[14] || cols[15] || '',
        vazaoDepois: cols[15] || cols[14] || '',
        crivoAntes: cols[16] || cols[17] || pocoPadraoObj?.crivoPadrao || '',
        crivoDepois: cols[17] || cols[16] || pocoPadraoObj?.crivoPadrao || '',
        eletrodoSup: cols[18] || pocoPadraoObj?.eletrodoSuperiorPadrao || '',
        eletrodoInf: cols[19] || pocoPadraoObj?.eletrodoInferiorPadrao || '',
        tuboEdutor: cols[20] || pocoPadraoObj?.tuboEdutorPadrao || 'Geomecânico',
        especificacaoBomba: cols[21] || pocoPadraoObj?.bombaAtual || '',
        painelEletrico: cols[22] || pocoPadraoObj?.painelAtual || '',
        simularTesteVazao: simular,
        duracaoTesteLabel: durValida,
        equipeTexto: cols[25] || '',
        materiaisTexto: cols[26] || '',
        servicosTexto: cols[27] || '',
        observacoesCampo: cols[28] || '',
        origem: 'csv',
      });
    }

    if (novasLinhas.length === 0) {
      showToast(
        'Não foi possível identificar linhas válidas na planilha.',
        'error'
      );
      return;
    }

    setLinhas((prev) => [...prev, ...novasLinhas]);
    setTextoColadoExcel('');
    setAbaEntrada('grade');
    showToast(
      `${novasLinhas.length} ${
        novasLinhas.length === 1
          ? 'Ordem de Serviço importada'
          : 'Ordens de Serviço importadas'
      } para a grade de conferência!`,
      'success'
    );
  };

  const handleUploadArquivoCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const conteudo = String(reader.result || '');
      processarTextoPlanilha(conteudo);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  // Converte um DadosExtraidosOSCampo (vindo do extrator de PDF) em uma LinhaLancamentoHistoricoOS
  const converterExtracaoPdfParaLinha = (
    d: DadosExtraidosOSCampo,
    nomeArquivo: string
  ): LinhaLancamentoHistoricoOS => {
    const limparUnidadeNum = (val?: string) => {
      if (!val) return '';
      const m = val.match(/\d+(?:[.,]\d+)?/);
      return m ? m[0].replace('.', ',') : val;
    };

    return {
      id: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      selecionada: true,
      clienteNome:
        d.cliente ||
        clientePadraoObj?.razaoSocial ||
        pocoPadraoObj?.cliente ||
        'CLIENTE A IDENTIFICAR',
      clienteCNPJ:
        clientePadraoObj?.cnpjCpf || pocoPadraoObj?.clienteCNPJ || '',
      pocoTag: d.pocoTag || pocoPadraoObj?.tag || 'PT-01',
      nomeLocalPoco:
        d.localizacao ||
        pocoPadraoObj?.enderecoLocal ||
        nomeArquivo.replace(/\.pdf$/i, ''),
      cidadeUF:
        d.cidadeUF ||
        pocoPadraoObj?.cidadeUF ||
        clientePadraoObj?.cidadeUF ||
        'Cuiabá - MT',
      numeroOS: d.numeroOS || nomeArquivo.replace(/\.[^.]+$/, ''),
      dataExecucaoISO: normalizarDataParaISO(d.dataExecucaoISO || ''),
      tipoServico: d.tipoServico || 'MANUTENÇÃO PREVENTIVA',
      profundidadeTotal:
        d.profundidadeTotal || pocoPadraoObj?.profundidadeTotal || '',
      diametroRevestimento:
        d.diametroRevestimento || pocoPadraoObj?.diametroRevestimento || '6"',
      neAntes: limparUnidadeNum(d.nivelEstaticoInicial || d.nivelEstatico),
      neDepois: limparUnidadeNum(d.nivelEstatico || d.nivelEstaticoInicial),
      ndAntes: limparUnidadeNum(d.nivelDinamicoInicial || d.nivelDinamico),
      ndDepois: limparUnidadeNum(d.nivelDinamico || d.nivelDinamicoInicial),
      vazaoAntes: limparUnidadeNum(d.vazaoInicial || d.vazaoTeste),
      vazaoDepois: limparUnidadeNum(d.vazaoTeste || d.vazaoInicial),
      crivoAntes: limparUnidadeNum(d.crivoInicial || d.crivo),
      crivoDepois: limparUnidadeNum(d.crivo || d.crivoInicial),
      eletrodoSup: d.eletrodoSuperior || d.eletrodoSuperiorInicial || '',
      eletrodoInf: d.eletrodoInferior || d.eletrodoInferiorInicial || '',
      tuboEdutor: d.tuboEdutor || pocoPadraoObj?.tuboEdutorPadrao || '',
      especificacaoBomba:
        d.especificacaoBomba || pocoPadraoObj?.bombaAtual || '',
      painelEletrico: d.painelEletrico || pocoPadraoObj?.painelAtual || '',
      simularTesteVazao: true,
      duracaoTesteLabel: '24H',
      equipeTexto: (d.equipe || [])
        .map((m) => `${m.nome} (${m.funcao})`)
        .join(' | '),
      materiaisTexto: (d.materiais || [])
        .map((m) => `${m.descricao} (${m.quantidade} ${m.unidade})`)
        .join(' | '),
      servicosTexto: (d.servicos || []).map((s) => s.descricao).join(' | '),
      observacoesCampo: [d.observacoesManuscritas, d.dadosCarimboVersoResumo]
        .filter(Boolean)
        .join(' | '),
      origem: 'pdf',
    };
  };

  // Lê múltiplos arquivos PDF em lote e adiciona cada um como uma linha na grade
  const handleSelecionarMultiplosPdfs = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;
    e.target.value = '';

    setLendoPdfs(true);
    const extraidas: LinhaLancamentoHistoricoOS[] = [];

    const lerComoBase64 = (f: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(String(r.result || ''));
        r.onerror = () => reject(new Error('Falha ao ler arquivo'));
        r.readAsDataURL(f);
      });

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setProgressoPdf(
        `Processando arquivo ${i + 1} de ${files.length}: "${f.name}"...`
      );
      try {
        const base64Data = await lerComoBase64(f);
        const ehPdf =
          f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
        const mimeType = ehPdf ? 'application/pdf' : f.type || 'image/jpeg';

        const resp = await fetch('/api/extrair-os-campo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64Data,
            mimeType,
            nomeArquivo: f.name,
          }),
        });
        const json = await resp.json();
        if (resp.ok && json.sucesso && json.dados) {
          extraidas.push(converterExtracaoPdfParaLinha(json.dados, f.name));
        } else {
          // Mesmo se a IA falhar em um PDF, cria a linha pré-identificada pelo nome do arquivo para o usuário completar na grade
          extraidas.push(
            converterExtracaoPdfParaLinha(
              { numeroOS: f.name.replace(/\.[^.]+$/, '') },
              f.name
            )
          );
        }
      } catch {
        extraidas.push(
          converterExtracaoPdfParaLinha(
            { numeroOS: f.name.replace(/\.[^.]+$/, '') },
            f.name
          )
        );
      }
    }

    setLendoPdfs(false);
    setProgressoPdf('');

    if (extraidas.length > 0) {
      setLinhas((prev) => [...prev, ...extraidas]);
      setAbaEntrada('grade');
      showToast(
        `${extraidas.length} ${
          extraidas.length === 1 ? 'arquivo PDF lido e adicionado' : 'arquivos PDF lidos e adicionados'
        } na grade de Lançamento Rápido!`,
        'success'
      );
    }
  };

  // Aplica Cliente Padrão / Poço Padrão a todas as linhas selecionadas
  const handleAplicarClientePocoPadraoNasLinhas = () => {
    if (!clientePadraoObj && !pocoPadraoObj) {
      showToast('Selecione um Cliente ou Poço acima primeiro.', 'error');
      return;
    }

    setLinhas((prev) =>
      prev.map((l) => {
        if (!l.selecionada) return l;
        return {
          ...l,
          clienteNome:
            clientePadraoObj?.razaoSocial ||
            pocoPadraoObj?.cliente ||
            l.clienteNome,
          clienteCNPJ:
            clientePadraoObj?.cnpjCpf ||
            pocoPadraoObj?.clienteCNPJ ||
            l.clienteCNPJ,
          pocoTag: pocoPadraoObj?.tag || l.pocoTag,
          nomeLocalPoco:
            pocoPadraoObj?.enderecoLocal ||
            pocoPadraoObj?.nomeIdentificacao ||
            l.nomeLocalPoco,
          cidadeUF:
            pocoPadraoObj?.cidadeUF ||
            clientePadraoObj?.cidadeUF ||
            l.cidadeUF,
          profundidadeTotal:
            pocoPadraoObj?.profundidadeTotal || l.profundidadeTotal,
          diametroRevestimento:
            pocoPadraoObj?.diametroRevestimento || l.diametroRevestimento,
        };
      })
    );
    showToast(
      'Cliente / Poço padrão aplicado às linhas selecionadas!',
      'success'
    );
  };

  const linhasSelecionadas = linhas.filter((l) => l.selecionada);

  const handleConfirmarImportacaoLote = async () => {
    if (linhasSelecionadas.length === 0) {
      showToast('Selecione pelo menos uma linha para salvar no sistema.', 'error');
      return;
    }

    setSalvandoLote(true);
    try {
      await onImportarLoteOS(linhasSelecionadas);
      onClose();
    } finally {
      setSalvandoLote(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 print:hidden">
      <div className="bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 rounded-2xl shadow-2xl max-w-[1560px] w-full max-h-[94vh] flex flex-col overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-4 sm:px-6 border-b border-[#DDE3EC] dark:border-slate-800 bg-[#1B2A3B] text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#E8A020] text-[#1B2A3B] shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-2">
                <span>
                  Central de Lançamento Rápido de Histórico (2024 → Presente)
                </span>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full bg-[#E8A020]/20 text-[#E8A020] border border-[#E8A020]/30">
                  PDF em Lote · Planilha Excel/CSV · Grade Rápida
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Cadastre clientes, poços e dezenas de Ordens de Serviço retroativas de uma só vez com encadeamento Antes/Depois e simulação de teste.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleBaixarModeloExcelCSV(true)}
              className="px-3 py-2 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Baixar planilha modelo (.CSV compatível com Excel) preenchida com exemplos de 2 clientes e poços de 2024 a 2026"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Modelo Excel / CSV (com Exemplos)</span>
            </button>
            <button
              type="button"
              onClick={() => handleBaixarModeloExcelCSV(false)}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center gap-1.5 cursor-pointer"
              title="Baixar planilha em branco apenas com cabeçalhos para preencher no Excel"
            >
              <Download className="w-3.5 h-3.5 text-[#E8A020]" />
              <span className="hidden sm:inline">Modelo em Branco</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Seleção de Modo + Vínculo Rápido de Cliente/Poço */}
        <div className="p-3 sm:px-6 bg-[#F7F9FC] dark:bg-slate-950 border-b border-[#DDE3EC] dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Abas de Entrada */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAbaEntrada('grade')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                abaEntrada === 'grade'
                  ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 text-[#6B7A8D] hover:text-[#1B2A3B]'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>1. Grade de Lançamento Rápido ({linhas.length} O.S.)</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaEntrada('excel_csv')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                abaEntrada === 'excel_csv'
                  ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 text-[#6B7A8D] hover:text-[#1B2A3B]'
              }`}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>2. Importar Excel / CSV ou Colar Planilha</span>
            </button>

            <button
              type="button"
              onClick={() => setAbaEntrada('pdf_lote')}
              className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                abaEntrada === 'pdf_lote'
                  ? 'bg-[#1B2A3B] text-[#E8A020] shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-[#DDE3EC] dark:border-slate-800 text-[#6B7A8D] hover:text-[#1B2A3B]'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>3. Extrair de Múltiplos PDFs (2024–2026)</span>
            </button>
          </div>

          {/* Seletor de Cliente e Poço Padrão para agilizar lançamentos de um mesmo cliente */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#E8A020]" />
              <select
                value={clientePadraoUuid}
                onChange={(e) => {
                  setClientePadraoUuid(e.target.value);
                  setPocoPadraoUuid('');
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold max-w-[230px]"
              >
                <option value="">Cliente Padrão (Opcional / Pela Linha)</option>
                {clientes.map((c) => (
                  <option key={c.uuid} value={c.uuid}>
                    {c.razaoSocial}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-sky-600" />
              <select
                value={pocoPadraoUuid}
                onChange={(e) => setPocoPadraoUuid(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold max-w-[200px]"
              >
                <option value="">Poço Padrão (Opcional)</option>
                {pocosDoClientePadrao.map((p) => (
                  <option key={p.uuid} value={p.uuid}>
                    {p.tag} — {p.nomeIdentificacao || p.enderecoLocal}
                  </option>
                ))}
              </select>
            </div>

            {(clientePadraoUuid || pocoPadraoUuid) && (
              <button
                type="button"
                onClick={handleAplicarClientePocoPadraoNasLinhas}
                className="px-2.5 py-1.5 rounded-lg bg-[#1B2A3B] text-[#E8A020] font-bold text-[11px] hover:bg-slate-800 cursor-pointer"
                title="Preenche todas as linhas marcadas com este Cliente e/ou Poço"
              >
                Aplicar nas Linhas
              </button>
            )}
          </div>
        </div>

        {/* CORPO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* ABA 2: IMPORTAR EXCEL / CSV OU COLAR PLANILHA */}
          {abaEntrada === 'excel_csv' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 space-y-3">
                  <h3 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                    <Download className="w-4 h-4 text-[#E8A020]" />
                    <span>Passo 1: Baixe a Planilha Modelo (Excel / CSV)</span>
                  </h3>
                  <p className="text-xs text-[#6B7A8D] leading-relaxed">
                    O modelo já vem formatado com separador ponto-e-vírgula (<code>;</code>) e codificação UTF-8 para abrir diretamente no <strong>Microsoft Excel</strong> com todas as 29 colunas separadas (Cliente, Poço, OS, Data, NE/ND/Vazão Antes e Depois, Crivo, Eletrodos, Bomba, Serviços e Simulação de Teste).
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleBaixarModeloExcelCSV(true)}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Baixar Modelo com Exemplos (2024–2026)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBaixarModeloExcelCSV(false)}
                      className="px-3.5 py-2 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-[#E8A020]" />
                      <span>Baixar Modelo Limpo</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 space-y-3">
                  <h3 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                    <FileUp className="w-4 h-4 text-sky-600" />
                    <span>Passo 2 (Opção A): Enviar Arquivo CSV Salvo do Excel</span>
                  </h3>
                  <input
                    ref={inputCsvRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleUploadArquivoCSV}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => inputCsvRef.current?.click()}
                    className="w-full py-6 rounded-xl border-2 border-dashed border-sky-500/60 bg-white dark:bg-slate-900 hover:bg-sky-50/40 dark:hover:bg-slate-800/60 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <FileSpreadsheet className="w-7 h-7 text-sky-600" />
                    <span className="text-xs font-bold text-[#1B2A3B] dark:text-slate-100">
                      Selecionar Arquivo .CSV no Computador
                    </span>
                    <span className="text-[11px] text-[#6B7A8D]">
                      Suporta CSV separado por ponto-e-vírgula (;), vírgula (,) ou tabulação
                    </span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 p-4 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2">
                    <ClipboardPaste className="w-4 h-4 text-emerald-600" />
                    <span>
                      Passo 2 (Opção B): Ou Cole as Células Direto do Excel (Ctrl+C / Ctrl+V)
                    </span>
                  </h3>
                  <p className="text-xs text-[#6B7A8D]">
                    Você nem precisa salvar o arquivo se não quiser: basta selecionar as linhas no Excel, copiar (<code>Ctrl+C</code>) e colar (<code>Ctrl+V</code>) na caixa abaixo:
                  </p>
                  <textarea
                    rows={8}
                    value={textoColadoExcel}
                    onChange={(e) => setTextoColadoExcel(e.target.value)}
                    placeholder="Cole aqui as linhas copiadas do Excel ou o conteúdo do CSV..."
                    className="w-full p-3 rounded-xl border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={!textoColadoExcel.trim()}
                    onClick={() => processarTextoPlanilha(textoColadoExcel)}
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Carregar Dados Colados na Grade</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: EXTRAIR DE MÚLTIPLOS PDFS EM LOTE */}
          {abaEntrada === 'pdf_lote' && (
            <div className="p-6 rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 space-y-4">
              <div className="max-w-2xl mx-auto text-center space-y-2">
                <h3 className="text-base font-bold text-[#1B2A3B] dark:text-slate-100">
                  Leitura Automática de Múltiplas O.S. em PDF (2024 a 2026)
                </h3>
                <p className="text-xs text-[#6B7A8D]">
                  Selecione vários arquivos PDF (ou fotos de fichas de campo) de uma só vez. O sistema analisa cada documento e adiciona uma linha preenchida na Grade de Lançamento Rápido para você revisar antes de salvar.
                </p>
              </div>

              <input
                ref={inputPdfsRef}
                type="file"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleSelecionarMultiplosPdfs}
                className="hidden"
              />

              {lendoPdfs ? (
                <div className="max-w-xl mx-auto p-8 rounded-xl border border-[#E8A020]/50 bg-white dark:bg-slate-900 text-center space-y-3">
                  <Loader2 className="w-8 h-8 text-[#E8A020] animate-spin mx-auto" />
                  <div className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                    {progressoPdf || 'Lendo arquivos PDF...'}
                  </div>
                  <p className="text-xs text-[#6B7A8D]">
                    Extraindo Cliente, Poço, Nº da OS, Data, NE, ND, Vazão, Bomba e Serviços...
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputPdfsRef.current?.click()}
                  className="max-w-xl mx-auto w-full py-10 px-6 rounded-2xl border-2 border-dashed border-[#E8A020] bg-white dark:bg-slate-900 hover:bg-amber-50/40 dark:hover:bg-slate-800/60 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-[#E8A020]/20 text-[#B87000] dark:text-[#E8A020] flex items-center justify-center">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-[#1B2A3B] dark:text-slate-100">
                    Selecionar Múltiplos Arquivos PDF de O.S.
                  </span>
                  <span className="text-xs text-[#6B7A8D]">
                    Você pode selecionar 5, 10 ou mais PDFs de uma vez usando Shift ou Ctrl
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ABA 1: GRADE EDITÁVEL DE LANÇAMENTO RÁPIDO */}
          {abaEntrada === 'grade' && (
            <div className="space-y-3">
              {/* Barra de Ferramentas da Grade */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F7F9FC] dark:bg-slate-950 p-3 rounded-xl border border-[#DDE3EC] dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdicionarNovaLinha(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Nova O.S. (Encadear do Anterior)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEncadearCronologicamenteTodas}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#1B2A3B] text-[#E8A020] hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                    title="Ordena por Poço e Data (2024 → 2026) e copia automaticamente o Depois da OS anterior para o Antes da OS seguinte"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Encadear Cronologicamente (2024 → 2026)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => inputPdfsRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1 cursor-pointer"
                  >
                    <FileUp className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ Adicionar PDFs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => inputCsvRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>+ Importar CSV</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLinhas(
                        LINHAS_EXEMPLO_HISTORICO.map((l, idx) => ({
                          ...l,
                          id: `lote-ex-${idx}-${Date.now()}`,
                        }))
                      )
                    }
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#E8A020] flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-[#E8A020]" />
                    <span>Restaurar Exemplos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLinhas([])}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-red-200 dark:border-red-900/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpar Grade</span>
                  </button>
                </div>
              </div>

              {/* Dica Rápida */}
              <div className="px-3 py-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-[11px] text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Dica de Produtividade:</strong> Clique no ícone{' '}
                  <Copy className="w-3 h-3 inline text-[#E8A020]" /> em qualquer linha para criar imediatamente a <strong>próxima O.S. daquele mesmo poço</strong> (os dados <em>Depois</em> já entram como <em>Antes</em>). Se o cliente ou o poço ainda não existirem no sistema, eles serão criados automaticamente ao salvar!
                </span>
              </div>

              {/* Tabela Editável */}
              <div className="border border-[#DDE3EC] dark:border-slate-800 rounded-xl overflow-x-auto max-h-[52vh]">
                <table className="w-full min-w-[1380px] border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-[#1B2A3B] text-white text-[10.5px] uppercase">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-8">
                        <input
                          type="checkbox"
                          checked={
                            linhas.length > 0 &&
                            linhas.every((l) => l.selecionada)
                          }
                          onChange={(e) => {
                            const marcar = e.target.checked;
                            setLinhas((prev) =>
                              prev.map((l) => ({ ...l, selecionada: marcar }))
                            );
                          }}
                          className="accent-[#E8A020] cursor-pointer"
                        />
                      </th>
                      <th className="py-2.5 px-2 text-left min-w-[190px]">
                        Cliente
                      </th>
                      <th className="py-2.5 px-2 text-left w-28">
                        Poço (TAG)
                      </th>
                      <th className="py-2.5 px-2 text-left min-w-[140px]">
                        Cidade / Local
                      </th>
                      <th className="py-2.5 px-2 text-left w-28">Nº O.S.</th>
                      <th className="py-2.5 px-2 text-center w-32">
                        Data Execução
                      </th>
                      <th className="py-2.5 px-1.5 text-right w-20 bg-slate-800/90">
                        NE Antes
                      </th>
                      <th className="py-2.5 px-1.5 text-right w-20 bg-amber-950/80 text-[#E8A020]">
                        NE Depois
                      </th>
                      <th className="py-2.5 px-1.5 text-right w-20 bg-slate-800/90">
                        ND Antes
                      </th>
                      <th className="py-2.5 px-1.5 text-right w-20 bg-amber-950/80 text-[#E8A020]">
                        ND Depois
                      </th>
                      <th className="py-2.5 px-1.5 text-right w-20 bg-slate-800/90">
                        Q Antes
                      </th>
                      <th className="py-2.5 px-1.5 text-right w-20 bg-emerald-950/80 text-emerald-300">
                        Q Depois
                      </th>
                      <th className="py-2.5 px-2 text-left min-w-[150px]">
                        Motobomba / Crivo
                      </th>
                      <th className="py-2.5 px-2 text-center w-28">
                        Simular Teste?
                      </th>
                      <th className="py-2.5 px-2 text-center w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE3EC] dark:divide-slate-800">
                    {linhas.length === 0 ? (
                      <tr>
                        <td
                          colSpan={15}
                          className="py-10 text-center text-slate-400"
                        >
                          Nenhuma Ordem de Serviço na grade. Clique em{' '}
                          <strong>"+ Nova O.S."</strong>,{' '}
                          <strong>"Importar Excel / CSV"</strong> ou{' '}
                          <strong>"Extrair de Múltiplos PDFs"</strong>.
                        </td>
                      </tr>
                    ) : (
                      linhas.map((linha) => {
                        const expandida = linhaExpandidaId === linha.id;
                        return (
                          <React.Fragment key={linha.id}>
                            <tr
                              className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                                !linha.selecionada ? 'opacity-50' : ''
                              }`}
                            >
                              <td className="py-1.5 px-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={linha.selecionada}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'selecionada',
                                      e.target.checked
                                    )
                                  }
                                  className="accent-[#E8A020] cursor-pointer"
                                />
                              </td>

                              {/* Cliente */}
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  list="clientes-historico-list"
                                  value={linha.clienteNome}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'clienteNome',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Razão Social do Cliente"
                                  className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 font-semibold text-[11px]"
                                />
                              </td>

                              {/* Poço TAG */}
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={linha.pocoTag}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'pocoTag',
                                      e.target.value
                                    )
                                  }
                                  placeholder="PT-01"
                                  className="w-full px-2 py-1 rounded border border-[#E8A020]/60 bg-[#FFFDF7] dark:bg-slate-950 font-mono font-bold text-[11px]"
                                />
                              </td>

                              {/* Cidade / Local */}
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={linha.cidadeUF}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'cidadeUF',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Cuiabá - MT"
                                  className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px]"
                                />
                              </td>

                              {/* Nº OS */}
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={linha.numeroOS}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'numeroOS',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Ex: 10260"
                                  className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 font-mono font-bold text-[11px]"
                                />
                              </td>

                              {/* Data Execução */}
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="date"
                                  value={linha.dataExecucaoISO}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'dataExecucaoISO',
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-1.5 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-[11px]"
                                />
                              </td>

                              {/* NE Antes / Depois */}
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  value={linha.neAntes}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'neAntes',
                                      e.target.value
                                    )
                                  }
                                  placeholder="22,40"
                                  className="w-full px-1.5 py-1 text-right font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px]"
                                />
                              </td>
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  value={linha.neDepois}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'neDepois',
                                      e.target.value
                                    )
                                  }
                                  placeholder="22,40"
                                  className="w-full px-1.5 py-1 text-right font-mono font-bold rounded border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-950 text-[11px]"
                                />
                              </td>

                              {/* ND Antes / Depois */}
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  value={linha.ndAntes}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'ndAntes',
                                      e.target.value
                                    )
                                  }
                                  placeholder="64,10"
                                  className="w-full px-1.5 py-1 text-right font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px]"
                                />
                              </td>
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  value={linha.ndDepois}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'ndDepois',
                                      e.target.value
                                    )
                                  }
                                  placeholder="64,10"
                                  className="w-full px-1.5 py-1 text-right font-mono font-bold rounded border border-[#E8A020]/50 bg-[#FFFDF7] dark:bg-slate-950 text-[11px]"
                                />
                              </td>

                              {/* Vazão Antes / Depois */}
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  value={linha.vazaoAntes}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'vazaoAntes',
                                      e.target.value
                                    )
                                  }
                                  placeholder="10,29"
                                  className="w-full px-1.5 py-1 text-right font-mono rounded border border-[#DDE3EC] dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px]"
                                />
                              </td>
                              <td className="py-1.5 px-1">
                                <input
                                  type="text"
                                  value={linha.vazaoDepois}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'vazaoDepois',
                                      e.target.value
                                    )
                                  }
                                  placeholder="10,29"
                                  className="w-full px-1.5 py-1 text-right font-mono font-bold rounded border border-emerald-500/50 bg-[#F4FBF7] dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 text-[11px]"
                                />
                              </td>

                              {/* Motobomba */}
                              <td className="py-1.5 px-1.5">
                                <input
                                  type="text"
                                  value={linha.especificacaoBomba}
                                  onChange={(e) =>
                                    atualizarCampoLinha(
                                      linha.id,
                                      'especificacaoBomba',
                                      e.target.value
                                    )
                                  }
                                  placeholder="Modelo da Bomba"
                                  className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px]"
                                />
                              </td>

                              {/* Simular Teste + Duração */}
                              <td className="py-1.5 px-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={linha.simularTesteVazao}
                                    onChange={(e) =>
                                      atualizarCampoLinha(
                                        linha.id,
                                        'simularTesteVazao',
                                        e.target.checked
                                      )
                                    }
                                    title="Gerar automaticamente as 36 leituras Cooper-Jacob + Vazão Q(t) a partir de NE, ND e Vazão Depois"
                                    className="accent-[#E8A020] cursor-pointer"
                                  />
                                  {linha.simularTesteVazao && (
                                    <select
                                      value={linha.duracaoTesteLabel}
                                      onChange={(e) =>
                                        atualizarCampoLinha(
                                          linha.id,
                                          'duracaoTesteLabel',
                                          e.target.value
                                        )
                                      }
                                      className="px-1 py-0.5 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-[10px] font-bold"
                                    >
                                      <option value="6H">6H</option>
                                      <option value="12H">12H</option>
                                      <option value="24H">24H</option>
                                      <option value="36H">36H</option>
                                      <option value="48H">48H</option>
                                      <option value="72H">72H</option>
                                    </select>
                                  )}
                                </div>
                              </td>

                              {/* Ações da Linha */}
                              <td className="py-1.5 px-1.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEncadearProximoAtendimentoDaLinha(
                                        linha
                                      )
                                    }
                                    title="Criar próxima O.S. deste mesmo poço (copia NE/ND/Vazão Depois para Antes)"
                                    className="p-1 rounded text-[#E8A020] hover:bg-amber-50 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLinhaExpandidaId(
                                        expandida ? null : linha.id
                                      )
                                    }
                                    title="Editar detalhes adicionais (Crivo, Eletrodos, Serviços, Materiais, Equipe, Observações)"
                                    className="p-1 rounded text-sky-600 hover:bg-sky-50 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    {expandida ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => removerLinha(linha.id)}
                                    title="Remover linha"
                                    className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Gaveta Expandida: Campos Complementares da O.S. (Crivo, Eletrodos, Serviços, Materiais, Obs) */}
                            {expandida && (
                              <tr className="bg-[#F7F9FC] dark:bg-slate-950/90">
                                <td colSpan={15} className="p-3.5">
                                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 text-[11px]">
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Local / Endereço do Poço
                                      </label>
                                      <input
                                        type="text"
                                        value={linha.nomeLocalPoco}
                                        onChange={(e) =>
                                          atualizarCampoLinha(
                                            linha.id,
                                            'nomeLocalPoco',
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        CNPJ do Cliente
                                      </label>
                                      <input
                                        type="text"
                                        value={linha.clienteCNPJ}
                                        onChange={(e) =>
                                          atualizarCampoLinha(
                                            linha.id,
                                            'clienteCNPJ',
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Profundidade Total / Ø
                                      </label>
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          value={linha.profundidadeTotal}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'profundidadeTotal',
                                              e.target.value
                                            )
                                          }
                                          placeholder="160,00 m"
                                          className="w-2/3 px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                        />
                                        <input
                                          type="text"
                                          value={linha.diametroRevestimento}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'diametroRevestimento',
                                              e.target.value
                                            )
                                          }
                                          placeholder='6"'
                                          className="w-1/3 px-1.5 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-center"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Crivo (Antes / Depois)
                                      </label>
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          value={linha.crivoAntes}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'crivoAntes',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Antes"
                                          className="w-1/2 px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                        />
                                        <input
                                          type="text"
                                          value={linha.crivoDepois}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'crivoDepois',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Depois"
                                          className="w-1/2 px-2 py-1 rounded border border-[#E8A020]/50 bg-white dark:bg-slate-900 font-mono"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Eletrodo Sup. / Inf.
                                      </label>
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          value={linha.eletrodoSup}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'eletrodoSup',
                                              e.target.value
                                            )
                                          }
                                          placeholder="ES (m)"
                                          className="w-1/2 px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                        />
                                        <input
                                          type="text"
                                          value={linha.eletrodoInf}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'eletrodoInf',
                                              e.target.value
                                            )
                                          }
                                          placeholder="EI (m)"
                                          className="w-1/2 px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 font-mono"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Tubo Edutor / Painel
                                      </label>
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          value={linha.tuboEdutor}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'tuboEdutor',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Edutor"
                                          className="w-1/2 px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                        <input
                                          type="text"
                                          value={linha.painelEletrico}
                                          onChange={(e) =>
                                            atualizarCampoLinha(
                                              linha.id,
                                              'painelEletrico',
                                              e.target.value
                                            )
                                          }
                                          placeholder="Painel"
                                          className="w-1/2 px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                                        />
                                      </div>
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Serviços Executados (separados por | )
                                      </label>
                                      <input
                                        type="text"
                                        value={linha.servicosTexto}
                                        onChange={(e) =>
                                          atualizarCampoLinha(
                                            linha.id,
                                            'servicosTexto',
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Materiais Aplicados (separados por | )
                                      </label>
                                      <input
                                        type="text"
                                        value={linha.materiaisTexto}
                                        onChange={(e) =>
                                          atualizarCampoLinha(
                                            linha.id,
                                            'materiaisTexto',
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] font-bold uppercase text-[#6B7A8D] mb-0.5">
                                        Observações de Campo / Equipe
                                      </label>
                                      <input
                                        type="text"
                                        value={linha.observacoesCampo}
                                        onChange={(e) =>
                                          atualizarCampoLinha(
                                            linha.id,
                                            'observacoesCampo',
                                            e.target.value
                                          )
                                        }
                                        className="w-full px-2 py-1 rounded border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900"
                                      />
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>

                <datalist id="clientes-historico-list">
                  {clientes.map((c) => (
                    <option key={c.uuid} value={c.razaoSocial} />
                  ))}
                </datalist>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 sm:px-6 border-t border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC] dark:bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#6B7A8D] flex flex-wrap items-center gap-3">
            <span>
              <strong>{linhasSelecionadas.length}</strong> Ordens de Serviço selecionadas para salvar
            </span>
            <span>·</span>
            <span>
              Clientes e Poços inéditos serão cadastrados e vinculados automaticamente
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 text-[#6B7A8D] hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={salvandoLote || linhasSelecionadas.length === 0}
              onClick={handleConfirmarImportacaoLote}
              className="px-5 py-2.5 rounded-lg text-xs font-bold bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {salvandoLote ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Clientes, Poços e O.S...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    Criar Poços e Salvar {linhasSelecionadas.length} O.S. no Sistema
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
