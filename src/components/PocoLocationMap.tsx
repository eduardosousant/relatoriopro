import React, { useEffect, useState, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  Layers,
  Crosshair,
  RefreshCw,
} from 'lucide-react';
import {
  extrairCoordenadasGeograficas,
  formatarLatLngPadrao,
  latLngParaUTM,
  decimalParaDMS,
} from '../utils/coordenadasParser';

type CamadaMapa = 'hybrid' | 'roadmap' | 'terrain';

function criarIconePocoLeaflet(tag: string, compact: boolean): L.DivIcon {
  const size = compact ? 26 : 32;
  const tagEscapada = (tag || 'PT01')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return L.divIcon({
    className: 'relatorpro-poco-pin',
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 6],
    popupAnchor: [0, -(size + 4)],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <svg width="${size}" height="${size}" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));">
          <path d="M18 2C11.3726 2 6 7.37258 6 14C6 22.5 18 34 18 34C18 34 30 22.5 30 14C30 7.37258 24.6274 2 18 2Z" fill="#E8A020" stroke="#1B2A3B" stroke-width="2.6"/>
          <circle cx="18" cy="14" r="5" fill="#1B2A3B"/>
        </svg>
        ${
          !compact
            ? `<span style="margin-top:-2px;background:#1B2A3B;color:#E8A020;font-family:monospace;font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;border:1px solid #E8A020;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,0.35);">${tagEscapada}</span>`
            : ''
        }
      </div>
    `,
  });
}

interface LeafletCanvasProps {
  lat: number;
  lng: number;
  zoom: number;
  camada: CamadaMapa;
  pocoTag: string;
  cliente?: string;
  localizacao?: string;
  cidadeUF?: string;
  interactive: boolean;
  compact?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}

const LeafletMapCanvas: React.FC<LeafletCanvasProps> = ({
  lat,
  lng,
  zoom,
  camada,
  pocoTag,
  cliente,
  localizacao,
  cidadeUF,
  interactive,
  compact = false,
  onMapClick,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const baseLayersRef = useRef<L.LayerGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  // Inicialização única do mapa Leaflet
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = L.map(el, {
      center: [lat, lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      scrollWheelZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    });

    map.attributionControl.setPrefix(false);

    const layerGroup = L.layerGroup().addTo(map);
    baseLayersRef.current = layerGroup;

    const marker = L.marker([lat, lng], {
      icon: criarIconePocoLeaflet(pocoTag, compact),
    }).addTo(map);
    markerRef.current = marker;

    if (interactive) {
      map.on('click', (ev: L.LeafletMouseEvent) => {
        onMapClickRef.current?.(ev.latlng.lat, ev.latlng.lng);
      });
    }

    mapRef.current = map;

    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(el);

    const t = window.setTimeout(() => {
      map.invalidateSize({ animate: false });
    }, 150);

    return () => {
      window.clearTimeout(t);
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      baseLayersRef.current = null;
    };
  }, [interactive, compact]);

  // Atualiza camada de tiles (Satélite Esri / Mapa OSM / Relevo OpenTopoMap)
  useEffect(() => {
    const group = baseLayersRef.current;
    if (!group) return;
    group.clearLayers();

    if (camada === 'roadmap') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(group);
    } else if (camada === 'terrain') {
      L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenTopoMap • OSM',
      }).addTo(group);
    } else {
      // Satélite Esri World Imagery + sobreposição de nomes de ruas/cidades
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri • OpenStreetMap',
        }
      ).addTo(group);
      L.tileLayer(
        'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
        }
      ).addTo(group);
    }
  }, [camada]);

  // Atualiza posição do centro, zoom, marcador e popup
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    map.setView([lat, lng], zoom, { animate: interactive });
    marker.setLatLng([lat, lng]);
    marker.setIcon(criarIconePocoLeaflet(pocoTag, compact));

    if (interactive && !compact) {
      const esc = (v?: string) =>
        (v || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      const localCompleto = [localizacao, cidadeUF].filter(Boolean).join(' • ');
      marker.bindPopup(
        `<div style="font-family:sans-serif;font-size:12px;min-width:180px;">
          <div style="font-weight:700;color:#1B2A3B;margin-bottom:3px;">
            <span style="background:#1B2A3B;color:#E8A020;padding:1px 5px;border-radius:3px;font-family:monospace;font-size:10px;margin-right:4px;">${esc(pocoTag || 'PT01')}</span>
            ${esc(cliente || 'Poço Tubular Profundo')}
          </div>
          ${localCompleto ? `<div style="color:#475569;font-size:11px;margin-bottom:4px;">${esc(localCompleto)}</div>` : ''}
          <div style="font-family:monospace;font-size:10.5px;background:#F1F5F9;padding:3px 6px;border-radius:4px;color:#0F172A;">
            Lat: ${lat.toFixed(6)}° | Lon: ${lng.toFixed(6)}°
          </div>
        </div>`
      );
    }
  }, [lat, lng, zoom, pocoTag, cliente, localizacao, cidadeUF, interactive, compact]);

  return <div ref={containerRef} className="w-full h-full z-0" />;
};

export interface PocoLocationMapProps {
  coordenadasGeograficas?: string;
  coordenadasUTM?: string;
  pocoTag?: string;
  cliente?: string;
  localizacao?: string;
  cidadeUF?: string;
  variant?: 'editor' | 'a4' | 'compact';
  onChangeCoordenadas?: (dados: {
    lat: number;
    lng: number;
    coordenadasGeograficas: string;
    coordenadasUTM: string;
  }) => void;
}

export const PocoLocationMap: React.FC<PocoLocationMapProps> = ({
  coordenadasGeograficas,
  coordenadasUTM,
  pocoTag = 'PT01',
  cliente,
  localizacao,
  cidadeUF,
  variant = 'editor',
  onChangeCoordenadas,
}) => {
  const coordExtraida = useMemo(
    () => extrairCoordenadasGeograficas(coordenadasGeograficas, coordenadasUTM),
    [coordenadasGeograficas, coordenadasUTM]
  );

  const [latInput, setLatInput] = useState<string>(
    coordExtraida ? String(coordExtraida.lat) : ''
  );
  const [lngInput, setLngInput] = useState<string>(
    coordExtraida ? String(coordExtraida.lng) : ''
  );
  const [camada, setCamada] = useState<CamadaMapa>('hybrid');
  const [zoom, setZoom] = useState<number>(16);
  const [obtendoGps, setObtendoGps] = useState(false);
  const [erroGps, setErroGps] = useState<string | null>(null);

  useEffect(() => {
    if (coordExtraida) {
      setLatInput(String(coordExtraida.lat));
      setLngInput(String(coordExtraida.lng));
    }
  }, [coordExtraida?.lat, coordExtraida?.lng]);

  const aplicarNovasCoordenadas = (novoLat: number, novoLng: number) => {
    if (
      !Number.isFinite(novoLat) ||
      !Number.isFinite(novoLng) ||
      novoLat < -90 ||
      novoLat > 90 ||
      novoLng < -180 ||
      novoLng > 180
    ) {
      return;
    }
    const latArred = Number(novoLat.toFixed(6));
    const lngArred = Number(novoLng.toFixed(6));
    setLatInput(String(latArred));
    setLngInput(String(lngArred));

    if (onChangeCoordenadas) {
      const geoStr = formatarLatLngPadrao(latArred, lngArred);
      const utmObj = latLngParaUTM(latArred, lngArred);
      onChangeCoordenadas({
        lat: latArred,
        lng: lngArred,
        coordenadasGeograficas: geoStr,
        coordenadasUTM: utmObj.formatado,
      });
    }
  };

  const handleAplicarInputsManuais = () => {
    const nLat = parseFloat(latInput.replace(',', '.'));
    const nLng = parseFloat(lngInput.replace(',', '.'));
    if (
      Number.isFinite(nLat) &&
      Number.isFinite(nLng) &&
      nLat >= -90 &&
      nLat <= 90 &&
      nLng >= -180 &&
      nLng <= 180
    ) {
      aplicarNovasCoordenadas(nLat, nLng);
      setErroGps(null);
    } else {
      setErroGps(
        'Informe uma Latitude (-90 a 90) e Longitude (-180 a 180) válidas.'
      );
    }
  };

  const handleObterGpsAtual = () => {
    if (!navigator.geolocation) {
      setErroGps('Geolocalização não suportada neste navegador.');
      return;
    }
    setObtendoGps(true);
    setErroGps(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setObtendoGps(false);
        aplicarNovasCoordenadas(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setObtendoGps(false);
        setErroGps(
          err.code === 1
            ? 'Permissão de localização negada no navegador.'
            : 'Não foi possível capturar o sinal de GPS.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Modo Folha A4 (Compacto para Relatório Técnico)
  if (variant === 'a4') {
    if (!coordExtraida) return null;

    const utmCalc = latLngParaUTM(coordExtraida.lat, coordExtraida.lng);

    return (
      <div className="border-x border-b border-[#DDE3EC] bg-[#FAFBFD] p-2">
        <div className="grid grid-cols-12 gap-2.5 items-stretch">
          <div className="col-span-8 relative rounded border border-[#CBD5E1] overflow-hidden bg-slate-100 h-[118px]">
            <LeafletMapCanvas
              lat={coordExtraida.lat}
              lng={coordExtraida.lng}
              zoom={16}
              camada="hybrid"
              pocoTag={pocoTag}
              cliente={cliente}
              localizacao={localizacao}
              cidadeUF={cidadeUF}
              interactive={false}
              compact
            />
            <div className="absolute top-1.5 left-1.5 z-[400] bg-[#1B2A3B]/90 text-white px-2 py-0.5 rounded text-[6.8pt] font-bold tracking-wide uppercase flex items-center gap-1 shadow-xs pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E8A020]" />
              <span>LOCALIZAÇÃO GEORREFERENCIADA ({pocoTag || 'PT01'})</span>
            </div>
          </div>

          <div className="col-span-4 flex flex-col justify-between rounded border border-[#DDE3EC] bg-white p-2 text-[7.2pt]">
            <div>
              <div className="font-extrabold uppercase text-[#1B2A3B] border-b border-slate-100 pb-1 mb-1 flex items-center justify-between">
                <span>GEORREFERENCIAMENTO</span>
                <span className="text-[6.5pt] font-mono text-[#E8A020] bg-[#1B2A3B] px-1.5 py-0.2 rounded">
                  SIRGAS 2000
                </span>
              </div>
              <div className="space-y-0.5 font-mono text-[7pt] text-slate-700">
                <div className="flex justify-between">
                  <span className="text-[#6B7A8D] font-sans font-bold">
                    LATITUDE:
                  </span>
                  <span className="font-bold text-[#1B2A3B]">
                    {coordExtraida.lat.toFixed(6)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A8D] font-sans font-bold">
                    LONGITUDE:
                  </span>
                  <span className="font-bold text-[#1B2A3B]">
                    {coordExtraida.lng.toFixed(6)}°
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A8D] font-sans font-bold">
                    GMS:
                  </span>
                  <span>{coordExtraida.dmsFormatado}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6B7A8D] font-sans font-bold">
                    FUSO UTM:
                  </span>
                  <span>
                    {utmCalc.zona}
                    {utmCalc.banda} (E:{utmCalc.easting} / N:{utmCalc.northing})
                  </span>
                </div>
              </div>
            </div>
            <div className="text-[6.5pt] text-[#6B7A8D] border-t border-slate-100 pt-1 leading-tight">
              Ponto plotado automaticamente via OpenStreetMap / Esri.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo Editor ou Compacto nas Abas do Formulário / Cadastro de Poços
  return (
    <div className="rounded-xl border border-[#DDE3EC] dark:border-slate-800 bg-[#F7F9FC]/90 dark:bg-slate-950/60 p-3.5 sm:p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#1B2A3B] text-[#E8A020] flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#1B2A3B] dark:text-slate-100 flex items-center gap-2 flex-wrap">
              <span>Mapa Automático por Coordenadas (OpenStreetMap)</span>
              {coordExtraida && (
                <span className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Georreferenciado
                </span>
              )}
            </h4>
            <p className="text-[11px] text-[#6B7A8D] dark:text-slate-400">
              Digite a Latitude e Longitude (ex: -15.6014, -56.0979), capture via GPS ou clique diretamente no mapa para posicionar o poço.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onChangeCoordenadas && (
            <button
              type="button"
              onClick={handleObterGpsAtual}
              disabled={obtendoGps}
              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-[#1B2A3B] hover:bg-[#2E4260] text-white flex items-center gap-1.5 transition-colors disabled:opacity-60"
              title="Capturar Latitude e Longitude do GPS do seu dispositivo"
            >
              <Crosshair className="w-3.5 h-3.5 text-[#E8A020]" />
              <span>{obtendoGps ? 'Capturando...' : 'Usar GPS'}</span>
            </button>
          )}

          <div className="inline-flex rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-[11px] font-semibold">
            {(
              [
                { id: 'hybrid', label: 'Satélite' },
                { id: 'roadmap', label: 'Mapa (OSM)' },
                { id: 'terrain', label: 'Relevo' },
              ] as const
            ).map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => setCamada(tipo.id)}
                className={`px-2 py-1 rounded-md transition-colors ${
                  camada === tipo.id
                    ? 'bg-[#1B2A3B] text-[#E8A020] font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tipo.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campos Rápidos de Latitude e Longitude + Conversão Automática */}
      {onChangeCoordenadas && (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-white dark:bg-slate-900 p-3 rounded-lg border border-[#DDE3EC] dark:border-slate-800">
          <div className="sm:col-span-4">
            <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
              Latitude (Graus Decimais)
            </label>
            <input
              type="text"
              value={latInput}
              onChange={(e) => {
                setLatInput(e.target.value);
                const vLat = parseFloat(e.target.value.replace(',', '.'));
                const vLng = parseFloat(lngInput.replace(',', '.'));
                if (
                  Number.isFinite(vLat) &&
                  Number.isFinite(vLng) &&
                  e.target.value.trim().length >= 5
                ) {
                  aplicarNovasCoordenadas(vLat, vLng);
                }
              }}
              placeholder="Ex: -15.601410 ou -21.1767"
              className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-[10.5px] font-bold uppercase text-[#6B7A8D] dark:text-slate-400 mb-1">
              Longitude (Graus Decimais)
            </label>
            <input
              type="text"
              value={lngInput}
              onChange={(e) => {
                setLngInput(e.target.value);
                const vLat = parseFloat(latInput.replace(',', '.'));
                const vLng = parseFloat(e.target.value.replace(',', '.'));
                if (
                  Number.isFinite(vLat) &&
                  Number.isFinite(vLng) &&
                  e.target.value.trim().length >= 5
                ) {
                  aplicarNovasCoordenadas(vLat, vLng);
                }
              }}
              placeholder="Ex: -56.097890 ou -47.8208"
              className="w-full px-2.5 py-2 text-xs font-mono rounded-lg border border-[#DDE3EC] dark:border-slate-700 bg-[#F7F9FC] dark:bg-slate-950 focus:bg-white focus:border-[#E8A020] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAplicarInputsManuais}
              className="w-full px-3 py-2 text-xs font-bold rounded-lg bg-[#E8A020] hover:bg-[#F5B93A] text-[#1B2A3B] flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Plotar e Converter UTM</span>
            </button>
          </div>
        </div>
      )}

      {erroGps && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {erroGps}
        </div>
      )}

      {/* Área do Mapa Interativo Leaflet (OpenStreetMap / Esri Satélite) */}
      {coordExtraida ? (
        <div className="space-y-2">
          <div
            className="relative w-full rounded-xl overflow-hidden border border-[#DDE3EC] dark:border-slate-700 shadow-xs bg-slate-200"
            style={{ height: variant === 'compact' ? '220px' : '280px' }}
          >
            <LeafletMapCanvas
              lat={coordExtraida.lat}
              lng={coordExtraida.lng}
              zoom={zoom}
              camada={camada}
              pocoTag={pocoTag}
              cliente={cliente}
              localizacao={localizacao}
              cidadeUF={cidadeUF}
              interactive={true}
              onMapClick={
                onChangeCoordenadas
                  ? (nLat, nLng) => aplicarNovasCoordenadas(nLat, nLng)
                  : undefined
              }
            />

            {/* Barra flutuante de zoom rápido */}
            <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 bg-[#1B2A3B]/90 backdrop-blur-xs text-white px-2.5 py-1.5 rounded-lg text-[11px] font-mono shadow-md">
              <Navigation className="w-3.5 h-3.5 text-[#E8A020]" />
              <span>
                {coordExtraida.lat.toFixed(6)}°, {coordExtraida.lng.toFixed(6)}°
              </span>
              <span className="text-slate-400 mx-1">|</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(4, z - 1))}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 font-bold"
                title="Diminuir Zoom"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(19, z + 1))}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 font-bold"
                title="Aumentar Zoom"
              >
                +
              </button>
            </div>
          </div>

          {/* Resumo Técnico SIRGAS 2000 + GMS + UTM Calculado */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-[#DDE3EC] dark:border-slate-800">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="font-sans font-bold uppercase text-[#6B7A8D]">
                Decimal:
              </span>
              <span className="text-[#1B2A3B] dark:text-slate-200 font-semibold">
                {coordExtraida.lat.toFixed(6)}°, {coordExtraida.lng.toFixed(6)}°
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="font-sans font-bold uppercase text-[#6B7A8D]">
                GMS:
              </span>
              <span className="text-[#1B2A3B] dark:text-slate-200">
                {decimalParaDMS(coordExtraida.lat, true)}{' '}
                {decimalParaDMS(coordExtraida.lng, false)}
              </span>
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="font-sans font-bold uppercase text-[#6B7A8D]">
                UTM Calc:
              </span>
              <span className="text-[#1B2A3B] dark:text-slate-200 truncate">
                {coordExtraida.utmFormatado}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-4 text-center text-xs text-[#6B7A8D] dark:text-slate-400 flex flex-col items-center gap-1.5">
          <Layers className="w-5 h-5 text-[#E8A020]" />
          <span>
            Informe a <strong>Latitude e Longitude</strong> nos campos acima (ou clique em <strong>Usar GPS</strong>) para gerar automaticamente o mapa e calcular as coordenadas UTM.
          </span>
        </div>
      )}
    </div>
  );
};
