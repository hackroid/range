import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, TextField, Typography, IconButton, Tooltip,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { useStore } from '../../store/useStore';

interface ColorPickerDialogProps {
  open: boolean;
  color: string;
  onClose: () => void;
  onChange: (color: string) => void;
}

export default function ColorPickerDialog({
  open, color, onClose, onChange,
}: ColorPickerDialogProps) {
  const [tempColor, setTempColor] = useState(color);
  const { colorSlots, addStoredColor, removeStoredColor, addRecentColor } = useStore();

  const handleConfirm = () => {
    onChange(tempColor);
    addRecentColor(tempColor);
    onClose();
  };

  // RGB input helpers
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return { r, g, b };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    const clamp = (v: number) => Math.max(0, Math.min(255, v));
    return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  const rgb = hexToRgb(tempColor);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Choose Color</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <HexColorPicker color={tempColor} onChange={setTempColor} style={{ width: '100%' }} />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ minWidth: 30 }}>HEX</Typography>
            <HexColorInput
              color={tempColor}
              onChange={setTempColor}
              prefixed
              style={{
                flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: 4,
                fontFamily: 'monospace', fontSize: 14,
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            {(['r', 'g', 'b'] as const).map((channel) => (
              <TextField
                key={channel}
                label={channel.toUpperCase()}
                type="number"
                size="small"
                value={rgb[channel]}
                inputProps={{ min: 0, max: 255 }}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 0;
                  const newRgb = { ...rgb, [channel]: val };
                  setTempColor(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
                }}
                sx={{ flex: 1 }}
              />
            ))}
          </Box>

          {/* Stored Colors */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Saved Colors</Typography>
              <Tooltip title="Save current color">
                <IconButton size="small" onClick={() => addStoredColor(tempColor)}>
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
              {colorSlots.stored.length === 0 && (
                <Typography variant="caption" color="text.secondary">No saved colors</Typography>
              )}
              {colorSlots.stored.map((c, i) => (
                <Tooltip key={i} title={c}>
                  <Box
                    onClick={() => setTempColor(c)}
                    onContextMenu={(e) => { e.preventDefault(); removeStoredColor(i); }}
                    sx={{
                      width: 28, height: 28, borderRadius: 1, bgcolor: c,
                      cursor: 'pointer', border: '2px solid',
                      borderColor: c === tempColor ? 'primary.main' : 'divider',
                      '&:hover': { transform: 'scale(1.1)' },
                      transition: 'transform 0.1s',
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>

          {/* Recent Colors */}
          {colorSlots.recent.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">Recent Colors</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {colorSlots.recent.map((c, i) => (
                  <Tooltip key={i} title={c}>
                    <Box
                      onClick={() => setTempColor(c)}
                      sx={{
                        width: 28, height: 28, borderRadius: 1, bgcolor: c,
                        cursor: 'pointer', border: '2px solid',
                        borderColor: c === tempColor ? 'primary.main' : 'divider',
                        '&:hover': { transform: 'scale(1.1)' },
                        transition: 'transform 0.1s',
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained">Apply</Button>
      </DialogActions>
    </Dialog>
  );
}
