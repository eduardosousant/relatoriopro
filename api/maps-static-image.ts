export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = req.query || {};
    const lat = parseFloat(String(query.lat ?? ''));
    const lng = parseFloat(String(query.lng ?? ''));
    const zoom = parseInt(String(query.zoom ?? '16'), 10) || 16;
    const maptype = String(query.maptype ?? 'hybrid');
    const label =
      String(query.label ?? 'P')
        .replace(/[^A-Z0-9]/gi, '')
        .charAt(0)
        .toUpperCase() || 'P';

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      res.status(400).json({ error: 'Coordenadas inválidas.' });
      return;
    }

    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';

    if (!apiKey) {
      res.status(404).json({ error: 'Chave Google Maps não configurada.' });
      return;
    }

    const center = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    const params = new URLSearchParams({
      center,
      zoom: String(zoom),
      size: '600x220',
      scale: '2',
      maptype,
      markers: `size:mid|color:0xE8A020|label:${label}|${center}`,
      key: apiKey,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
    );

    if (response.status === 429 || response.status === 403) {
      res.status(response.status).json({
        quotaExceeded: response.status === 429,
        error: 'Limite ou permissão da API Static Maps atingido.',
      });
      return;
    }

    if (!response.ok) {
      res.status(response.status).json({
        error: `Static Maps retornou status ${response.status}`,
      });
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/png';

    res.status(200).json({
      sucesso: true,
      dataUrl: `data:${contentType};base64,${base64}`,
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || 'Falha ao obter imagem estática do mapa.',
    });
  }
}
