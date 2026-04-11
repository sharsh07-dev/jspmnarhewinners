import React from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, Marker, Polygon, TileLayer, Tooltip } from 'react-leaflet';

/**
 * Farm Boundary Map 
 * Visualizes the geo-polygon of a farm.
 */

const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const FarmBoundaryMap = ({
  polygon = [],
  center,
  height = 320,
}) => {
  const validPolygon = Array.isArray(polygon) ? polygon : [];
  const polygonCenter = center
    ? center
    : validPolygon.length > 0
      ? [validPolygon[0][0], validPolygon[0][1]]
      : [18.5204, 73.8567];

  return (
    <div style={{ width: '100%', height, borderRadius: 24, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <MapContainer center={polygonCenter} zoom={16} style={{ width: '100%', height: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validPolygon.length >= 3 ? (
          <Polygon
            positions={validPolygon.map((item) => [item[0], item[1]])}
            pathOptions={{ color: '#4F46E5', fillColor: '#818CF8', fillOpacity: 0.2, weight: 3 }}
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
};

export default FarmBoundaryMap;
