import { useState } from 'react';
import {
  Accordion, AccordionSummary, AccordionDetails,
  Box, Typography, IconButton, TextField, Tooltip,
  Switch, FormControlLabel, Button, Chip,
} from '@mui/material';
import {
  ExpandMore, Delete, MyLocation,
  Add as AddIcon, Close as CloseIcon,
} from '@mui/icons-material';
import { useStore } from '../../store/useStore';
import { kmToMiles, milesToKm } from '../../shared/utils/coordinates';
import ColorPickerDialog from '../color-picker/ColorPickerDialog';
import type { CenterPoint } from '../../types';

interface PointCardProps {
  point: CenterPoint;
}

export default function PointCard({ point }: PointCardProps) {
  const {
    updatePoint, removePoint, addCircle, updateCircle, removeCircle,
    settings, expandedPointId, setExpandedPointId, requestFlyTo,
  } = useStore();

  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelValue, setLabelValue] = useState(point.label);

  const isExpanded = expandedPointId === point.id;
  const unit = settings.unit;

  const displayRadius = (km: number) =>
    unit === 'miles' ? parseFloat(kmToMiles(km).toFixed(2)) : parseFloat(km.toFixed(2));

  const toKm = (value: number) =>
    unit === 'miles' ? milesToKm(value) : value;

  const handleAddCircle = () => {
    const lastRadius = point.circles.length > 0
      ? point.circles[point.circles.length - 1].radius
      : 0;
    addCircle(point.id, lastRadius + 5);
  };

  return (
    <>
      <Accordion
        expanded={isExpanded}
        onChange={(_, expanded) => setExpandedPointId(expanded ? point.id : null)}
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mr: 1 }}>
            <Box
              sx={{
                width: 16, height: 16, borderRadius: '50%',
                bgcolor: point.color, flexShrink: 0, cursor: 'pointer',
                border: '2px solid', borderColor: 'divider',
              }}
              onClick={(e) => { e.stopPropagation(); setColorPickerOpen(true); }}
            />
            {editingLabel ? (
              <TextField
                size="small"
                value={labelValue}
                onChange={(e) => setLabelValue(e.target.value)}
                onBlur={() => {
                  updatePoint(point.id, { label: labelValue || point.label });
                  setEditingLabel(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updatePoint(point.id, { label: labelValue || point.label });
                    setEditingLabel(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
                sx={{ flex: 1 }}
                inputProps={{ style: { padding: '4px 8px' } }}
              />
            ) : (
              <Typography
                variant="subtitle2"
                onDoubleClick={(e) => { e.stopPropagation(); setEditingLabel(true); setLabelValue(point.label); }}
                sx={{ flex: 1, cursor: 'text' }}
                noWrap
              >
                {point.label}
              </Typography>
            )}
            <Chip
              label={`${point.circles.length} ring${point.circles.length !== 1 ? 's' : ''}`}
              size="small"
              variant="outlined"
            />
            <Tooltip title="Center map on this point">
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); requestFlyTo(point.id); }}
              >
                <MyLocation fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* Coordinates */}
            <Typography variant="caption" color="text.secondary">
              {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
            </Typography>

            {/* Visibility toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={point.visible}
                    onChange={(e) => updatePoint(point.id, { visible: e.target.checked })}
                  />
                }
                label={<Typography variant="body2">Visible</Typography>}
              />
              <Tooltip title="Delete point">
                <IconButton size="small" color="error" onClick={() => removePoint(point.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Circles */}
            <Typography variant="caption" fontWeight="bold">Distance Rings</Typography>
            {point.circles.map((circle) => (
              <Box key={circle.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextField
                  type="number"
                  size="small"
                  value={displayRadius(circle.radius)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      updateCircle(point.id, circle.id, toKm(val));
                    }
                  }}
                  inputProps={{ min: 0.1, step: 0.5 }}
                  sx={{ flex: 1 }}
                  InputProps={{
                    endAdornment: (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        {unit}
                      </Typography>
                    ),
                  }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeCircle(point.id, circle.id)}
                  disabled={point.circles.length <= 1}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddCircle}
              variant="outlined"
            >
              Add Ring
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      <ColorPickerDialog
        open={colorPickerOpen}
        color={point.color}
        onClose={() => setColorPickerOpen(false)}
        onChange={(color) => updatePoint(point.id, { color })}
      />
    </>
  );
}
