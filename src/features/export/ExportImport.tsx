import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Alert, CircularProgress,
} from '@mui/material';
import { Download, Upload, Image as ImageIcon } from '@mui/icons-material';
import L from 'leaflet';
import { useStore } from '../../store/useStore';
import { formatDistance } from '../../shared/utils/coordinates';
import type { ExportData } from '../../types';

interface ExportImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportImportDialog({ open, onClose }: ExportImportDialogProps) {
  const { points, settings, colorSlots, hydrate } = useStore();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJson = () => {
    const data: ExportData = {
      version: 1,
      points,
      settings: {
        unit: settings.unit,
        themeMode: settings.themeMode,
        mapProvider: settings.mapProvider,
        satelliteView: settings.satelliteView,
        lastViewport: settings.lastViewport,
      },
      colorSlots,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `range-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSuccess('Configuration exported!');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as ExportData;
        if (!data.version || !data.points || !Array.isArray(data.points)) {
          throw new Error('Invalid config format');
        }
        for (const p of data.points) {
          if (!p.id || typeof p.lat !== 'number' || typeof p.lng !== 'number') {
            throw new Error('Invalid point data');
          }
        }
        hydrate({
          points: data.points,
          settings: data.settings ? { ...settings, ...data.settings } : undefined,
          colorSlots: data.colorSlots,
        });
        setSuccess('Configuration imported successfully!');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse config file');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Wait for all visible Leaflet tiles to finish loading */
  function waitForTilesLoaded(mapEl: HTMLElement): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const tiles = mapEl.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img');
        for (const img of tiles) {
          // Skip hidden tiles (old zoom levels being faded out)
          if (!isTileVisible(img)) continue;
          // If any visible tile is still loading, wait
          if (img.src && (!img.complete || img.naturalWidth === 0)) return false;
        }
        return true;
      };

      if (check()) { resolve(); return; }

      // Poll until tiles are loaded, with timeout
      let elapsed = 0;
      const interval = setInterval(() => {
        elapsed += 100;
        if (check() || elapsed >= 8000) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }

  /** Check if a tile img is actually visible (not from a stale zoom level being faded out) */
  function isTileVisible(img: HTMLImageElement): boolean {
    if (!img.src) return false;
    const style = window.getComputedStyle(img);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) < 0.01) return false;

    // Check parent tile container — Leaflet hides old zoom level containers
    let el: HTMLElement | null = img.parentElement;
    while (el && !el.classList.contains('leaflet-tile-pane')) {
      const ps = window.getComputedStyle(el);
      if (ps.display === 'none' || ps.visibility === 'hidden') return false;
      if (parseFloat(ps.opacity) < 0.01) return false;
      el = el.parentElement;
    }
    return true;
  }

  const captureMap = async (): Promise<HTMLCanvasElement> => {
    const mapEl = document.querySelector('.leaflet-container') as HTMLElement;
    if (!mapEl) throw new Error('Map not found');

    const leafletMap = useStore.getState().mapInstance;
    if (!leafletMap) throw new Error('Map instance not ready');

    // Read fresh state from store — NOT from the React closure which may be stale
    const currentPoints = useStore.getState().points;
    const currentSettings = useStore.getState().settings;

    // Wait for all visible tiles to finish loading before capturing
    await waitForTilesLoaded(mapEl);

    const scale = 2;
    const width = mapEl.offsetWidth;
    const height = mapEl.offsetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);

    // 1. Draw background
    const isDark = (() => {
      const mode = currentSettings.themeMode;
      if (mode === 'dark') return true;
      if (mode === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    })();
    ctx.fillStyle = isDark ? '#1a1a2e' : '#f2efe9';
    ctx.fillRect(0, 0, width, height);

    // 2. Collect only visible, loaded tiles (skip stale zoom-level tiles)
    const tileImages = mapEl.querySelectorAll<HTMLImageElement>('.leaflet-tile-pane img');
    const mapRect = mapEl.getBoundingClientRect();

    interface TileEntry {
      img: HTMLImageElement;
      x: number;
      y: number;
      w: number;
      h: number;
      fetchedImg: HTMLImageElement | null;
    }
    const tiles: TileEntry[] = [];

    for (const img of tileImages) {
      if (!img.complete || img.naturalWidth === 0) continue;
      if (!isTileVisible(img)) continue;

      const tileRect = img.getBoundingClientRect();
      tiles.push({
        img,
        x: tileRect.left - mapRect.left,
        y: tileRect.top - mapRect.top,
        w: tileRect.width,
        h: tileRect.height,
        fetchedImg: null,
      });
    }

    // Fetch all tiles in parallel (for speed) but store results to draw in DOM order
    await Promise.all(
      tiles.map(async (tile) => {
        try {
          const res = await fetch(tile.img.src, { mode: 'cors' });
          const blob = await res.blob();
          tile.fetchedImg = await blobToImage(blob);
        } catch {
          // fetchedImg stays null — will try direct draw as fallback
        }
      })
    );

    // Draw tiles in DOM order to preserve correct z-layering
    for (const tile of tiles) {
      try {
        if (tile.fetchedImg) {
          ctx.drawImage(tile.fetchedImg, tile.x, tile.y, tile.w, tile.h);
        } else {
          ctx.drawImage(tile.img, tile.x, tile.y, tile.w, tile.h);
        }
      } catch {
        // Skip tiles that can't be drawn (CORS tainted, etc.)
      }
    }

    // Reset scale for manual pixel-level drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // 3. Draw circles using Leaflet map projection
    const visiblePoints = currentPoints.filter((p) => p.visible);
    for (const point of visiblePoints) {
      const centerPx = leafletMap.latLngToContainerPoint([point.lat, point.lng]);
      const sortedCircles = [...point.circles].sort((a, b) => b.radius - a.radius);
      const count = sortedCircles.length;
      if (count === 0) continue;

      for (let i = 0; i < sortedCircles.length; i++) {
        const circle = sortedCircles[i];
        const edgeLatLng = L.latLng(point.lat, point.lng).toBounds(circle.radius * 1000 * 2);
        const ne = leafletMap.latLngToContainerPoint(edgeLatLng.getNorthEast());
        const sw = leafletMap.latLngToContainerPoint(edgeLatLng.getSouthWest());
        const radiusPx = Math.abs(ne.x - sw.x) / 2;

        const opacityRange = { min: 0.08, max: 0.35 };
        const fillOpacity = count === 1
          ? 0.15
          : opacityRange.min + (i / (count - 1)) * (opacityRange.max - opacityRange.min);

        // Fill
        ctx.beginPath();
        ctx.arc(centerPx.x * scale, centerPx.y * scale, radiusPx * scale, 0, Math.PI * 2);
        ctx.fillStyle = hexToRgba(point.color, fillOpacity);
        ctx.fill();

        // Stroke
        ctx.beginPath();
        ctx.arc(centerPx.x * scale, centerPx.y * scale, radiusPx * scale, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(point.color, 0.8);
        ctx.lineWidth = 2 * scale;
        ctx.stroke();

        // Distance label on the perimeter
        const bearing = count === 1 ? 0 : -45 + (i * 90) / Math.max(count - 1, 1);
        const rad = (bearing * Math.PI) / 180;
        const lx = centerPx.x * scale + Math.sin(rad) * radiusPx * scale;
        const ly = centerPx.y * scale - Math.cos(rad) * radiusPx * scale;
        const label = formatDistance(circle.radius, currentSettings.unit);

        ctx.font = `${12 * scale}px sans-serif`;
        const metrics = ctx.measureText(label);
        const pad = 3 * scale;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(lx - pad, ly - 12 * scale - pad, metrics.width + pad * 2, 14 * scale + pad * 2);
        ctx.fillStyle = '#333';
        ctx.fillText(label, lx, ly);
      }

      // Point name label at center
      ctx.font = `bold ${13 * scale}px sans-serif`;
      const nameMetrics = ctx.measureText(point.label);
      const nx = centerPx.x * scale - nameMetrics.width / 2;
      const ny = centerPx.y * scale - 10 * scale;
      const pad = 4 * scale;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(nx - pad, ny - 13 * scale, nameMetrics.width + pad * 2, 16 * scale + pad);
      ctx.fillStyle = point.color;
      ctx.fillText(point.label, nx, ny);
    }

    return canvas;
  };

  /** Convert a Blob to an HTMLImageElement — works on all browsers including older iOS Safari */
  function blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load tile')); };
      img.src = url;
    });
  }

  function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  const handleExportImage = async (withLegend: boolean) => {
    setError('');
    setExporting(true);
    try {
      const mapCanvas = await captureMap();

      if (!withLegend) {
        downloadCanvas(mapCanvas, 'range-map.png');
        setSuccess('Map image exported!');
        return;
      }

      // Read fresh state for the legend — NOT from closure
      const currentPoints = useStore.getState().points;
      const currentSettings = useStore.getState().settings;

      // Build a final canvas with map + legend side by side
      const legendWidth = 260;
      const padding = 24;
      const lineHeight = 18;

      // Calculate legend height
      let legendContentHeight = padding + 30; // top padding + title
      for (const p of currentPoints) {
        legendContentHeight += 28; // point name row
        legendContentHeight += lineHeight; // coordinates
        legendContentHeight += p.circles.length * lineHeight; // circles
        legendContentHeight += 12; // gap
      }
      legendContentHeight += 40; // footer

      const finalWidth = mapCanvas.width + legendWidth * 2; // scale factor 2
      const finalHeight = Math.max(mapCanvas.height, legendContentHeight * 2);

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = finalWidth;
      finalCanvas.height = finalHeight;
      const ctx = finalCanvas.getContext('2d')!;

      // Draw map
      ctx.drawImage(mapCanvas, 0, 0);

      // Draw legend background
      const lx = mapCanvas.width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(lx, 0, legendWidth * 2, finalHeight);

      // Draw legend content (all coords in 2x scale)
      const s = 2;
      let y = padding * s;

      // Title
      ctx.fillStyle = '#111111';
      ctx.font = `bold ${18 * s}px sans-serif`;
      ctx.fillText('Range Map', lx + padding * s, y + 16 * s);
      y += 36 * s;

      for (const p of currentPoints) {
        // Color dot + label
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(lx + padding * s + 8 * s, y + 2 * s, 6 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#111111';
        ctx.font = `bold ${13 * s}px sans-serif`;
        ctx.fillText(p.label, lx + padding * s + 22 * s, y + 6 * s);
        y += 22 * s;

        // Coordinates
        ctx.fillStyle = '#666666';
        ctx.font = `${11 * s}px sans-serif`;
        ctx.fillText(`${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`, lx + padding * s, y + 4 * s);
        y += 18 * s;

        // Circles
        for (const c of p.circles) {
          ctx.fillStyle = '#555555';
          ctx.font = `${11 * s}px sans-serif`;
          const unit = currentSettings.unit;
          const val = unit === 'miles' ? (c.radius * 0.621371).toFixed(1) : c.radius.toFixed(1);
          ctx.fillText(`  • ${val} ${unit}`, lx + padding * s + 4 * s, y + 4 * s);
          y += 16 * s;
        }
        y += 10 * s;
      }

      // Footer
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(lx + padding * s, y, (legendWidth - padding * 2) * s, 1);
      y += 12 * s;
      ctx.fillStyle = '#999999';
      ctx.font = `${10 * s}px sans-serif`;
      ctx.fillText('Generated by Range', lx + padding * s, y + 4 * s);

      downloadCanvas(finalCanvas, 'range-map-legend.png');
      setSuccess('Map with legend exported!');
    } catch (err) {
      console.error('Image export error:', err);
      setError('Failed to export image. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const downloadCanvas = (canvas: HTMLCanvasElement, filename: string) => {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Export / Import</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant="subtitle2">Configuration (JSON)</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportJson}
              fullWidth
            >
              Export
            </Button>
            <Button
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
            >
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </Box>

          <Typography variant="subtitle2">Image Export</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={18} /> : <ImageIcon />}
              onClick={() => handleExportImage(false)}
              fullWidth
              disabled={exporting}
            >
              Clean
            </Button>
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={18} /> : <ImageIcon />}
              onClick={() => handleExportImage(true)}
              fullWidth
              disabled={exporting}
            >
              With Legend
            </Button>
          </Box>

          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {success && <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
