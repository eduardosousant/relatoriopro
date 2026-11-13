export interface CoordenadaGeografica {
  lat: number;
  lng: number;
  formatoOriginal?: string;
  utmFormatado?: string;
  latLngFormatado: string;
  dmsFormatado: string;
}

/**
 * Converte graus decimais para string GMS (Graus, Minutos, Segundos)
 */
export function decimalParaDMS(valor: number, isLat: boolean): string {
  const dir = isLat ? (valor >= 0 ? 'N' : 'S') : valor >= 0 ? 'E' : 'W';
  const abs = Math.abs(valor);
  const graus = Math.floor(abs);
  const minFloat = (abs - graus) * 60;
  const minutos = Math.floor(minFloat);
  const segundos = ((minFloat - minutos) * 60).toFixed(1);
  return `${graus}°${String(minutos).padStart(2, '0')}'${segundos.padStart(4, '0')}"${dir}`;
}

/**
 * Formata par Latitude/Longitude no padrão técnico ABNT / SIRGAS 2000
 */
export function formatarLatLngPadrao(lat: number, lng: number): string {
  const latHemi = lat >= 0 ? 'N' : 'S';
  const lngHemi = lng >= 0 ? 'E' : 'W';
  return `LAT ${lat.toFixed(6)}° ${latHemi} | LON ${lng.toFixed(6)}° ${lngHemi} (SIRGAS 2000)`;
}

/**
 * Converte Latitude/Longitude (WGS84 / SIRGAS 2000) para Coordenadas UTM (Zona, Banda, E, N)
 */
export function latLngParaUTM(lat: number, lng: number): {
  zona: number;
  banda: string;
  easting: number;
  northing: number;
  formatado: string;
} {
  const a = 6378137.0; // Semi-eixo maior GRS80 / WGS84
  const eccSquared = 0.00669438002290;
  const k0 = 0.9996;

  const latRad = (lat * Math.PI) / 180.0;
  const lngRad = (lng * Math.PI) / 180.0;

  const zona = Math.floor((lng + 180) / 6) + 1;
  const lngOrigin = (zona - 1) * 6 - 180 + 3;
  const lngOriginRad = (lngOrigin * Math.PI) / 180.0;

  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const N = a / Math.sqrt(1 - eccSquared * Math.sin(latRad) * Math.sin(latRad));
  const T = Math.tan(latRad) * Math.tan(latRad);
  const C = eccPrimeSquared * Math.cos(latRad) * Math.cos(latRad);
  const A = Math.cos(latRad) * (lngRad - lngOriginRad);

  const M =
    a *
    ((1 -
      eccSquared / 4 -
      (3 * eccSquared * eccSquared) / 64 -
      (5 * eccSquared * eccSquared * eccSquared) / 256) *
      latRad -
      ((3 * eccSquared) / 8 +
        (3 * eccSquared * eccSquared) / 32 +
        (45 * eccSquared * eccSquared * eccSquared) / 1024) *
        Math.sin(2 * latRad) +
      ((15 * eccSquared * eccSquared) / 256 +
        (45 * eccSquared * eccSquared * eccSquared) / 1024) *
        Math.sin(4 * latRad) -
      ((35 * eccSquared * eccSquared * eccSquared) / 3072) *
        Math.sin(6 * latRad));

  const easting = Math.round(
    k0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * eccPrimeSquared) *
          A *
          A *
          A *
          A *
          A) /
          120) +
      500000.0
  );

  let northing = Math.round(
    k0 *
      (M +
        N *
          Math.tan(latRad) *
          ((A * A) / 2 +
            ((5 - T + 9 * C + 4 * C * C) * A * A * A * A) / 24 +
            ((61 - 58 * T + T * T + 600 * C - 330 * eccPrimeSquared) *
              A *
              A *
              A *
              A *
              A *
              A) /
              720))
  );

  if (lat < 0) {
    northing += 10000000.0;
  }

  const bandas = 'CDEFGHJKLMNPQRSTUVWXX';
  const idxBanda = Math.max(
    0,
    Math.min(bandas.length - 1, Math.floor((lat + 80) / 8))
  );
  const banda = bandas[idxBanda] || (lat < 0 ? 'K' : 'N');

  return {
    zona,
    banda,
    easting,
    northing,
    formatado: `Zona ${zona}${banda} | E = ${easting.toLocaleString('pt-BR')} m | N = ${northing.toLocaleString('pt-BR')} m (SIRGAS 2000)`,
  };
}

/**
 * Converte Coordenadas UTM (Zona, Hemisfério Sul/Norte, Easting, Northing) para Latitude/Longitude
 */
export function utmParaLatLng(
  zona: number,
  easting: number,
  northing: number,
  hemisferioSul = true
): { lat: number; lng: number } | null {
  if (
    zona < 1 ||
    zona > 60 ||
    easting < 100000 ||
    easting > 999999 ||
    northing < 0 ||
    northing > 10000000
  ) {
    return null;
  }

  const k0 = 0.9996;
  const a = 6378137.0;
  const eccSquared = 0.00669438002290;
  const eccPrimeSquared = eccSquared / (1 - eccSquared);
  const e1 =
    (1 - Math.sqrt(1 - eccSquared)) / (1 + Math.sqrt(1 - eccSquared));

  const x = easting - 500000.0;
  const y = hemisferioSul ? northing - 10000000.0 : northing;

  const lngOrigin = (zona - 1) * 6 - 180 + 3;
  const M = y / k0;
  const mu =
    M /
    (a *
      (1 -
        eccSquared / 4 -
        (3 * eccSquared * eccSquared) / 64 -
        (5 * eccSquared * eccSquared * eccSquared) / 256));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * e1 * e1 * e1) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 * e1 * e1 * e1) / 32) * Math.sin(4 * mu) +
    ((151 * e1 * e1 * e1) / 96) * Math.sin(6 * mu);

  const N1 =
    a / Math.sqrt(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad));
  const T1 = Math.tan(phi1Rad) * Math.tan(phi1Rad);
  const C1 = eccPrimeSquared * Math.cos(phi1Rad) * Math.cos(phi1Rad);
  const R1 =
    (a * (1 - eccSquared)) /
    Math.pow(1 - eccSquared * Math.sin(phi1Rad) * Math.sin(phi1Rad), 1.5);
  const D = x / (N1 * k0);

  let lat =
    phi1Rad -
    ((N1 * Math.tan(phi1Rad)) / R1) *
      ((D * D) / 2 -
        ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * eccPrimeSquared) *
          D *
          D *
          D *
          D) /
          24 +
        ((61 +
          90 * T1 +
          298 * C1 +
          45 * T1 * T1 -
          252 * eccPrimeSquared -
          3 * C1 * C1) *
          D *
          D *
          D *
          D *
          D *
          D) /
          720);
  lat = (lat * 180.0) / Math.PI;

  let lng =
    (D -
      ((1 + 2 * T1 + C1) * D * D * D) / 6 +
      ((5 -
        2 * C1 +
        28 * T1 -
        3 * C1 * C1 +
        8 * eccPrimeSquared +
        24 * T1 * T1) *
        D *
        D *
        D *
        D *
        D) /
        120) /
    Math.cos(phi1Rad);
  lng = lngOrigin + (lng * 180.0) / Math.PI;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
  };
}

/**
 * Extrai automaticamente Latitude e Longitude a partir de qualquer formato de texto:
 * - Graus decimais rotulados: "LAT -21.1767 | LON -47.8208"
 * - Graus decimais simples: "-15.6014, -56.0979" ou "-15,6014 -56,0979"
 * - Graus, Minutos e Segundos (DMS): "21°10'36.1\"S 47°49'14.9\"W"
 * - Coordenadas UTM com Zona: "X=641520, Y=8612400 (Zona 21L)" ou "Zona 23K E=207184 N=7656112"
 */
export function extrairCoordenadasGeograficas(
  ...fontesTexto: Array<string | undefined | null>
): CoordenadaGeografica | null {
  for (const fonteBruta of fontesTexto) {
    if (!fonteBruta || typeof fonteBruta !== 'string') continue;
    const texto = fonteBruta.trim();
    if (!texto || texto.startsWith('[DADO A PREENCHER')) continue;

    // 1. Tenta DMS (Graus, Minutos e Segundos): ex: 21° 10' 36.12" S, 47° 49' 14.88" W/O
    const dmsRegex =
      /(\d{1,3})\s*[°ºd]\s*(\d{1,2})\s*['’′m]\s*(\d{1,2}(?:[.,]\d+)?)\s*["”″s]?\s*([NSns])[\s,|;/+-]+(\d{1,3})\s*[°ºd]\s*(\d{1,2})\s*['’′m]\s*(\d{1,2}(?:[.,]\d+)?)\s*["”″s]?\s*([EWOLewol])/i;
    const dmsMatch = texto.match(dmsRegex);
    if (dmsMatch) {
      const gLat = parseFloat(dmsMatch[1]);
      const mLat = parseFloat(dmsMatch[2]);
      const sLat = parseFloat(dmsMatch[3].replace(',', '.'));
      const hLat = dmsMatch[4].toUpperCase();

      const gLng = parseFloat(dmsMatch[5]);
      const mLng = parseFloat(dmsMatch[6]);
      const sLng = parseFloat(dmsMatch[7].replace(',', '.'));
      const hLng = dmsMatch[8].toUpperCase();

      let lat = gLat + mLat / 60 + sLat / 3600;
      let lng = gLng + mLng / 60 + sLng / 3600;
      if (hLat === 'S') lat = -lat;
      if (hLng === 'W' || hLng === 'O') lng = -lng;

      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const utm = latLngParaUTM(lat, lng);
        return {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          formatoOriginal: texto,
          utmFormatado: utm.formatado,
          latLngFormatado: formatarLatLngPadrao(lat, lng),
          dmsFormatado: `${decimalParaDMS(lat, true)} ${decimalParaDMS(lng, false)}`,
        };
      }
    }

    // 2. Tenta padrão explícito com rótulo LAT ... LON/LNG ...
    const rotuladoRegex =
      /LAT(?:ITUDE)?[:\s=]*([+-]?\d{1,2}(?:[.,]\d+)?)\s*[°º]?\s*([NSns])?[\s|;,/+-]*LON(?:GITUDE|G)?[:\s=]*([+-]?\d{1,3}(?:[.,]\d+)?)\s*[°º]?\s*([EWOLewol])?/i;
    const rotuladoMatch = texto.match(rotuladoRegex);
    if (rotuladoMatch) {
      let lat = parseFloat(rotuladoMatch[1].replace(',', '.'));
      const hLat = (rotuladoMatch[2] || '').toUpperCase();
      let lng = parseFloat(rotuladoMatch[3].replace(',', '.'));
      const hLng = (rotuladoMatch[4] || '').toUpperCase();

      if (hLat === 'S' && lat > 0) lat = -lat;
      if ((hLng === 'W' || hLng === 'O') && lng > 0) lng = -lng;

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)
      ) {
        const utm = latLngParaUTM(lat, lng);
        return {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          formatoOriginal: texto,
          utmFormatado: utm.formatado,
          latLngFormatado: formatarLatLngPadrao(lat, lng),
          dmsFormatado: `${decimalParaDMS(lat, true)} ${decimalParaDMS(lng, false)}`,
        };
      }
    }

    // 3. Tenta par direto de Graus Decimais (ex: "-21.1767, -47.8208" ou "-15.601410 / -56.097892")
    const limpoSemAno = texto.replace(/SIRGAS\s*2000|WGS\s*84/gi, '');
    const decimalPairRegex =
      /(?:^|[^\d.])([+-]?\d{1,2}[.,]\d{3,8})\s*[°º]?\s*([NSns])?\s*[,;/|\s]+\s*([+-]?\d{1,3}[.,]\d{3,8})\s*[°º]?\s*([EWOLewol])?(?!\d)/;
    const decMatch = limpoSemAno.match(decimalPairRegex);
    if (decMatch) {
      let lat = parseFloat(decMatch[1].replace(',', '.'));
      const hLat = (decMatch[2] || '').toUpperCase();
      let lng = parseFloat(decMatch[3].replace(',', '.'));
      const hLng = (decMatch[4] || '').toUpperCase();

      if (hLat === 'S' && lat > 0) lat = -lat;
      if ((hLng === 'W' || hLng === 'O') && lng > 0) lng = -lng;

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
      ) {
        const utm = latLngParaUTM(lat, lng);
        return {
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          formatoOriginal: texto,
          utmFormatado: utm.formatado,
          latLngFormatado: formatarLatLngPadrao(lat, lng),
          dmsFormatado: `${decimalParaDMS(lat, true)} ${decimalParaDMS(lng, false)}`,
        };
      }
    }

    // 4. Tenta Coordenadas UTM (ex: "X=641520, Y=8612400 (Zona 21L)" ou "Zona 23K | E = 207.184 | N = 7.656.112")
    const zonaMatch = texto.match(/(?:ZONA|ZONE|FUSO|UTM)?\s*\b(1[89]|2[0-5])\s*([C-X])\b/i);
    const textoSemPontosMilhar = texto.replace(/(\d)\.(\d{3})\b/g, '$1$2').replace(/(\d)\.(\d{3})\b/g, '$1$2');
    const utmNums = textoSemPontosMilhar.match(/\b(\d{6}(?:[.,]\d+)?)\b.*?\b(\d{7}(?:[.,]\d+)?)\b/);
    if (utmNums) {
      const easting = parseFloat(utmNums[1].replace(',', '.'));
      const northing = parseFloat(utmNums[2].replace(',', '.'));
      const zona = zonaMatch ? parseInt(zonaMatch[1], 10) : 21; // Default Zona 21 (MT/MS) ou 23 (SP) se não informada
      const banda = zonaMatch ? zonaMatch[2].toUpperCase() : 'K';
      const hemisferioSul = banda < 'N';
      const conv = utmParaLatLng(zona, easting, northing, hemisferioSul);
      if (conv) {
        const utm = latLngParaUTM(conv.lat, conv.lng);
        return {
          lat: conv.lat,
          lng: conv.lng,
          formatoOriginal: texto,
          utmFormatado: utm.formatado,
          latLngFormatado: formatarLatLngPadrao(conv.lat, conv.lng),
          dmsFormatado: `${decimalParaDMS(conv.lat, true)} ${decimalParaDMS(conv.lng, false)}`,
        };
      }
    }
  }

  return null;
}

/**
 * Obtém a chave de API do Google Maps configurada no ambiente
 */
export function obterGoogleMapsApiKey(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  return (
    metaEnv?.VITE_GOOGLE_MAPS_API_KEY ||
    metaEnv?.GOOGLE_MAPS_API_KEY ||
    ''
  );
}

/**
 * Constrói a URL oficial do Google Maps Static API para visualização estática ou impressão
 */
export function construirUrlMapaEstatico(params: {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  maptype?: 'roadmap' | 'satellite' | 'hybrid' | 'terrain';
  label?: string;
}): string {
  const apiKey = obterGoogleMapsApiKey();
  if (!apiKey) return '';

  const {
    lat,
    lng,
    zoom = 16,
    width = 640,
    height = 260,
    maptype = 'hybrid',
    label = 'P',
  } = params;

  const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cleanLabel = (label || 'P').replace(/[^A-Z0-9]/gi, '').charAt(0).toUpperCase() || 'P';

  const search = new URLSearchParams();
  search.append('center', center);
  search.append('zoom', String(zoom));
  search.append('size', `${width}x${height}`);
  search.append('scale', '2');
  search.append('maptype', maptype);
  search.append('markers', `size:mid|color:0xE8A020|label:${cleanLabel}|${center}`);
  search.append('key', apiKey);

  return `https://maps.googleapis.com/maps/api/staticmap?${search.toString()}`;
}
