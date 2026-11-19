export interface FotoRegistro {
  id: string;
  urlBase64: string;
  blob?: Blob;
  legenda: string;
  timestamp: number;
  ordem: number;
}

export interface AssinaturaDigital {
  dataUrl: string;
  nomeSignatario: string;
  documento?: string; // CPF ou CREA/CAU
  funcao: string;
  dataRegistro: string;
}

export interface DadosCabecalho {
  razaoSocial: string;
  cnpj: string;
  enderecoEmpresa?: string;
  cidadeContatoEmpresa?: string;
  emailEmpresa?: string;
  cliente: string;
  clienteCNPJ?: string;
  contratoOS: string;
  contratoRef?: string;
  tipoServico?: string;
  statusOS?: 'Concluído' | 'Em andamento' | 'Pendente';
  localizacao: string;
  cidadeUF?: string;
  coordenadasGeograficas?: string;
  contatoLocal?: string;
  telefoneContato?: string;
  dataExecucao: string;
  logoBase64?: string;
  responsavelTecnicoNome?: string;
  responsavelTecnicoCREA?: string;
  responsavelElaboracaoNome?: string;
  responsavelElaboracaoCargo?: string;
}

/**
 * Linha da Planilha de Teste de Bombeamento (Anexo I.1)
 */
export interface LeituraBombeamentoGeoeste {
  id: string;
  tMin: number; // 1, 2, 3... 10, 12... 20, 25... 50, 60... 100, 130... 400
  ndM: string; // Ex: "26,90" -> "64,10"
  vazaoM3h: string; // Ex: "10,286"
  areiaPpm?: string;
  observacoes?: string;
}

/**
 * Linha da Planilha de Recuperação (Anexo I.2)
 */
export interface LeituraRecuperacaoGeoeste {
  id: string;
  tMin: number; // 1, 2, 3... 35
  ndM: string; // Ex: "62,40" -> "33,60"
  sCalcM?: string;
  observacoes?: string;
}

/**
 * Etapa individual da Interpretação s = B.Q + C.Q² (Anexo I.3)
 */
export interface EtapaStepDrawdownSEMA {
  id: string;
  etapa: number; // 1, 2, 3...
  duracaoMinutos: number; // Ex: 60, 120 min por degrau
  vazaoM3h: string; // Ex: "6,50", "8,40", "10,29" (m³/h)
  nivelDinamicoM: string; // Ex: "46,20", "54,80", "64,10" (m)
  observacao?: string;
}

/**
 * Estrutura Completa do Teste de Bombeamento ABNT NBR 12244 (Anexos I.1, I.2, I.3)
 */
export interface DadosTesteVazaoSEMA {
  ativo: boolean;
  tipoEnsaio:
    | 'Escalonado (Step-Drawdown)'
    | 'Contínuo 24h + Escalonado'
    | 'Contínuo 24h a Vazão Constante'
    | 'Contínuo 6h a Vazão Constante'
    | 'Contínuo 12h a Vazão Constante'
    | 'Contínuo 36h a Vazão Constante'
    | 'Contínuo 48h a Vazão Constante'
    | 'Contínuo 72h a Vazão Constante'
    | 'Contínuo Personalizado a Vazão Constante';
  etapaLabel?: string; // Ex: "12H", "24H", "48H", "72H"
  referenciaMedidasM?: string; // Ex: "0,00"
  responsavelTecnicoNome?: string; // Ex: "José Roberto Ribeiro"
  responsavelTecnicoCPF?: string;
  responsavelTecnicoCREA?: string; // Ex: "CREA [DADO A PREENCHER EM CAMPO]"
  artNumero?: string;
  // Período do Bombeamento (Anexo I.1)
  dataInicioEnsaio?: string; // Ex: "2026-03-13"
  horaInicioBombeamento?: string; // Ex: "11:30:00"
  dataFinalBombeamento?: string; // Ex: "2026-03-13"
  horaFinalBombeamento?: string; // Ex: "18:10:00"
  // Período da Recuperação (Anexo I.2)
  dataInicioRecuperacao?: string; // Ex: "2026-03-13"
  horaInicioRecuperacao?: string; // Ex: "18:10:00"
  dataFinalRecuperacao?: string; // Ex: "2026-03-13"
  horaFinalRecuperacao?: string; // Ex: "18:45:00"
  tempoRecuperacaoMinutos?: string; // Ex: "35"
  nivelRecuperacaoFinalM?: string; // Ex: "33,60"
  vazaoOutorgaRecomendadaM3h?: string; // Ex: "10,29"
  regimeBombeamentoHorasDia?: string; // Ex: "16"
  leiturasBombeamento?: LeituraBombeamentoGeoeste[];
  leiturasRecuperacao?: LeituraRecuperacaoGeoeste[];
  etapas: EtapaStepDrawdownSEMA[];
}

export interface ModeloCatalogoBomba {
  id: string;
  fabricante: string; // Ex: Ebara, Leão, Schneider, CRI
  modelo: string; // Ex: 4BHS-15, 4R5PB-16, 4BPS3F-11
  diametroMinPocoPol: number; // Ex: 4 ou 6 (polegadas)
  potenciaCV: number; // Ex: 1.5, 3.0, 5.0, 7.5
  estagios: number; // Ex: 11, 15, 18
  vazaoMinM3h: number; // Vazão mínima da curva (m³/h)
  vazaoNominalM3h: number; // Vazão de melhor eficiência BEP (m³/h)
  vazaoMaxM3h: number; // Vazão máxima da curva (m³/h)
  amtMinMca: number; // AMT na vazão máxima (m.c.a.)
  amtNominalMca: number; // AMT na vazão nominal BEP (m.c.a.)
  amtMaxMca: number; // AMT na vazão mínima (m.c.a.)
  bocalRecalquePol: string; // Ex: 1.1/2", 2"
  rendimentoNominalPercent?: number; // Ex: 62
  correnteNominal220MonoA?: number;
  correnteNominal220TriA?: number;
  correnteNominal380TriA?: number;
  isCustom?: boolean;
}

export interface DadosDimensionamentoBomba {
  ativo: boolean; // Se verdadeiro, exibe o quadro de dimensionamento no Relatório e PDF
  diametroEdutorPol: string; // Ex: '1.1/4"', '1.1/2"', '2"', '2.1/2"', '3"'
  materialEdutor:
    | 'Galvanizado (C=120)'
    | 'PVC Geomecânico (C=140)'
    | 'PEAD (C=140)'
    | 'Aço Inox (C=140)';
  desnivelExternoM: string; // Ex: '15,00' (Cota boca do poço -> topo reservatório)
  distanciaAdutoraM: string; // Ex: '80,00' (Extensão horizontal da adutora externa)
  diametroAdutoraMm: string; // Ex: '50' (Diâmetro interno/nominal da adutora em mm)
  materialAdutora: 'PEAD / PVC (C=140)' | 'Aço Galvanizado (C=120)';
  pressaoResidualMca: string; // Ex: '3,00' (Pressão residual na chegada em m.c.a.)
  perdasLocalizadasPercent: string; // Ex: '8' (% de perdas singulares no cavalete/conexões)
  rendimentoBombaPercent: string; // Ex: '58' (Rendimento global estimado η em %)
  tensaoAlimentacao:
    | '220V Monofásico'
    | '254V Monofásico'
    | '220V Trifásico'
    | '380V Trifásico'
    | '440V Trifásico';
  distanciaQuadroBocaM: string; // Ex: '12,00' (Distância do painel até a boca do poço)
  quedaTensaoMaxPercent: string; // Ex: '3,5' (Limite máximo de queda de tensão ΔV%)
  modeloSelecionadoId?: string;
  observacoesDimensionamento?: string;
}

export interface DadosPocoArtesiano {
  incluirNoRelatorio: boolean;
  pocoId: string; // TAG ex: PT01
  profundidadeTotal: string; // ex: 160,00 m
  diametroRevestimento: string; // ex: 6" (152,4 mm) Aço Carbono Schedule 40
  crivoInicial?: string; // Antes da manutenção (frente da O.S. / carimbo Antes)
  crivo: string; // Depois da manutenção / Posição final do crivo
  profundidadeBomba?: string; // ex: 84,00 m (Submergência: 19,90 m acima do ND de 64,10 m)
  aquiferoLitologia?: string; // ex: Sistema Aquífero Parecis (detectado via ANA/SNIRH ou cadastro)
  perfilLitologico?: string; // ex: 0,00 a 24,00 m: Sedimentos Cenozoicos | 24,00 a 160,00 m: Basalto fraturado (Sistema Aquífero Serra Geral / Guarani)
  desenhoConstrutivo?: string; // Seção 4: Descrição de casing, crivo, filtro, cimentação sanitária 0-24m, laje
  parecerHidrogeologico?: string; // Seção 6: Parecer Hidrogeológico e Vazão Recomendada
  nivelEstaticoInicial?: string; // Antes da manutenção (NE Inicial)
  nivelEstatico: string; // Depois da manutenção (NE Final)
  nivelDinamicoInicial?: string; // Antes da manutenção (ND Inicial)
  nivelDinamico: string; // Depois da manutenção (ND Final)
  vazaoInicial?: string; // Antes da manutenção (Vazão Inicial)
  vazaoTeste: string; // Depois da manutenção (Vazão Final / Operação)
  tuboEdutor: string; // ex: [DADO A PREENCHER EM CAMPO]
  eletrodoSuperiorInicial?: string; // Antes da manutenção (ES Inicial)
  eletrodoSuperior: string; // Depois da manutenção (ES Final)
  eletrodoInferiorInicial?: string; // Antes da manutenção (EI Inicial)
  eletrodoInferior: string; // Depois da manutenção (EI Final)
  coordenadasUTM: string; // ex: [DADO A PREENCHER EM CAMPO]
  coordenadasGeograficas?: string; // ex: LAT -21.1767 LON -47.8208
  especificacaoBomba: string; // ex: Ebara 4BHS-15 7,5 CV Trifásica 380V
  motobombaEstado: 'Usado' | 'Novo';
  painelEletrico: string; // ex: [DADO A PREENCHER EM CAMPO]
  painelEstado: 'Usado' | 'Novo';
  testeVazaoSEMA?: DadosTesteVazaoSEMA;
  dimensionamentoBomba?: DadosDimensionamentoBomba;
}

export interface CadastroCliente {
  uuid: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cnpjCpf: string;
  enderecoSede: string;
  cidadeUF: string;
  contatoPrincipal: string;
  telefone: string;
  email?: string;
  observacoes?: string;
  criadoEm: number;
  atualizadoEm: number;
}

/**
 * Cadastro Mestre do Poço Artesiano (Dados Construtivos Fixos + Referência de Cliente/Local)
 * Os dados dinâmicos (NE, ND, Vazão, Motobomba atual) variam a cada RelatorioTecnico vinculado.
 */
export interface CadastroPoco {
  uuid: string;
  clienteUuid?: string; // Vínculo com o CadastroCliente
  tag: string; // Ex: PT01, PT02 - Sede
  nomeIdentificacao: string; // Ex: Poço Principal Irrigação Pivô 01
  cliente: string;
  clienteCNPJ: string;
  enderecoLocal: string;
  cidadeUF: string;
  coordenadasUTM: string;
  contatoLocal: string;
  telefoneContato: string;
  // Dados construtivos permanentes
  profundidadeTotal: string; // Ex: 150m
  diametroRevestimento: string; // Ex: 6 polegadas
  dataPerfuracao?: string; // Ex: 2022-05-14
  numeroOutorga?: string; // Ex: Portaria SEMA-MT Nº 482/2023
  aquiferoLitologia?: string; // Ex: Aquífero Parecis — Arenito
  // Parâmetros de instalação de referência (podem mudar a cada O.S.)
  crivoPadrao: string;
  tuboEdutorPadrao: string;
  eletrodoSuperiorPadrao: string;
  eletrodoInferiorPadrao: string;
  bombaAtual: string;
  painelAtual: string;
  observacoesTecnicas?: string;
  criadoEm: number;
  atualizadoEm: number;
}

export interface MembroEquipe {
  id: string;
  nome: string;
  funcao: string;
}

export interface ItemServicoConduzido {
  id: string;
  descricao: string;
  unidade?: string;
  quantidade: string;
  status: 'Executado' | 'Pendente' | 'Cancelado';
}

export interface ItemMaterialAplicado {
  id: string;
  descricao: string;
  unidade: string;
  quantidade: string;
  situacao: 'Aplicado' | 'Pendente' | 'Cancelado';
}

export interface ItemChecklistConformidade {
  id: string;
  texto: string;
  concluido: boolean;
  dataVerificacao?: string;
  observacao?: string;
}

export interface NarrativasOcorrencias {
  ocorrencias: string;
  pendencias: string;
  recomendacoes: string;
  observacoesGerais: string;
}

export interface SecoesVisiveisRelatorio {
  informacoesGerais?: boolean;      // 1. INFORMAÇÕES GERAIS
  clienteLocal?: boolean;           // 2. CLIENTE E LOCAL
  informacoesPoco?: boolean;        // 3. INFORMAÇÕES DO POÇO
  desenhoConstrutivo?: boolean;     // 4. DESENHO CONSTRUTIVO / PERFIL TÉCNICO DO POÇO
  servicosExecutados?: boolean;     // 5. SERVIÇOS TÉCNICOS EXECUTADOS
  parecerHidrogeologico?: boolean;  // 6. PARECER HIDROGEOLÓGICO E VAZÃO RECOMENDADA
  checklist?: boolean;              // 7. CHECKLIST DE CONFORMIDADE E SEGURANÇA
  recomendacoes?: boolean;          // 8. RECOMENDAÇÕES OPERACIONAIS E MANUTENÇÃO
  fotos?: boolean;                  // 9. REGISTRO FOTOGRÁFICO DE EVIDÊNCIAS
  assinaturas?: boolean;            // 10. TERMO DE ENCERRAMENTO E ASSINATURAS
  anexos?: boolean;                 // ANEXOS I.1, I.2 e I.3 (Planilhas e Gráficos do Teste de Bombeamento)
}

export interface RelatorioTecnico {
  id?: number;
  uuid: string;
  clienteUuid?: string; // Vínculo com o CadastroCliente
  pocoUuid?: string; // Vínculo com o CadastroPoco
  status: 'rascunho' | 'finalizado' | 'exportado';
  cabecalho: DadosCabecalho;
  dadosPoco: DadosPocoArtesiano;
  descricaoServico: string;
  equipe: MembroEquipe[];
  servicosConduzidos: ItemServicoConduzido[];
  materiaisAplicados: ItemMaterialAplicado[];
  checklist: ItemChecklistConformidade[];
  ocorrenciasCampo: NarrativasOcorrencias;
  fotos: FotoRegistro[];
  secoesVisiveis?: SecoesVisiveisRelatorio;
  assinaturaResponsavel?: AssinaturaDigital;
  assinaturaCliente?: AssinaturaDigital;
  criadoEm: number;
  atualizadoEm: number;
}

export interface TemplateServico {
  id: string;
  titulo: string;
  categoria: string;
  conteudo: string;
  isCustom?: boolean;
  criadoEm?: number;
}

export type SecaoNavegacao =
  | 'cadastro_clientes'
  | 'cadastro_pocos'
  | 'conversor_lote'
  | 'identificacao'
  | 'poco'
  | 'servicos'
  | 'materiais'
  | 'checklist'
  | 'fotos'
  | 'ocorrencias'
  | 'assinaturas'
  | 'preview';
