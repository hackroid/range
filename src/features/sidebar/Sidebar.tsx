import { useState } from 'react';
import {
  Box, Button, Typography, Divider,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useStore } from '../../store/useStore';
import PointCard from './PointCard';
import AddPointDialog from './AddPointDialog';

export default function Sidebar() {
  const points = useStore((s) => s.points);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="h6" fontWeight="bold">
          Center Points
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Click on the map or use the button below to add points
        </Typography>
      </Box>

      <Divider />

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        {points.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No center points yet. Click on the map or use the button below to add one.
            </Typography>
          </Box>
        )}

        {points.map((point) => (
          <PointCard key={point.id} point={point} />
        ))}
      </Box>

      <Divider />

      <Box sx={{ p: 2 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAddDialogOpen(true)}
        >
          Add Center Point
        </Button>
      </Box>

      <AddPointDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
      />
    </Box>
  );
}
