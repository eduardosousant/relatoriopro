import { CadastroPoco, RelatorioTecnico } from '../types/relatorio';
import { extrairCoordenadasGeograficas } from '../utils/coordenadasParser';

export interface PocoReferenciaAquifero {
  id: string;
  fonte: 'ANA' | 'Supabase';
  identificacao: string;
  aquifero: string;
  municipio: string;
  uf: string;
  distanciaKm: number | null;
  profundidadeM: number | null;
  neM: number | null;
  ndM: number | null;
  vazaoM3h: number | null;
  tipoPoco?: string;
  numeroOutorga?: string;
}

export interface RankingAquifero {
  nome: string;
  percentual: number;
  ocorrencias: number;
  fontesAna: number;
  fontesSupabase: number;
  generico?: boolean;
}

export interface EstatisticaMetrica {
  media: number;
  min: number;
  max: number;
  amostras: number;
}

export interface ResumoHidrodinamicoVizinhos {
  profundidadeM: EstatisticaMetrica | null;
  neM: EstatisticaMetrica | null;
  ndM: EstatisticaMetrica | null;
  vazaoM3h: EstatisticaMetrica | null;
}

export interface ResultadoConsultaAquifero {
  sucesso: boolean;
  modoBusca: 'coordenadas' | 'municipio' | 'supabase_apenas' | 'nenhum';
  raioKm: number | null;
  coordenadasUtilizadas: { lat: number; lng: number; origem: string } | null;
  municipioConsultado: string;
  ufConsultada: string;
  aquiferoSugerido: string | null;
  confianca: 'alta' | 'media' | 'estimativa';
  ranking: RankingAquifero[];
  totalPocosAnalisados: number;
  totalAna: number;
  totalSupabase: number;
  resumoHidrodinamico: ResumoHidrodinamicoVizinhos;
  pocosReferencia: PocoReferenciaAquifero[];
  aviso?: string;
}

export interface ConsultaAquiferoParams {
  coordenadasGeograficas?: string;
  coordenadasUTM?: string;
  cidadeUF?: string;
  endereco?: string;
  pocosSupabase?: CadastroPoco[];
  relatoriosSupabase?: RelatorioTecnico[];
  pocoIgnorarUuid?: string;
}

const UFS_BRASIL = new Set([
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]);

const AQUIFEROS_GENERICOS = new Set([
  'OUTRO',
  'OUTROS',
  'NAO INFORMADO',
  'SEM INFORMACAO',
  'INDEFINIDO',
  'DESCONHECIDO',
  'N/A',
  '-',
]);

function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function isAquiferoEspecifico(nome?: string): boolean {
  if (!nome) return false;
  const norm = removerAcentos(nome);
  if (!norm) return false;
  return !AQUIFEROS_GENERICOS.has(norm);
}

/**
 * Extrai número positivo de textos técnicos como "150,5m", "18.2 m³/h", "42,00 m"
 */
function extrairNumeroMetrico(texto?: string | number | null): number | null {
  if (typeof texto === 'number') {
    return Number.isFinite(texto) && texto > 0 ? texto : null;
  }
  if (!texto || typeof texto !== 'string') return null;
  if (texto.includes('[DADO A PREENCHER')) return null;
  const match = texto.replace(',', '.').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0]);
  return Number.isFinite(num) && num > 0 ? num : null;
}

/**
 * Distância geodésica entre dois pontos (Fórmula de Haversine) em quilômetros
 */
export function calcularDistanciaKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Extrai Município e UF a partir de campos como "Sorriso - MT", "Cuiabá/MT", "Sinop, MT"
 */
export function extrairMunicipioEUF(
  cidadeUF?: string,
  endereco?: string
): { municipio: string; uf: string } {
  const candidatos = [cidadeUF, endereco].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0
  );

  for (const textoBruto of candidatos) {
    const texto = textoBruto
      .replace(/\[DADO A PREENCHER[^\]]*\]/gi, '')
      .trim();
    if (!texto) continue;

    // Padrão "Município - UF", "Município / UF", "Município, UF", "Município (UF)"
    const matchComSeparador = texto.match(
      /([A-Za-zÀ-ÿ0-9\s.'-]+?)\s*(?:[-/,|]|\()\s*([A-Za-z]{2})\)?(?:\s|$|\.)/
    );
    if (matchComSeparador) {
      const uf = matchComSeparador[2].toUpperCase();
      if (UFS_BRASIL.has(uf)) {
        // Caso o endereço tenha vírgulas antes da cidade, pega o último segmento antes do separador da UF
        const partesAntes = matchComSeparador[1]
          .split(/[,;—–]/)
          .map((p) => p.trim())
          .filter(Boolean);
        const municipio = partesAntes[partesAntes.length - 1] || '';
        if (municipio.length >= 2) {
          return { municipio, uf };
        }
      }
    }

    // Padrão "Sorriso MT" no fim da string
    const matchFinal = texto.match(/([A-Za-zÀ-ÿ\s.'-]{2,})\s+([A-Za-z]{2})$/);
    if (matchFinal) {
      const uf = matchFinal[2].toUpperCase();
      if (UFS_BRASIL.has(uf)) {
        return { municipio: matchFinal[1].trim(), uf };
      }
    }

    // Se veio do campo cidadeUF sem UF explícita, ainda aproveita o nome do município
    if (textoBruto === cidadeUF && texto.length >= 3 && texto.length <= 50) {
      return { municipio: texto, uf: '' };
    }
  }

  return { municipio: '', uf: '' };
}

function calcularEstatistica(
  valores: Array<number | null>,
  limiteMaximo: number
): EstatisticaMetrica | null {
  const validos = valores.filter(
    (v): v is number =>
      typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= limiteMaximo
  );
  if (validos.length === 0) return null;

  const soma = validos.reduce((acc, v) => acc + v, 0);
  return {
    media: Number((soma / validos.length).toFixed(1)),
    min: Number(Math.min(...validos).toFixed(1)),
    max: Number(Math.max(...validos).toFixed(1)),
    amostras: validos.length,
  };
}

function buscarUltimaMedicaoPocoSupabase(
  poco: CadastroPoco,
  relatorios: RelatorioTecnico[]
): { neM: number | null; ndM: number | null; vazaoM3h: number | null } {
  if (!relatorios.length) {
    return { neM: null, ndM: null, vazaoM3h: null };
  }

  const doPoco = relatorios
    .filter(
      (r) =>
        r.pocoUuid === poco.uuid ||
        (r.dadosPoco?.pocoId &&
          poco.tag &&
          r.dadosPoco.pocoId.trim().toLowerCase() ===
            poco.tag.trim().toLowerCase() &&
          removerAcentos(r.cabecalho?.cliente || '') ===
            removerAcentos(poco.cliente || ''))
    )
    .sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0));

  for (const rel of doPoco) {
    const neM =
      extrairNumeroMetrico(rel.dadosPoco?.nivelEstatico) ??
      extrairNumeroMetrico(rel.dadosPoco?.nivelEstaticoInicial);
    const ndM =
      extrairNumeroMetrico(rel.dadosPoco?.nivelDinamico) ??
      extrairNumeroMetrico(rel.dadosPoco?.nivelDinamicoInicial);
    const vazaoM3h =
      extrairNumeroMetrico(rel.dadosPoco?.vazaoTeste) ??
      extrairNumeroMetrico(rel.dadosPoco?.vazaoInicial);

    if (neM !== null || ndM !== null || vazaoM3h !== null) {
      return { neM, ndM, vazaoM3h };
    }
  }

  return { neM: null, ndM: null, vazaoM3h: null };
}

/**
 * Consulta a API pública da ANA/SNIRH via proxy /api/ana-aquifero e combina com os poços do Supabase
 * para sugerir o Aquífero / Formação Geológica e gerar resumo hidrodinâmico de referência (somente leitura).
 */
export async function consultarAquiferoEReferencia(
  params: ConsultaAquiferoParams
): Promise<ResultadoConsultaAquifero> {
  const {
    coordenadasGeograficas,
    coordenadasUTM,
    cidadeUF,
    endereco,
    pocosSupabase = [],
    relatoriosSupabase = [],
    pocoIgnorarUuid,
  } = params;

  const coordDetectada = extrairCoordenadasGeograficas(
    coordenadasGeograficas,
    coordenadasUTM
  );
  const { municipio, uf } = extrairMunicipioEUF(cidadeUF, endereco);

  if (!coordDetectada && !municipio && !uf) {
    return {
      sucesso: false,
      modoBusca: 'nenhum',
      raioKm: null,
      coordenadasUtilizadas: null,
      municipioConsultado: '',
      ufConsultada: '',
      aquiferoSugerido: null,
      confianca: 'estimativa',
      ranking: [],
      totalPocosAnalisados: 0,
      totalAna: 0,
      totalSupabase: 0,
      resumoHidrodinamico: {
        profundidadeM: null,
        neM: null,
        ndM: null,
        vazaoM3h: null,
      },
      pocosReferencia: [],
      aviso:
        'Preencha as Coordenadas (Lat/Long ou UTM) ou o campo Cidade / UF para detectar o aquífero ou estimar pelos poços vizinhos.',
    };
  }

  // 1. Consulta proxy /api/ana-aquifero (ANA/SNIRH)
  let pocosAna: PocoReferenciaAquifero[] = [];
  let modoAna: 'coordenadas' | 'municipio' | 'erro' | 'nenhum' = 'nenhum';
  let raioKmAna: number | null = null;
  let avisoAna: string | undefined;

  try {
    const qs = new URLSearchParams();
    if (coordDetectada) {
      qs.set('lat', String(coordDetectada.lat));
      qs.set('lng', String(coordDetectada.lng));
    }
    if (municipio) qs.set('municipio', municipio);
    if (uf) qs.set('uf', uf);

    const resp = await fetch(`/api/ana-aquifero?${qs.toString()}`);
    const payload = await resp.json();

    if (payload?.sucesso && Array.isArray(payload.pocos)) {
      modoAna = payload.modoBusca || (coordDetectada ? 'coordenadas' : 'municipio');
      raioKmAna = typeof payload.raioKm === 'number' ? payload.raioKm : null;
      if (payload.aviso) avisoAna = payload.aviso;

      pocosAna = payload.pocos.map((p: any, idx: number) => {
        const dist =
          coordDetectada &&
          typeof p.lat === 'number' &&
          typeof p.lng === 'number'
            ? calcularDistanciaKm(
                coordDetectada.lat,
                coordDetectada.lng,
                p.lat,
                p.lng
              )
            : null;

        return {
          id: `ana-${idx}-${p.numeroOutorga || 'snirh'}`,
          fonte: 'ANA' as const,
          identificacao: p.numeroOutorga
            ? `Outorga ${p.numeroOutorga}`
            : p.tipoPoco || 'Poço Outorgado ANA',
          aquifero: typeof p.aquifero === 'string' ? p.aquifero.trim() : '',
          municipio: typeof p.municipio === 'string' ? p.municipio.trim() : '',
          uf: typeof p.uf === 'string' ? p.uf.trim().toUpperCase() : '',
          distanciaKm: dist,
          profundidadeM:
            typeof p.profundidadeM === 'number' && p.profundidadeM > 0
              ? p.profundidadeM
              : null,
          neM: typeof p.neM === 'number' && p.neM > 0 ? p.neM : null,
          ndM: typeof p.ndM === 'number' && p.ndM > 0 ? p.ndM : null,
          vazaoM3h:
            typeof p.vazaoM3h === 'number' && p.vazaoM3h > 0 ? p.vazaoM3h : null,
          tipoPoco: p.tipoPoco || undefined,
          numeroOutorga: p.numeroOutorga || undefined,
        };
      });
    } else {
      modoAna = 'erro';
      avisoAna =
        payload?.aviso ||
        'Não foi possível obter resposta da API da ANA/SNIRH no momento.';
    }
  } catch (err: any) {
    modoAna = 'erro';
    avisoAna =
      err?.message ||
      'Falha de rede ao consultar a base pública da ANA/SNIRH.';
  }

  // 2. Combina com os poços cadastrados do usuário no Supabase (mesma região ou raio <= 35 km)
  const munNormAlvo = removerAcentos(municipio);
  const ufNormAlvo = uf.toUpperCase();
  const pocosLocaisFiltrados: PocoReferenciaAquifero[] = [];

  for (const poco of pocosSupabase) {
    if (pocoIgnorarUuid && poco.uuid === pocoIgnorarUuid) continue;

    const coordPoco = extrairCoordenadasGeograficas(poco.coordenadasUTM);
    const parsedCidade = extrairMunicipioEUF(poco.cidadeUF, poco.enderecoLocal);
    const dist =
      coordDetectada && coordPoco
        ? calcularDistanciaKm(
            coordDetectada.lat,
            coordDetectada.lng,
            coordPoco.lat,
            coordPoco.lng
          )
        : null;

    const mesmaDistancia = dist !== null && dist <= 35;
    const mesmoMunicipio =
      Boolean(munNormAlvo) &&
      Boolean(parsedCidade.municipio) &&
      removerAcentos(parsedCidade.municipio) === munNormAlvo &&
      (!ufNormAlvo || !parsedCidade.uf || parsedCidade.uf === ufNormAlvo);
    const mesmaUF =
      !munNormAlvo &&
      Boolean(ufNormAlvo) &&
      parsedCidade.uf === ufNormAlvo;

    if (!mesmaDistancia && !mesmoMunicipio && !mesmaUF) continue;

    const ultimasMedicoes = buscarUltimaMedicaoPocoSupabase(
      poco,
      relatoriosSupabase
    );

    pocosLocaisFiltrados.push({
      id: `supa-${poco.uuid}`,
      fonte: 'Supabase',
      identificacao: `${poco.tag}${poco.cliente ? ` · ${poco.cliente}` : ''}`,
      aquifero: (poco.aquiferoLitologia || '').trim(),
      municipio: parsedCidade.municipio || poco.cidadeUF || '',
      uf: parsedCidade.uf || ufNormAlvo,
      distanciaKm: dist,
      profundidadeM: extrairNumeroMetrico(poco.profundidadeTotal),
      neM: ultimasMedicoes.neM,
      ndM: ultimasMedicoes.ndM,
      vazaoM3h: ultimasMedicoes.vazaoM3h,
    });
  }

  const todosPocos: PocoReferenciaAquifero[] = [
    ...pocosLocaisFiltrados,
    ...pocosAna,
  ];

  // 3. Calcula ranking ponderado por distância (dando prioridade a aquíferos específicos sobre "Outro")
  const temAlgumEspecifico = todosPocos.some((p) =>
    isAquiferoEspecifico(p.aquifero)
  );

  interface AcumuladorRanking {
    nomeExibicao: string;
    pesoTotal: number;
    ocorrencias: number;
    fontesAna: number;
    fontesSupabase: number;
    generico: boolean;
  }

  const mapaRanking = new Map<string, AcumuladorRanking>();

  for (const poco of todosPocos) {
    const nomeLimpo = poco.aquifero.trim();
    if (!nomeLimpo) continue;

    const especifico = isAquiferoEspecifico(nomeLimpo);
    if (temAlgumEspecifico && !especifico) continue;

    const chave = removerAcentos(nomeLimpo);
    const pesoDistancia =
      poco.distanciaKm !== null ? 1 / (poco.distanciaKm + 1) : 1;
    const bonusFonte = poco.fonte === 'Supabase' ? 1.15 : 1.0;
    const peso = pesoDistancia * bonusFonte;

    const atual = mapaRanking.get(chave);
    if (atual) {
      atual.pesoTotal += peso;
      atual.ocorrencias += 1;
      if (poco.fonte === 'ANA') atual.fontesAna += 1;
      else atual.fontesSupabase += 1;
      // Prefere a grafia mais descritiva/legível
      if (
        nomeLimpo.length > atual.nomeExibicao.length &&
        nomeLimpo !== nomeLimpo.toUpperCase()
      ) {
        atual.nomeExibicao = nomeLimpo;
      }
    } else {
      mapaRanking.set(chave, {
        nomeExibicao: nomeLimpo,
        pesoTotal: peso,
        ocorrencias: 1,
        fontesAna: poco.fonte === 'ANA' ? 1 : 0,
        fontesSupabase: poco.fonte === 'Supabase' ? 1 : 0,
        generico: !especifico,
      });
    }
  }

  const somaPesos = Array.from(mapaRanking.values()).reduce(
    (acc, item) => acc + item.pesoTotal,
    0
  );

  const ranking: RankingAquifero[] = Array.from(mapaRanking.values())
    .sort((a, b) => b.pesoTotal - a.pesoTotal)
    .slice(0, 6)
    .map((item) => ({
      nome: item.nomeExibicao,
      percentual:
        somaPesos > 0 ? Math.round((item.pesoTotal / somaPesos) * 100) : 0,
      ocorrencias: item.ocorrencias,
      fontesAna: item.fontesAna,
      fontesSupabase: item.fontesSupabase,
      generico: item.generico,
    }));

  const aquiferoSugerido =
    ranking.length > 0 && !ranking[0].generico
      ? ranking[0].nome
      : ranking[0]?.nome || null;

  // 4. Determina modo final e grau de confiança
  let modoFinal: ResultadoConsultaAquifero['modoBusca'] = 'nenhum';
  if (pocosAna.length > 0 && modoAna === 'coordenadas') {
    modoFinal = 'coordenadas';
  } else if (pocosAna.length > 0 && modoAna === 'municipio') {
    modoFinal = 'municipio';
  } else if (pocosLocaisFiltrados.length > 0) {
    modoFinal = coordDetectada &&
      pocosLocaisFiltrados.some((p) => p.distanciaKm !== null)
      ? 'coordenadas'
      : 'supabase_apenas';
  } else {
    modoFinal = coordDetectada ? 'coordenadas' : 'municipio';
  }

  const totalComAquiferoEspecifico = todosPocos.filter((p) =>
    isAquiferoEspecifico(p.aquifero)
  ).length;

  let confianca: ResultadoConsultaAquifero['confianca'] = 'estimativa';
  if (
    modoFinal === 'coordenadas' &&
    totalComAquiferoEspecifico >= 3 &&
    (ranking[0]?.percentual || 0) >= 55
  ) {
    confianca = 'alta';
  } else if (totalComAquiferoEspecifico >= 2) {
    confianca = 'media';
  }

  // 5. Resumo hidrodinâmico de referência (NUNCA sobrescreve dados do usuário)
  const resumoHidrodinamico: ResumoHidrodinamicoVizinhos = {
    profundidadeM: calcularEstatistica(
      todosPocos.map((p) => p.profundidadeM),
      2500
    ),
    neM: calcularEstatistica(
      todosPocos.map((p) => p.neM),
      1500
    ),
    ndM: calcularEstatistica(
      todosPocos.map((p) => p.ndM),
      1500
    ),
    vazaoM3h: calcularEstatistica(
      todosPocos.map((p) => p.vazaoM3h),
      5000
    ),
  };

  // 6. Ordena poços de referência para tabela comparativa (Top 8)
  const pontuarCompletude = (p: PocoReferenciaAquifero) => {
    let score = 0;
    if (isAquiferoEspecifico(p.aquifero)) score += 4;
    if (p.profundidadeM !== null) score += 2;
    if (p.neM !== null) score += 1;
    if (p.ndM !== null) score += 1;
    if (p.vazaoM3h !== null) score += 2;
    if (p.fonte === 'Supabase') score += 1;
    return score;
  };

  const pocosReferencia = [...todosPocos]
    .sort((a, b) => {
      if (a.distanciaKm !== null && b.distanciaKm !== null) {
        return a.distanciaKm - b.distanciaKm;
      }
      if (a.distanciaKm !== null) return -1;
      if (b.distanciaKm !== null) return 1;
      return pontuarCompletude(b) - pontuarCompletude(a);
    })
    .slice(0, 8);

  let avisoFinal = avisoAna;
  if (modoAna === 'erro' && pocosLocaisFiltrados.length > 0) {
    avisoFinal = `${avisoAna} Estimativa gerada usando ${pocosLocaisFiltrados.length} poço(s) do seu cadastro Supabase na região.`;
  } else if (todosPocos.length === 0 && !avisoFinal) {
    avisoFinal =
      'Nenhum poço de referência encontrado na ANA/SNIRH nem no Supabase para esta localização.';
  }

  return {
    sucesso: todosPocos.length > 0,
    modoBusca: modoFinal,
    raioKm:
      modoFinal === 'coordenadas'
        ? raioKmAna ?? (pocosLocaisFiltrados.length > 0 ? 35 : null)
        : null,
    coordenadasUtilizadas: coordDetectada
      ? {
          lat: coordDetectada.lat,
          lng: coordDetectada.lng,
          origem: coordenadasGeograficas?.trim() ? 'Lat/Long' : 'UTM convertida',
        }
      : null,
    municipioConsultado: municipio,
    ufConsultada: uf,
    aquiferoSugerido,
    confianca,
    ranking,
    totalPocosAnalisados: todosPocos.length,
    totalAna: pocosAna.length,
    totalSupabase: pocosLocaisFiltrados.length,
    resumoHidrodinamico,
    pocosReferencia,
    aviso: avisoFinal,
  };
}
