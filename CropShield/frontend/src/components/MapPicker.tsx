'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';

interface MapPickerProps {
  onLocationSelect: (lat: number, lon: number) => void;
  initialPos?: [number, number];
}

const DEFAULT_POS: [number, number] = [18.52041, 73.85674];

export const MapPicker = ({ onLocationSelect, initialPos }: MapPickerProps) => {
  const start = useMemo<[number, number]>(() => initialPos ?? DEFAULT_POS, [initialPos]);
  const [lat, setLat] = useState<number>(start[0]);
  const [lon, setLon] = useState<number>(start[1]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const onLocationSelectRef = useRef(onLocationSelect);

  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

  useEffect(() => {
    onLocationSelectRef.current(lat, lon);
  }, [lat, lon]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(err.message || 'Unable to get current location.');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="map-picker-wrapper glass">
      <div className="coord-grid">
        <label className="coord-field">
          <span>Latitude</span>
          <input
            type="number"
            step="0.000001"
            value={Number.isFinite(lat) ? lat : ''}
            onChange={(e) => setLat(Number(e.target.value))}
          />
        </label>
        <label className="coord-field">
          <span>Longitude</span>
          <input
            type="number"
            step="0.000001"
            value={Number.isFinite(lon) ? lon : ''}
            onChange={(e) => setLon(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="actions">
        <button type="button" className="geo-btn" onClick={useCurrentLocation} disabled={geoLoading}>
          <LocateFixed size={16} />
          <span>{geoLoading ? 'Locating...' : 'Use Current Location'}</span>
        </button>
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=14/${lat}/${lon}`}
          target="_blank"
          rel="noreferrer"
          className="map-link"
        >
          Open in Map
        </a>
      </div>

      {geoError ? <p className="error-text">{geoError}</p> : null}

      <p className="map-hint">Tip: enter exact farm coordinates or use current GPS location.</p>

      <style jsx>{`
        .map-picker-wrapper {
          padding: 12px;
          border-radius: 16px;
          margin: 1rem 0;
        }
        .coord-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) {
          .coord-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .coord-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .coord-field span {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-dim);
        }
        .coord-field input {
          padding: 0.75rem 0.9rem;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          background: #fff;
          color: var(--text-main);
          outline: none;
        }
        .coord-field input:focus {
          border-color: var(--primary);
        }
        .actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 12px;
        }
        .geo-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border-glass);
          color: var(--text-main);
          background: #fff;
          padding: 0.55rem 0.85rem;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.82rem;
        }
        .geo-btn:disabled {
          opacity: 0.65;
          cursor: wait;
        }
        .map-link {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
        }
        .map-link:hover {
          text-decoration: underline;
        }
        .error-text {
          margin-top: 8px;
          color: #b91c1c;
          font-size: 0.8rem;
        }
        .map-hint {
          padding: 8px 0 0;
          font-size: 0.8rem;
          color: var(--text-dim);
        }
      `}</style>
    </div>
  );
};

export default MapPicker;
