import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle } from '../types';

/** Centro aproximado do Pará, usado quando nenhum veículo tem posição. */
const PARA_CENTER: [number, number] = [-3.8, -51.5];

type MarkerState = 'moving' | 'stopped' | 'blocked';

function markerState(v: Vehicle): MarkerState {
  if (v.bloqueado) return 'blocked';
  if (v.ignicao && v.velocidade > 0) return 'moving';
  return 'stopped';
}

function hasPosition(v: Vehicle) {
  const { lat, lng } = v.localizacao || ({} as Vehicle['localizacao']);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

// Cores OmniNort: verde da marca para em rota (ícone navy, nunca branco sobre verde),
// cinza-azulado para parado e vermelho de perigo para bloqueado.
const STYLE: Record<MarkerState, { bg: string; fg: string }> = {
  moving: { bg: '#87b137', fg: '#00375a' },
  stopped: { bg: '#56677a', fg: '#ffffff' },
  blocked: { bg: '#b8473a', fg: '#ffffff' },
};

function vehicleIcon(v: Vehicle, selected: boolean) {
  const state = markerState(v);
  const { bg, fg } = STYLE[state];
  const size = selected ? 40 : 32;
  const arrow =
    state === 'moving'
      ? `<path d="M12 3 19 20 12 16 5 20Z" fill="${fg}"/>`
      : state === 'blocked'
        ? `<rect x="6" y="11" width="12" height="9" rx="2" fill="${fg}"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" stroke="${fg}" stroke-width="2" fill="none"/>`
        : `<rect x="7" y="7" width="10" height="10" rx="2" fill="${fg}"/>`;
  const html = `
    <div class="fleet-pin${selected ? ' is-selected' : ''}${state === 'moving' ? ' is-moving' : ''}" style="--pin-bg:${bg};width:${size}px;height:${size}px">
      <svg viewBox="0 0 24 24" width="${size * 0.5}" height="${size * 0.5}" aria-hidden="true">${arrow}</svg>
    </div>
    <span class="fleet-pin-plate">${v.placa}</span>`;
  return L.divIcon({
    html,
    className: 'fleet-pin-wrap',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [0, -size / 2 - 4],
  });
}

/** Enquadra todos os veículos uma vez e centraliza no selecionado quando ele muda. */
function MapController({ points, selected }: { points: [number, number][]; selected?: [number, number] }) {
  const map = useMap();
  const framed = useRef(false);

  useEffect(() => {
    if (framed.current || points.length === 0) return;
    framed.current = true;
    if (points.length === 1) map.setView(points[0], 13);
    else map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
  }, [map, points]);

  const selKey = selected ? selected.join(',') : '';
  const firstSel = useRef(true);
  useEffect(() => {
    if (!selected) return;
    if (firstSel.current) {
      firstSel.current = false;
      return;
    }
    map.flyTo(selected, Math.max(map.getZoom(), 12), { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selKey]);

  // O mapa nasce dentro de um grid; recalcula o tamanho quando o container muda.
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);

  return null;
}

interface FleetMapProps {
  vehicles: Vehicle[];
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const FleetMap: React.FC<FleetMapProps> = ({ vehicles, selectedId, onSelect, className }) => {
  const located = useMemo(() => vehicles.filter(hasPosition), [vehicles]);
  const points = useMemo(
    () => located.map(v => [v.localizacao.lat, v.localizacao.lng] as [number, number]),
    [located],
  );
  const selected = located.find(v => v.id === selectedId);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 ${className || ''}`}>
      <MapContainer
        center={points[0] || PARA_CENTER}
        zoom={points.length ? 11 : 6}
        scrollWheelZoom
        className="h-full w-full"
        style={{ background: '#eef1f3' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapController
          points={points}
          selected={selected ? [selected.localizacao.lat, selected.localizacao.lng] : undefined}
        />
        {located.map(v => {
          const isSel = v.id === selectedId;
          const state = markerState(v);
          return (
            <Marker
              key={v.id}
              position={[v.localizacao.lat, v.localizacao.lng]}
              icon={vehicleIcon(v, isSel)}
              zIndexOffset={isSel ? 1000 : 0}
              keyboard
              title={`${v.placa} · ${v.modelo}`}
              eventHandlers={{ click: () => onSelect(v.id) }}
            >
              <Tooltip direction="top" className="fleet-tooltip">
                <div className="font-semibold text-[#00375a]">
                  {v.placa} · {v.modelo}
                </div>
                <div className="text-[#56677a]">
                  {state === 'blocked'
                    ? 'Bloqueado'
                    : state === 'moving'
                      ? `Em rota · ${v.velocidade} km/h`
                      : v.ignicao
                        ? 'Parado, ignição ligada'
                        : 'Desligado'}
                  {v.localizacao.cidade ? ` · ${v.localizacao.cidade}` : ''}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </MapContainer>

      {located.length < vehicles.length && (
        <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#56677a] shadow-sm backdrop-blur">
          {vehicles.length - located.length} veículo(s) sem posição GPS
        </div>
      )}
    </div>
  );
};
