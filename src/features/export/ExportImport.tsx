import { useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Alert, CircularProgress,
} from '@mui/material';
import { Download, Upload, Image as ImageIcon } from '@mui/icons-material';
import html2canvas from 'html2canvas';
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

  const captureMap = async (): Promise<HTMLCanvasElement> => {
    const mapEl = document.querySelector('.leaflet-container') as HTMLElement;
    if (!mapEl) throw new Error('Map not found');

    const leafletMap = useStore.getState().mapInstance;

    const scale = 2;
    const width = mapEl.offsetWidth;
    const height = mapEl.offsetHeight;

    // 1. Capture just the tile layer via html2canvas
    const tilePane = mapEl.querySelector('.leaflet-tile-pane') as HTMLElement;
    const baseCanvas = await html2canvas(tilePane || mapEl, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      scale,
      backgroundColor: null,
      width,
      height,
      x: 0,
      y: 0,
    });

    // 2. Create final canvas and draw tiles
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(baseCanvas, 0, 0, canvas.width, canvas.height);

    if (!leafletMap) return canvas;

    // 3. Draw circles manually using map projection
    const visiblePoints = points.filter((p) => p.visible);
    for (const point of visiblePoints) {
      const centerPx = leafletMap.latLngToContainerPoint([point.lat, point.lng]);
      const sortedCircles = [...point.circles].sort((a, b) => b.radius - a.radius);
      const count = sortedCircles.length;

      for (let i = 0; i < sortedCircles.length; i++) {
        const circle = sortedCircles[i];
        // Compute pixel radius: project a point on the circle edge
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

        // Distance label on the perimeter (right side, spread by bearing)
        const bearing = count === 1 ? 0 : -45 + (i * 90) / Math.max(count - 1, 1);
        const rad = (bearing * Math.PI) / 180;
        const lx = centerPx.x * scale + Math.sin(rad) * radiusPx * scale;
        const ly = centerPx.y * scale - Math.cos(rad) * radiusPx * scale;
        const label = formatDistance(circle.radius, settings.unit);

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

      // Build a final canvas with map + legend side by side
      const legendWidth = 260;
      const padding = 24;
      const lineHeight = 18;

      // Calculate legend height
      let legendContentHeight = padding + 30; // top padding + title
      for (const p of points) {
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

      for (const p of points) {
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
          const unit = settings.unit;
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
