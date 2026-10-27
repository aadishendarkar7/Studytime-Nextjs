'use client';
import { useEffect, useRef } from 'react';
import type { LayerGroup, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPin { id: string; lat: number; lng: number; title: string; body?: string; kind: 'mine' | 'shared' | 'draft' }

/**
 * Leaflet map with OpenStreetMap tiles. Leaflet needs `window`, so it is
 * imported inside the effect. Pins are plain HTML so they follow the theme colors.
 */
export function SpotMap({ pins, focus, onPick, className }: { pins: MapPin[]; focus: { lat: number; lng: number; zoom?: number } | null; onPick?: (lat: number, lng: number) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const L = useRef<typeof import('leaflet') | null>(null);
  const pick = useRef(onPick);
  useEffect(() => { pick.current = onPick; }, [onPick]);

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current || map.current) return;
      L.current = mod;
      const m = mod.map(el.current, { zoomControl: true, worldCopyJump: true }).setView([39.5, -98.35], 4);
      mod.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      m.on('click', (e) => pick.current?.(e.latlng.lat, e.latlng.lng));
      layer.current = mod.layerGroup().addTo(m);
      map.current = m;
      window.dispatchEvent(new Event('spotmap:ready'));
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Redraw pins whenever they change, and once the map has loaded.
  useEffect(() => {
    const draw = () => {
      const mod = L.current;
      if (!mod || !layer.current) return;
      layer.current.clearLayers();
      for (const p of pins) {
        const icon = mod.divIcon({ className: '', html: `<span class="spot-pin spot-pin-${p.kind}"></span>`, iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24] });
        const popup = document.createElement('div');
        const strong = document.createElement('strong');
        strong.textContent = p.title;
        popup.append(strong);
        if (p.body) {
          const small = document.createElement('div');
          small.style.marginTop = '2px';
          small.textContent = p.body;
          popup.append(small);
        }
        mod.marker([p.lat, p.lng], { icon, title: p.title, keyboard: true }).bindPopup(popup).addTo(layer.current);
      }
    };
    draw();
    window.addEventListener('spotmap:ready', draw);
    return () => window.removeEventListener('spotmap:ready', draw);
  }, [pins]);

  useEffect(() => {
    if (!focus) return;
    const go = () => map.current?.setView([focus.lat, focus.lng], focus.zoom ?? 16);
    go();
    window.addEventListener('spotmap:ready', go);
    return () => window.removeEventListener('spotmap:ready', go);
  }, [focus]);

  return <div ref={el} className={className} role="application" aria-label="Map of study spots. Click the map to place a new spot." />;
}
