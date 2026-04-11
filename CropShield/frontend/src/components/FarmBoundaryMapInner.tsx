'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, Marker, Polygon, TileLayer, Tooltip } from 'react-leaflet';

export interface FarmBoundaryMapProps {
  polygon: number[][];
  center?: [number, number];
  height?: number;
}

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function FarmBoundaryMapInner({
  polygon,
  center,
  height = 320,
}: FarmBoundaryMapProps) {
  const validPolygon = Array.isArray(polygon) ? polygon : [];
  const polygonCenter: [number, number] = center
    ? center
    : validPolygon.length > 0
      ? [validPolygon[0][0], validPolygon[0][1]]
      : [18.5204, 73.8567];

  return (
    <div style={{ width: '100%', height, borderRadius: 16, overflow: 'hidden' }}>
      <MapContainer center={polygonCenter} zoom={16} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validPolygon.length >= 3 ? (
          <Polygon
            positions={validPolygon.map((item) => [item[0], item[1]] as [number, number])}
            pathOptions={{ color: '#336B4B', fillColor: '#7DB87A', fillOpacity: 0.28, weight: 3 }}
          >
            <Tooltip sticky>Verified farm extent</Tooltip>
          </Polygon>
        ) : null}
        <Marker position={polygonCenter} icon={icon}>
          <Tooltip>Farm center</Tooltip>
        </Marker>
      </MapContainer>
    </div>
  );
}
