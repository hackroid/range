import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Typography, Tabs, Tab, Alert,
  CircularProgress,
} from '@mui/material';
import { MyLocation, Search } from '@mui/icons-material';
import { useStore } from '../../store/useStore';
import {
  parseCoordinateString,
  extractCoordsFromGoogleMapsUrl,
} from '../../shared/utils/coordinates';

interface AddPointDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddPointDialog({ open, onClose }: AddPointDialogProps) {
  const addPoint = useStore((s) => s.addPoint);
  const [tab, setTab] = useState(0);
  const [input, setInput] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setInput('');
    setLabel('');
    setError('');
    setLoading(false);
    setTab(0);
  };

  const handleAdd = (lat: number, lng: number) => {
    addPoint(lat, lng, label || undefined);
    reset();
    onClose();
  };

  const handleCoordinateSubmit = () => {
    setError('');
    // Try coordinate string first
    const coords = parseCoordinateString(input);
    if (coords) {
      handleAdd(coords.lat, coords.lng);
      return;
    }
    // Try Google Maps URL
    const urlCoords = extractCoordsFromGoogleMapsUrl(input);
    if (urlCoords) {
      handleAdd(urlCoords.lat, urlCoords.lng);
      return;
    }
    setError('Invalid coordinates or URL. Use format: lat, lng');
  };

  const handleGeolocation = () => {
    setError('');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        handleAdd(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLoading(false);
        setError(`Geolocation failed: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(input)}&limit=1`,
        { headers: { 'User-Agent': 'RangeApp/1.0' } }
      );
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        handleAdd(parseFloat(lat), parseFloat(lon));
      } else {
        setError('No results found for this search.');
      }
    } catch {
      setError('Search failed. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => { reset(); onClose(); }} maxWidth="xs" fullWidth>
      <DialogTitle>Add Center Point</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Label (optional)"
            size="small"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Home, Office"
          />

          <Tabs value={tab} onChange={(_, v) => { setTab(v); setError(''); }} variant="fullWidth">
            <Tab label="Coordinates" />
            <Tab label="Search" />
            <Tab label="Location" icon={<MyLocation />} iconPosition="start" />
          </Tabs>

          {tab === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                label="Coordinates or Google Maps URL"
                size="small"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="51.505, -0.09 or paste URL"
                onKeyDown={(e) => e.key === 'Enter' && handleCoordinateSubmit()}
                multiline
                maxRows={3}
              />
              <Button variant="contained" onClick={handleCoordinateSubmit} disabled={!input.trim()}>
                Add Point
              </Button>
            </Box>
          )}

          {tab === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <TextField
                label="Search place name"
                size="small"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. Tokyo Tower"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={!input.trim() || loading}
                startIcon={loading ? <CircularProgress size={16} /> : <Search />}
              >
                Search
              </Button>
            </Box>
          )}

          {tab === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Use your current location as a center point.
              </Typography>
              <Button
                variant="contained"
                onClick={handleGeolocation}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={16} /> : <MyLocation />}
              >
                Use My Location
              </Button>
            </Box>
          )}

          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { reset(); onClose(); }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
