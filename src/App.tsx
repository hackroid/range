import { useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import {
  AppBar, Toolbar, Typography, IconButton, Box,
  Tooltip, useMediaQuery, Drawer,
  SwipeableDrawer, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import {
  DarkMode, LightMode, SettingsBrightness,
  ImportExport, Map as MapIcon, Menu as MenuIcon,
  SatelliteAlt,
} from '@mui/icons-material';
import { lightTheme, darkTheme } from './theme/theme';
import { useResolvedTheme } from './shared/hooks/useThemeMode';
import { usePersistence } from './shared/hooks/usePersistence';
import { useStore } from './store/useStore';
import MapView from './features/map/MapView';
import Sidebar from './features/sidebar/Sidebar';
import ExportImportDialog from './features/export/ExportImport';

const SIDEBAR_WIDTH = 360;

function AppContent() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const isMobile = useMediaQuery('(max-width:768px)');
  const isTablet = useMediaQuery('(min-width:769px) and (max-width:1024px)');

  const cycleTheme = () => {
    const modes = ['light', 'dark', 'system'] as const;
    const currentIndex = modes.indexOf(settings.themeMode);
    updateSettings({ themeMode: modes[(currentIndex + 1) % 3] });
  };

  const themeIcon = settings.themeMode === 'dark'
    ? <DarkMode />
    : settings.themeMode === 'light'
    ? <LightMode />
    : <SettingsBrightness />;

  const unitToggle = (
    <ToggleButtonGroup
      value={settings.unit}
      exclusive
      onChange={(_, val) => val && updateSettings({ unit: val })}
      size="small"
      sx={{ ml: 1 }}
    >
      <ToggleButton value="km" sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>km</ToggleButton>
      <ToggleButton value="miles" sx={{ px: 1, py: 0.25, fontSize: '0.75rem' }}>mi</ToggleButton>
    </ToggleButtonGroup>
  );

  const sidebarContent = <Sidebar />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="static" elevation={1} color="default" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileDrawerOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <MapIcon color="primary" />
          <Typography variant="h6" fontWeight="bold" sx={{ flexGrow: 1 }}>
            Range
          </Typography>
          {unitToggle}
          <Tooltip title={`Theme: ${settings.themeMode}`}>
            <IconButton onClick={cycleTheme}>{themeIcon}</IconButton>
          </Tooltip>
          <Tooltip title="Satellite view">
            <IconButton
              onClick={() => updateSettings({ satelliteView: !settings.satelliteView })}
              color={settings.satelliteView ? 'primary' : 'default'}
            >
              <SatelliteAlt />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export / Import">
            <IconButton onClick={() => setExportDialogOpen(true)}>
              <ImportExport />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Desktop sidebar */}
        {!isMobile && !isTablet && (
          <Box
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              borderRight: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
            }}
          >
            {sidebarContent}
          </Box>
        )}

        {/* Tablet drawer */}
        {isTablet && (
          <Drawer
            variant="persistent"
            open={true}
            sx={{
              width: SIDEBAR_WIDTH,
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: SIDEBAR_WIDTH,
                position: 'relative',
              },
            }}
          >
            {sidebarContent}
          </Drawer>
        )}

        {/* Mobile drawer */}
        {isMobile && (
          <SwipeableDrawer
            anchor="left"
            open={mobileDrawerOpen}
            onOpen={() => setMobileDrawerOpen(true)}
            onClose={() => setMobileDrawerOpen(false)}
            sx={{
              '& .MuiDrawer-paper': { width: '85vw', maxWidth: SIDEBAR_WIDTH },
            }}
          >
            {sidebarContent}
          </SwipeableDrawer>
        )}

        {/* Map */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <MapView />
        </Box>
      </Box>

      <ExportImportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
      />
    </Box>
  );
}

export default function App() {
  usePersistence();
  const resolvedTheme = useResolvedTheme();
  const theme = resolvedTheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent />
    </ThemeProvider>
  );
}
