import {
  DadosDimensionamentoBomba,
  DadosPocoArtesiano,
  ModeloCatalogoBomba,
} from '../types/relatorio';
import { fmtNumeroSEMA, parseNumeroSEMA } from '../components/StepDrawdownSection';

const STORAGE_KEY_CATALOGO_BOMBAS = 'relatorpro_catalogo_bombas_custom_v1';

/**
 * Banco de Dados Inicial de Modelos de Bombas Submersas (Ebara, Leão, Schneider, CRI)
 * Cobrindo poços de 4" e 6" e faixas típicas de manutenção/perfuração (1,0 m³/h a 22,0 m³/h).
 */
export const CATALOGO_BOMBAS_PADRAO: ModeloCatalogoBomba[] = [
  {
    id: 'ebara-4bps2f-09',
    fabricante: 'Ebara',
    modelo: '4BPS2F-09',
    diametroMinPocoPol: 4,
    potenciaCV: 0.75,
    estagios: 9,
    vazaoMinM3h: 0.8,
    vazaoNominalM3h: 1.8,
    vazaoMaxM3h: 2.5,
    amtMinMca: 32,
    amtNominalMca: 54,
    amtMaxMca: 68,
    bocalRecalquePol: '1.1/4"',
    rendimentoNominalPercent: 54,
    correnteNominal220MonoA: 5.2,
    correnteNominal220TriA: 3.1,
    correnteNominal380TriA: 1.8,
  },
  {
    id: 'ebara-4bps3f-11',
    fabricante: 'Ebara',
    modelo: '4BPS3F-11',
    diametroMinPocoPol: 4,
    potenciaCV: 1.5,
    estagios: 11,
    vazaoMinM3h: 1.5,
    vazaoNominalM3h: 3.2,
    vazaoMaxM3h: 4.5,
    amtMinMca: 36,
    amtNominalMca: 68,
    amtMaxMca: 88,
    bocalRecalquePol: '1.1/4"',
    rendimentoNominalPercent: 57,
    correnteNominal220MonoA: 9.4,
    correnteNominal220TriA: 5.4,
    correnteNominal380TriA: 3.1,
  },
  {
    id: 'leao-esub-4-9',
    fabricante: 'Leão',
    modelo: 'ESUB 4/9 (4R3PB-09)',
    diametroMinPocoPol: 4,
    potenciaCV: 1.5,
    estagios: 9,
    vazaoMinM3h: 1.8,
    vazaoNominalM3h: 3.8,
    vazaoMaxM3h: 4.8,
    amtMinMca: 30,
    amtNominalMca: 56,
    amtMaxMca: 74,
    bocalRecalquePol: '1.1/4"',
    rendimentoNominalPercent: 58,
    correnteNominal220MonoA: 9.2,
    correnteNominal220TriA: 5.3,
    correnteNominal380TriA: 3.1,
  },
  {
    id: 'ebara-4bps3f-21',
    fabricante: 'Ebara',
    modelo: '4BPS3F-21',
    diametroMinPocoPol: 4,
    potenciaCV: 3.0,
    estagios: 21,
    vazaoMinM3h: 1.5,
    vazaoNominalM3h: 2.8,
    vazaoMaxM3h: 4.2,
    amtMinMca: 78,
    amtNominalMca: 132,
    amtMaxMca: 165,
    bocalRecalquePol: '1.1/2"',
    rendimentoNominalPercent: 58,
    correnteNominal220MonoA: 17.5,
    correnteNominal220TriA: 10.2,
    correnteNominal380TriA: 5.9,
  },
  {
    id: 'schneider-sub30-30cv',
    fabricante: 'Schneider / Franklin',
    modelo: 'SUB 30-16S4A6',
    diametroMinPocoPol: 4,
    potenciaCV: 3.0,
    estagios: 16,
    vazaoMinM3h: 2.5,
    vazaoNominalM3h: 4.5,
    vazaoMaxM3h: 6.2,
    amtMinMca: 58,
    amtNominalMca: 98,
    amtMaxMca: 124,
    bocalRecalquePol: '1.1/2"',
    rendimentoNominalPercent: 60,
    correnteNominal220MonoA: 17.2,
    correnteNominal220TriA: 9.8,
    correnteNominal380TriA: 5.7,
  },
  {
    id: 'leao-4r5pb-16',
    fabricante: 'Leão',
    modelo: '4R5PB-16',
    diametroMinPocoPol: 4,
    potenciaCV: 3.0,
    estagios: 16,
    vazaoMinM3h: 3.0,
    vazaoNominalM3h: 5.0,
    vazaoMaxM3h: 6.8,
    amtMinMca: 52,
    amtNominalMca: 88,
    amtMaxMca: 112,
    bocalRecalquePol: '1.1/2"',
    rendimentoNominalPercent: 61,
    correnteNominal220MonoA: 17.4,
    correnteNominal220TriA: 10.0,
    correnteNominal380TriA: 5.8,
  },
  {
    id: 'ebara-4bps5f-17',
    fabricante: 'Ebara',
    modelo: '4BPS5F-17',
    diametroMinPocoPol: 4,
    potenciaCV: 4.5,
    estagios: 17,
    vazaoMinM3h: 3.2,
    vazaoNominalM3h: 5.4,
    vazaoMaxM3h: 7.2,
    amtMinMca: 68,
    amtNominalMca: 112,
    amtMaxMca: 142,
    bocalRecalquePol: '1.1/2"',
    rendimentoNominalPercent: 61,
    correnteNominal220TriA: 14.8,
    correnteNominal380TriA: 8.5,
  },
  {
    id: 'ebara-4bps8f-13',
    fabricante: 'Ebara',
    modelo: '4BPS8F-13',
    diametroMinPocoPol: 4,
    potenciaCV: 5.0,
    estagios: 13,
    vazaoMinM3h: 5.0,
    vazaoNominalM3h: 8.0,
    vazaoMaxM3h: 10.5,
    amtMinMca: 55,
    amtNominalMca: 84,
    amtMaxMca: 106,
    bocalRecalquePol: '2"',
    rendimentoNominalPercent: 62,
    correnteNominal220TriA: 16.2,
    correnteNominal380TriA: 9.4,
  },
  {
    id: 'cri-4s8-18',
    fabricante: 'CRI Pumps',
    modelo: 'CRI 4S-8/18',
    diametroMinPocoPol: 4,
    potenciaCV: 5.5,
    estagios: 18,
    vazaoMinM3h: 4.8,
    vazaoNominalM3h: 8.0,
    vazaoMaxM3h: 10.8,
    amtMinMca: 68,
    amtNominalMca: 104,
    amtMaxMca: 128,
    bocalRecalquePol: '2"',
    rendimentoNominalPercent: 62,
    correnteNominal220TriA: 17.8,
    correnteNominal380TriA: 10.3,
  },
  {
    id: 'ebara-4bhs-15',
    fabricante: 'Ebara',
    modelo: '4BHS-15 (Inox)',
    diametroMinPocoPol: 4,
    potenciaCV: 7.5,
    estagios: 15,
    vazaoMinM3h: 6.5,
    vazaoNominalM3h: 10.3,
    vazaoMaxM3h: 13.5,
    amtMinMca: 65,
    amtNominalMca: 98,
    amtMaxMca: 126,
    bocalRecalquePol: '2"',
    rendimentoNominalPercent: 64,
    correnteNominal220TriA: 23.6,
    correnteNominal380TriA: 11.4,
  },
  {
    id: 'leao-4r10pb-18',
    fabricante: 'Leão',
    modelo: '4R10PB-18',
    diametroMinPocoPol: 4,
    potenciaCV: 7.5,
    estagios: 18,
    vazaoMinM3h: 6.0,
    vazaoNominalM3h: 10.0,
    vazaoMaxM3h: 13.0,
    amtMinMca: 72,
    amtNominalMca: 108,
    amtMaxMca: 135,
    bocalRecalquePol: '2"',
    rendimentoNominalPercent: 63,
    correnteNominal220TriA: 24.0,
    correnteNominal380TriA: 13.8,
  },
  {
    id: 'schneider-sub70-10cv',
    fabricante: 'Schneider / Franklin',
    modelo: 'SUB 70-16S4',
    diametroMinPocoPol: 6,
    potenciaCV: 10.0,
    estagios: 16,
    vazaoMinM3h: 8.0,
    vazaoNominalM3h: 13.5,
    vazaoMaxM3h: 17.5,
    amtMinMca: 74,
    amtNominalMca: 112,
    amtMaxMca: 142,
    bocalRecalquePol: '2.1/2"',
    rendimentoNominalPercent: 65,
    correnteNominal220TriA: 31.5,
    correnteNominal380TriA: 18.2,
  },
  {
    id: 'leao-6r18-12',
    fabricante: 'Leão',
    modelo: '6R18-12',
    diametroMinPocoPol: 6,
    potenciaCV: 15.0,
    estagios: 12,
    vazaoMinM3h: 12.0,
    vazaoNominalM3h: 18.0,
    vazaoMaxM3h: 24.0,
    amtMinMca: 80,
    amtNominalMca: 122,
    amtMaxMca: 154,
    bocalRecalquePol: '2.1/2"',
    rendimentoNominalPercent: 68,
    correnteNominal220TriA: 46.0,
    correnteNominal380TriA: 26.5,
  },
];

export function criarDimensionamentoBombaPadrao(): DadosDimensionamentoBomba {
  return {
    ativo: false,
    diametroEdutorPol: '1.1/2"',
    materialEdutor: 'Galvanizado (C=120)',
    desnivelExternoM: '15,00',
    distanciaAdutoraM: '50,00',
    diametroAdutoraMm: '50',
    materialAdutora: 'PEAD / PVC (C=140)',
    pressaoResidualMca: '3,00',
    perdasLocalizadasPercent: '8',
    rendimentoBombaPercent: '58',
    tensaoAlimentacao: '220V Trifásico',
    distanciaQuadroBocaM: '10,00',
    quedaTensaoMaxPercent: '3,5',
    modeloSelecionadoId: '',
    observacoesDimensionamento: '',
  };
}

export function obterCatalogoBombasCustomizado(): ModeloCatalogoBomba[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CATALOGO_BOMBAS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function listarCatalogoBombas(): ModeloCatalogoBomba[] {
  const custom = obterCatalogoBombasCustomizado();
  return [...custom, ...CATALOGO_BOMBAS_PADRAO];
}

export function salvarModeloCatalogoBomba(
  novo: Omit<ModeloCatalogoBomba, 'id'> & { id?: string }
): ModeloCatalogoBomba {
  const custom = obterCatalogoBombasCustomizado();
  const id =
    novo.id ||
    `custom-bomba-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const item: ModeloCatalogoBomba = {
    ...novo,
    id,
    isCustom: true,
  };
  const idx = custom.findIndex((b) => b.id === id);
  if (idx >= 0) {
    custom[idx] = item;
  } else {
    custom.unshift(item);
  }
  try {
    localStorage.setItem(STORAGE_KEY_CATALOGO_BOMBAS, JSON.stringify(custom));
  } catch {
    // ignore storage quota errors
  }
  return item;
}

export function excluirModeloCatalogoBomba(id: string): void {
  const custom = obterCatalogoBombasCustomizado().filter((b) => b.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY_CATALOGO_BOMBAS, JSON.stringify(custom));
  } catch {
    // ignore
  }
}

/**
 * Importa modelos de bombas a partir de texto CSV (separado por ; ou ,) ou JSON.
 */
export function importarCatalogoBombasTexto(texto: string): {
  sucesso: boolean;
  importados: number;
  mensagem: string;
} {
  const limpo = texto.trim();
  if (!limpo) {
    return { sucesso: false, importados: 0, mensagem: 'Arquivo vazio.' };
  }

  try {
    if (limpo.startsWith('[') || limpo.startsWith('{')) {
      const json = JSON.parse(limpo);
      const lista = Array.isArray(json) ? json : json.bombas || json.modelos || [];
      let count = 0;
      for (const item of lista) {
        if (item && item.modelo) {
          salvarModeloCatalogoBomba({
            fabricante: String(item.fabricante || 'Genérico').trim(),
            modelo: String(item.modelo).trim(),
            diametroMinPocoPol: Number(item.diametroMinPocoPol) || 4,
            potenciaCV: Number(item.potenciaCV) || 1.5,
            estagios: Number(item.estagios) || 10,
            vazaoMinM3h: Number(item.vazaoMinM3h) || 1.0,
            vazaoNominalM3h: Number(item.vazaoNominalM3h) || 3.0,
            vazaoMaxM3h: Number(item.vazaoMaxM3h) || 5.0,
            amtMinMca: Number(item.amtMinMca) || 30,
            amtNominalMca: Number(item.amtNominalMca) || 70,
            amtMaxMca: Number(item.amtMaxMca) || 100,
            bocalRecalquePol: String(item.bocalRecalquePol || '1.1/2"').trim(),
            rendimentoNominalPercent: Number(item.rendimentoNominalPercent) || 58,
            correnteNominal220MonoA: item.correnteNominal220MonoA
              ? Number(item.correnteNominal220MonoA)
              : undefined,
            correnteNominal220TriA: item.correnteNominal220TriA
              ? Number(item.correnteNominal220TriA)
              : undefined,
            correnteNominal380TriA: item.correnteNominal380TriA
              ? Number(item.correnteNominal380TriA)
              : undefined,
          });
          count++;
        }
      }
      return {
        sucesso: count > 0,
        importados: count,
        mensagem: `${count} modelo(s) de bomba importado(s) via JSON!`,
      };
    }

    // Leitura de CSV (fabricante;modelo;diametroPocoPol;potenciaCV;estagios;vazaoMin;vazaoNominal;vazaoMax;amtMin;amtNominal;amtMax;bocalPol;rendimento)
    const linhas = limpo
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let count = 0;

    for (let i = 0; i < linhas.length; i++) {
      const linha = linhas[i];
      if (
        i === 0 &&
        (linha.toLowerCase().includes('fabricante') ||
          linha.toLowerCase().includes('modelo'))
      ) {
        continue; // pula cabeçalho
      }
      const sep = linha.includes(';') ? ';' : ',';
      const cols = linha.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 7) continue;

      const num = (v: string, fallback: number) => {
        const n = Number(v.replace(',', '.'));
        return Number.isFinite(n) && n > 0 ? n : fallback;
      };

      salvarModeloCatalogoBomba({
        fabricante: cols[0] || 'Fabricante',
        modelo: cols[1] || `Modelo-${i}`,
        diametroMinPocoPol: num(cols[2], 4),
        potenciaCV: num(cols[3], 1.5),
        estagios: Math.round(num(cols[4], 10)),
        vazaoMinM3h: num(cols[5], 1.5),
        vazaoNominalM3h: num(cols[6], 3.5),
        vazaoMaxM3h: num(cols[7], 5.0),
        amtMinMca: num(cols[8], 40),
        amtNominalMca: num(cols[9], 75),
        amtMaxMca: num(cols[10], 95),
        bocalRecalquePol: cols[11] || '1.1/2"',
        rendimentoNominalPercent: num(cols[12], 58),
      });
      count++;
    }

    return {
      sucesso: count > 0,
      importados: count,
      mensagem:
        count > 0
          ? `${count} modelo(s) de bomba importado(s) da planilha CSV!`
          : 'Nenhuma linha válida encontrada no CSV.',
    };
  } catch (err: any) {
    return {
      sucesso: false,
      importados: 0,
      mensagem: err?.message || 'Erro ao ler o arquivo de catálogo.',
    };
  }
}

export function gerarTemplateCSVBombas(): string {
  return [
    'fabricante;modelo;diametroPocoPol;potenciaCV;estagios;vazaoMinM3h;vazaoNominalM3h;vazaoMaxM3h;amtMinMca;amtNominalMca;amtMaxMca;bocalRecalquePol;rendimentoPercent',
    'Ebara;4BPS3F-11;4;1.5;11;1.5;3.2;4.5;36;68;88;1.1/4";57',
    'Leão;4R5PB-16;4;3.0;16;3.0;5.0;6.8;52;88;112;1.1/2";61',
    'Ebara;4BHS-15;4;7.5;15;6.5;10.3;13.5;65;98;126;2";64',
  ].join('\n');
}

function obterDiametroInternoEdutorMetros(polStr: string): number {
  const s = (polStr || '').trim();
  if (s.includes('1.1/4') || s.includes('1 1/4')) return 0.035; // 35 mm
  if (s.includes('1.1/2') || s.includes('1 1/2')) return 0.041; // 41 mm
  if (s.includes('2.1/2') || s.includes('2 1/2')) return 0.065; // 65 mm
  if (s.includes('3')) return 0.078; // 78 mm
  if (s.includes('4')) return 0.102; // 102 mm
  if (s.includes('2')) return 0.052; // 52 mm
  if (s.includes('1')) return 0.027; // 27 mm
  return 0.041; // default 1.1/2"
}

export interface ResultadoDimensionamentoBomba {
  vazaoProjetoM3h: number;
  vazaoProjetoLs: number;
  nivelEstaticoM: number;
  nivelDinamicoM: number;
  profundidadeTotalPocoM: number;
  profundidadeBombaM: number;
  submergenciaM: number;
  submergenciaSegura: boolean;
  precisaCamisaFluxo: boolean;
  desnivelExternoM: number;
  alturaGeometricaTotalM: number;
  perdaCargaEdutorMca: number;
  perdaCargaAdutoraMca: number;
  perdaCargaLocalizadaMca: number;
  pressaoResidualMca: number;
  amtTotalMca: number;
  velocidadeEdutorMs: number;
  velocidadeAdequada: boolean;
  rendimentoDecimal: number;
  potenciaHidraulicaCV: number;
  potenciaMotorRecomendadaCV: number;
  potenciaMotorRecomendadaKW: number;
  correnteEstimadaA: number;
  comprimentoTotalCaboM: number;
  bitolaCaboRecomendadaMm2: number;
  quedaTensaoCalculadaPercent: number;
  modelosRecomendados: {
    bomba: ModeloCatalogoBomba;
    scoreCompatibilidade: number;
    faixaIdeaisTexto: string;
  }[];
}

const POTENCIAS_COMERCIAIS_CV = [
  0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0, 4.5, 5.0, 5.5, 7.5, 10.0, 12.5, 15.0,
  20.0, 25.0, 30.0, 40.0, 50.0,
];

const BITOLAS_CABO_PP_MM2 = [1.5, 2.5, 4.0, 6.0, 10.0, 16.0, 25.0, 35.0, 50.0];

export function calcularDimensionamentoBomba(
  dadosPoco: DadosPocoArtesiano
): ResultadoDimensionamentoBomba {
  const dim = dadosPoco.dimensionamentoBomba || criarDimensionamentoBombaPadrao();

  const qM3h =
    parseNumeroSEMA(dadosPoco.vazaoTeste) ??
    parseNumeroSEMA(dadosPoco.testeVazaoSEMA?.vazaoOutorgaRecomendadaM3h) ??
    4.0;
  const qM3s = Math.max(0.0001, qM3h / 3600);
  const qLs = qM3h / 3.6;

  const neM = parseNumeroSEMA(dadosPoco.nivelEstatico) ?? 20.0;
  const ndM = parseNumeroSEMA(dadosPoco.nivelDinamico) ?? 50.0;
  const profTotalM = parseNumeroSEMA(dadosPoco.profundidadeTotal) ?? 150.0;
  const crivoM = parseNumeroSEMA(dadosPoco.crivo);

  // Profundidade da bomba (L_edutor): utiliza Crivo (posição da bomba), ou sugere cota segura acima do fundo
  const profBombaSugerida = Math.min(
    Math.max(ndM + 12, ndM + 3),
    Math.max(ndM + 2, profTotalM - 2)
  );
  const profBombaM =
    crivoM !== null && crivoM > 0 && crivoM <= profTotalM
      ? crivoM
      : profBombaSugerida;

  const submergenciaM = Math.max(0, profBombaM - ndM);
  const submergenciaSegura = true;
  const precisaCamisaFluxo = false;

  // Parâmetros do Edutor (Hazen-Williams)
  const dEdutorM = obterDiametroInternoEdutorMetros(
    dim.diametroEdutorPol || dadosPoco.tuboEdutor || '1.1/2"'
  );
  const cEdutor = dim.materialEdutor?.includes('120') ? 120 : 140;
  const areaEdutorM2 = (Math.PI * Math.pow(dEdutorM, 2)) / 4;
  const velocidadeEdutorMs = qM3s / areaEdutorM2;
  const velocidadeAdequada =
    velocidadeEdutorMs >= 0.4 && velocidadeEdutorMs <= 2.6;

  // J = 10.643 * Q^1.85 * C^-1.85 * D^-4.87
  const jEdutor =
    10.643 *
    Math.pow(qM3s, 1.85) *
    Math.pow(cEdutor, -1.85) *
    Math.pow(dEdutorM, -4.87);
  const perdaCargaEdutorMca = jEdutor * profBombaM;

  // Parâmetros da Adutora Externa
  const desnivelExternoM = parseNumeroSEMA(dim.desnivelExternoM) ?? 15.0;
  const distanciaAdutoraM = parseNumeroSEMA(dim.distanciaAdutoraM) ?? 50.0;
  const dAdutoraMm = parseNumeroSEMA(dim.diametroAdutoraMm) ?? 50;
  const dAdutoraM = Math.max(0.02, (dAdutoraMm * 0.9) / 1000); // diâmetro interno útil aproximado
  const cAdutora = dim.materialAdutora?.includes('120') ? 120 : 140;

  const jAdutora =
    10.643 *
    Math.pow(qM3s, 1.85) *
    Math.pow(cAdutora, -1.85) *
    Math.pow(dAdutoraM, -4.87);
  const perdaCargaAdutoraMca = jAdutora * distanciaAdutoraM;

  // Perdas localizadas e pressão residual
  const percLoc = (parseNumeroSEMA(dim.perdasLocalizadasPercent) ?? 8) / 100;
  const perdaCargaLocalizadaMca =
    (perdaCargaEdutorMca + perdaCargaAdutoraMca) * percLoc;
  const pressaoResidualMca = parseNumeroSEMA(dim.pressaoResidualMca) ?? 3.0;

  const alturaGeometricaTotalM = ndM + desnivelExternoM;
  const amtTotalMca =
    alturaGeometricaTotalM +
    perdaCargaEdutorMca +
    perdaCargaAdutoraMca +
    perdaCargaLocalizadaMca +
    pressaoResidualMca;

  // Potência Hidráulica e Comercial (CV)
  const rendPerc = Math.min(
    85,
    Math.max(25, parseNumeroSEMA(dim.rendimentoBombaPercent) ?? 58)
  );
  const rendimentoDecimal = rendPerc / 100;
  // P (CV) = (Q [m³/h] * AMT [m.c.a.]) / (270 * η)
  const potenciaHidraulicaCV =
    (qM3h * amtTotalMca) / (270 * rendimentoDecimal);
  // Margem de segurança de 10% para escolha do motor comercial
  const potenciaComFolgaCV = potenciaHidraulicaCV * 1.08;
  const potenciaMotorRecomendadaCV =
    POTENCIAS_COMERCIAIS_CV.find((p) => p >= potenciaComFolgaCV) ||
    POTENCIAS_COMERCIAIS_CV[POTENCIAS_COMERCIAIS_CV.length - 1];
  const potenciaMotorRecomendadaKW = potenciaMotorRecomendadaCV * 0.7355;

  // Dimensionamento Elétrico e Queda de Tensão no Cabo PP Submersível
  const tensaoStr = dim.tensaoAlimentacao || '220V Trifásico';
  const ehTrifasico = tensaoStr.toLowerCase().includes('trif');
  const tensaoVolts = tensaoStr.includes('380')
    ? 380
    : tensaoStr.includes('440')
    ? 440
    : tensaoStr.includes('254')
    ? 254
    : 220;

  const cosPhi = 0.82;
  const rendMotorEletrico = 0.78;
  const potenciaEletricaW =
    (potenciaMotorRecomendadaCV * 735.5) / rendMotorEletrico;
  const correnteEstimadaA = ehTrifasico
    ? potenciaEletricaW / (Math.sqrt(3) * tensaoVolts * cosPhi)
    : potenciaEletricaW / (tensaoVolts * cosPhi);

  const distQuadroM = parseNumeroSEMA(dim.distanciaQuadroBocaM) ?? 10.0;
  const comprimentoTotalCaboM = profBombaM + distQuadroM;
  const quedaMaxPerc =
    parseNumeroSEMA(dim.quedaTensaoMaxPercent) ?? 3.5;

  // Resistividade do cobre a ~50°C: ρ = 0.0195 Ω·mm²/m
  const rhoCobre = 0.0195;
  const fatorFase = ehTrifasico ? Math.sqrt(3) : 2.0;

  let bitolaCaboRecomendadaMm2 = 2.5;
  let quedaTensaoCalculadaPercent = 0;

  for (const bitola of BITOLAS_CABO_PP_MM2) {
    if (bitola < 2.5) continue; // mínimo normativo usual para bomba submersa
    const deltaV =
      (fatorFase * rhoCobre * comprimentoTotalCaboM * correnteEstimadaA) /
      bitola;
    const deltaVPerc = (deltaV / tensaoVolts) * 100;
    bitolaCaboRecomendadaMm2 = bitola;
    quedaTensaoCalculadaPercent = deltaVPerc;
    if (deltaVPerc <= quedaMaxPerc) {
      break;
    }
  }

  // Cruzamento com o Banco de Dados / Catálogo de Modelos de Bombas
  const diamPocoPol =
    parseNumeroSEMA(dadosPoco.diametroRevestimento) ?? 6;
  const catalogo = listarCatalogoBombas();

  const modelosRecomendados = catalogo
    .filter((b) => b.diametroMinPocoPol <= diamPocoPol)
    .map((bomba) => {
      const dentroFaixaQ =
        qM3h >= bomba.vazaoMinM3h * 0.85 && qM3h <= bomba.vazaoMaxM3h * 1.15;
      const dentroFaixaAMT =
        amtTotalMca >= bomba.amtMinMca * 0.8 &&
        amtTotalMca <= bomba.amtMaxMca * 1.15;

      const erroRelQ =
        Math.abs(qM3h - bomba.vazaoNominalM3h) /
        Math.max(1, bomba.vazaoNominalM3h);
      const erroRelAMT =
        Math.abs(amtTotalMca - bomba.amtNominalMca) /
        Math.max(10, bomba.amtNominalMca);

      let score = 100 - (erroRelQ * 45 + erroRelAMT * 55);
      if (dentroFaixaQ && dentroFaixaAMT) score += 15;
      if (!dentroFaixaQ || !dentroFaixaAMT) score -= 25;
      score = Math.max(5, Math.min(99, Math.round(score)));

      return {
        bomba,
        scoreCompatibilidade: score,
        faixaIdeaisTexto: `Q: ${fmtNumeroSEMA(
          bomba.vazaoMinM3h,
          1
        )} a ${fmtNumeroSEMA(bomba.vazaoMaxM3h, 1)} m³/h (Nom: ${fmtNumeroSEMA(
          bomba.vazaoNominalM3h,
          1
        )}) | AMT: ${bomba.amtMinMca} a ${bomba.amtMaxMca} m.c.a. (Nom: ${
          bomba.amtNominalMca
        } m.c.a.)`,
      };
    })
    .sort((a, b) => b.scoreCompatibilidade - a.scoreCompatibilidade)
    .slice(0, 5);

  return {
    vazaoProjetoM3h: qM3h,
    vazaoProjetoLs: qLs,
    nivelEstaticoM: neM,
    nivelDinamicoM: ndM,
    profundidadeTotalPocoM: profTotalM,
    profundidadeBombaM: profBombaM,
    submergenciaM,
    submergenciaSegura,
    precisaCamisaFluxo,
    desnivelExternoM,
    alturaGeometricaTotalM,
    perdaCargaEdutorMca,
    perdaCargaAdutoraMca,
    perdaCargaLocalizadaMca,
    pressaoResidualMca,
    amtTotalMca,
    velocidadeEdutorMs,
    velocidadeAdequada,
    rendimentoDecimal,
    potenciaHidraulicaCV,
    potenciaMotorRecomendadaCV,
    potenciaMotorRecomendadaKW,
    correnteEstimadaA,
    comprimentoTotalCaboM,
    bitolaCaboRecomendadaMm2,
    quedaTensaoCalculadaPercent,
    modelosRecomendados,
  };
}
