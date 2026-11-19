const SNIRH_OUTORGAS_QUERY_URL =
  'https://portal1.snirh.gov.br/server/rest/services/Hosted/outorgas_estaduais_subterraneas/FeatureServer/0/query';

const OUT_FIELDS = [
  'tap_ds',
  'ing_nm_municipio',
  'ing_sg_ufmunicipio',
  'int_nu_latitude',
  'int_nu_longitude',
  'asb_nu_profundidadefinal',
  'tst_nu_ne',
  'tst_nu_nd',
  'tst_vz_estabilizacao',
  'tnp_ds',
  'out_nu_ato',
].join(',');

interface PocoAnaBruto {
  aquifero: string;
  municipio: string;
  uf: string;
  lat: number | null;
  lng: number | null;
  profundidadeM: number | null;
  neM: number | null;
  ndM: number | null;
  vazaoM3h: number | null;
  tipoPoco: string;
  numeroOutorga: string;
}

function removerAcentos(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function sanitizarSqlTexto(texto: string): string {
  return texto
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function paraNumeroValido(valor: unknown): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor.trim()) {
    const num = Number(valor.replace(',', '.'));
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function isAquiferoEspecifico(nome: string): boolean {
  const norm = removerAcentos(nome);
  if (!norm) return false;
  const genericos = new Set([
    'OUTRO',
    'OUTROS',
    'NAO INFORMADO',
    'SEM INFORMACAO',
    'INDEFINIDO',
    'DESCONHECIDO',
    'N/A',
    '-',
  ]);
  return !genericos.has(norm);
}

function normalizarFeature(feature: any): PocoAnaBruto {
  const a = feature?.attributes || {};
  const g = feature?.geometry || {};

  const lat = paraNumeroValido(a.int_nu_latitude) ?? paraNumeroValido(g.y);
  const lng = paraNumeroValido(a.int_nu_longitude) ?? paraNumeroValido(g.x);

  return {
    aquifero: typeof a.tap_ds === 'string' ? a.tap_ds.trim() : '',
    municipio:
      typeof a.ing_nm_municipio === 'string' ? a.ing_nm_municipio.trim() : '',
    uf:
      typeof a.ing_sg_ufmunicipio === 'string'
        ? a.ing_sg_ufmunicipio.trim().toUpperCase()
        : '',
    lat,
    lng,
    profundidadeM: paraNumeroValido(a.asb_nu_profundidadefinal),
    neM: paraNumeroValido(a.tst_nu_ne),
    ndM: paraNumeroValido(a.tst_nu_nd),
    vazaoM3h: paraNumeroValido(a.tst_vz_estabilizacao),
    tipoPoco: typeof a.tnp_ds === 'string' ? a.tnp_ds.trim() : '',
    numeroOutorga:
      typeof a.out_nu_ato === 'string' ? a.out_nu_ato.trim() : '',
  };
}

async function consultarSnirh(
  params: Record<string, string>,
  timeoutMs = 10000
): Promise<PocoAnaBruto[]> {
  const searchParams = new URLSearchParams({
    outFields: OUT_FIELDS,
    outSR: '4326',
    resultRecordCount: '150',
    f: 'json',
    ...params,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(
      `${SNIRH_OUTORGAS_QUERY_URL}?${searchParams.toString()}`,
      {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'RelatorPRO-Hidrogeologia/1.0',
        },
      }
    );

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ao consultar API ANA/SNIRH`);
    }

    const data: any = await resp.json();
    if (data?.error) {
      throw new Error(
        data.error?.message || 'Erro retornado pelo serviço ArcGIS ANA/SNIRH'
      );
    }

    const features = Array.isArray(data?.features) ? data.features : [];
    return features.map(normalizarFeature);
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req: any, res: any) {
  try {
    const latRaw = String(req.query?.lat ?? '').trim();
    const lngRaw = String(req.query?.lng ?? '').trim();
    const municipioRaw = String(req.query?.municipio ?? '').trim();
    const ufRaw = String(req.query?.uf ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 2);

    const lat = latRaw ? Number(latRaw) : NaN;
    const lng = lngRaw ? Number(lngRaw) : NaN;
    const temCoordenadas =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001);

    const municipioLimpo = sanitizarSqlTexto(municipioRaw);

    if (!temCoordenadas && !municipioLimpo && !ufRaw) {
      res.status(400).json({
        sucesso: false,
        modoBusca: 'nenhum',
        raioKm: null,
        totalEncontrados: 0,
        pocos: [],
        aviso:
          'Informe Coordenadas (Lat/Long ou UTM) ou Município/UF para consultar os poços da ANA/SNIRH.',
      });
      return;
    }

    // 1. Busca espacial progressiva por coordenadas (5 km -> 15 km -> 35 km)
    if (temCoordenadas) {
      const raios = [5, 15, 35];
      let melhorLista: PocoAnaBruto[] = [];
      let melhorRaio: number = 5;

      for (const raioKm of raios) {
        const encontrados = await consultarSnirh({
          where: '1=1',
          geometry: `${lng},${lat}`,
          geometryType: 'esriGeometryPoint',
          inSR: '4326',
          spatialRel: 'esriSpatialRelIntersects',
          distance: String(raioKm),
          units: 'esriSRUnit_Kilometer',
        });

        if (encontrados.length > melhorLista.length) {
          melhorLista = encontrados;
          melhorRaio = raioKm;
        }

        const especificos = encontrados.filter((p) =>
          isAquiferoEspecifico(p.aquifero)
        );
        if (especificos.length >= 3) {
          melhorLista = encontrados;
          melhorRaio = raioKm;
          break;
        }
      }

      if (melhorLista.length > 0) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.status(200).json({
          sucesso: true,
          modoBusca: 'coordenadas',
          raioKm: melhorRaio,
          totalEncontrados: melhorLista.length,
          pocos: melhorLista,
        });
        return;
      }
    }

    // 2. Fallback / Estimativa regional por Município + UF
    if (municipioLimpo || ufRaw) {
      let pocosMunicipio: PocoAnaBruto[] = [];

      if (municipioLimpo) {
        const munUpper = municipioLimpo.toUpperCase();
        const filtroUf = ufRaw ? `ing_sg_ufmunicipio = '${ufRaw}' AND ` : '';

        // Tentativa 1: correspondência direta (preserva acentos se o usuário digitou com acento)
        pocosMunicipio = await consultarSnirh({
          where: `${filtroUf}UPPER(ing_nm_municipio) LIKE '%${munUpper}%'`,
        });

        // Tentativa 2: tolerância a acentos (ex: "Cuiaba" -> "C_I_B_" para casar com "CUIABÁ")
        if (pocosMunicipio.length === 0 && munUpper.length >= 3) {
          const munSemAcento = removerAcentos(munUpper);
          const padraoWildcard = munSemAcento.replace(/[AEIOUC]/g, '_');
          const candidatos = await consultarSnirh({
            where: `${filtroUf}UPPER(ing_nm_municipio) LIKE '%${padraoWildcard}%'`,
          });
          pocosMunicipio = candidatos.filter((p) =>
            removerAcentos(p.municipio).includes(munSemAcento)
          );
        }
      } else if (ufRaw) {
        pocosMunicipio = await consultarSnirh({
          where: `ing_sg_ufmunicipio = '${ufRaw}' AND tap_ds IS NOT NULL`,
        });
      }

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.status(200).json({
        sucesso: true,
        modoBusca: 'municipio',
        raioKm: null,
        totalEncontrados: pocosMunicipio.length,
        pocos: pocosMunicipio,
        ...(pocosMunicipio.length === 0
          ? {
              aviso:
                'Nenhum poço outorgado encontrado na base da ANA/SNIRH para esta região.',
            }
          : {}),
      });
      return;
    }

    res.status(200).json({
      sucesso: true,
      modoBusca: temCoordenadas ? 'coordenadas' : 'municipio',
      raioKm: temCoordenadas ? 35 : null,
      totalEncontrados: 0,
      pocos: [],
      aviso:
        'Nenhum poço encontrado na base da ANA/SNIRH num raio de até 35 km.',
    });
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    res.status(502).json({
      sucesso: false,
      modoBusca: 'erro',
      raioKm: null,
      totalEncontrados: 0,
      pocos: [],
      aviso: isTimeout
        ? 'A API pública da ANA/SNIRH demorou mais de 10 segundos para responder.'
        : err?.message || 'Erro ao consultar o serviço da ANA/SNIRH.',
    });
  }
}
