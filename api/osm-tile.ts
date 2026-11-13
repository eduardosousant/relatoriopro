export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = req.query || {};
    const layer = String(query.layer ?? 'satellite');
    const z = parseInt(String(query.z ?? ''), 10);
    const x = parseInt(String(query.x ?? ''), 10);
    const y = parseInt(String(query.y ?? ''), 10);

    if (
      !Number.isInteger(z) ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      z < 0 ||
      z > 19 ||
      x < 0 ||
      y < 0
    ) {
      res.status(400).send('Invalid tile coordinates');
      return;
    }

    let tileUrl = '';
    if (layer === 'osm') {
      const sub = ['a', 'b', 'c'][(x + y) % 3];
      tileUrl = `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
    } else if (layer === 'terrain') {
      const sub = ['a', 'b', 'c'][(x + y) % 3];
      tileUrl = `https://${sub}.tile.opentopomap.org/${z}/${x}/${y}.png`;
    } else if (layer === 'labels') {
      tileUrl = `https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;
    } else {
      // Esri World Imagery (Satélite gratuito sem API key)
      tileUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
    }

    const upstream = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'RelatorPRO-Hidrogeologia/1.0 (https://vercel.app)',
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).send('Tile unavailable');
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    const contentType = upstream.headers.get('content-type') || 'image/png';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.status(200).send(buf);
  } catch (err: any) {
    res.status(500).send(err?.message || 'Error fetching tile');
  }
}
