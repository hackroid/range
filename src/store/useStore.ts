import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { CenterPoint, AppSettings, ColorSlots } from '../types';

function generateId(): string {
  return crypto.randomUUID();
}

const DEFAULT_COLORS = [
  '#2196F3', '#F44336', '#4CAF50', '#FF9800', '#9C27B0',
  '#00BCD4', '#E91E63', '#8BC34A', '#FF5722', '#3F51B5',
];

interface AppState {
  // Center points
  points: CenterPoint[];
  addPoint: (lat: number, lng: number, label?: string) => string;
  updatePoint: (id: string, updates: Partial<Omit<CenterPoint, 'id'>>) => void;
  removePoint: (id: string) => void;
  reorderPoints: (fromIndex: number, toIndex: number) => void;

  // Circles
  addCircle: (pointId: string, radius: number) => void;
  updateCircle: (pointId: string, circleId: string, radius: number) => void;
  removeCircle: (pointId: string, circleId: string) => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Color slots
  colorSlots: ColorSlots;
  addStoredColor: (color: string) => void;
  removeStoredColor: (index: number) => void;
  addRecentColor: (color: string) => void;

  // Sidebar
  expandedPointId: string | null;
  setExpandedPointId: (id: string | null) => void;

  // Map commands
  flyToRequest: { pointId: string; ts: number } | null;
  requestFlyTo: (pointId: string) => void;

  // Hydration
  hydrate: (data: { points?: CenterPoint[]; settings?: AppSettings; colorSlots?: ColorSlots }) => void;
}

export const useStore = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    points: [],

    addPoint: (lat, lng, label) => {
      const id = generateId();
      const pointCount = get().points.length;
      const color = DEFAULT_COLORS[pointCount % DEFAULT_COLORS.length];
      const newPoint: CenterPoint = {
        id,
        label: label || `Point ${pointCount + 1}`,
        lat,
        lng,
        color,
        circles: [{ id: generateId(), radius: 5 }],
        visible: true,
      };
      set((s) => ({ points: [...s.points, newPoint], expandedPointId: id }));
      return id;
    },

    updatePoint: (id, updates) => {
      set((s) => ({
        points: s.points.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      }));
    },

    removePoint: (id) => {
      set((s) => ({
        points: s.points.filter((p) => p.id !== id),
        expandedPointId: s.expandedPointId === id ? null : s.expandedPointId,
      }));
    },

    reorderPoints: (fromIndex, toIndex) => {
      set((s) => {
        const points = [...s.points];
        const [moved] = points.splice(fromIndex, 1);
        points.splice(toIndex, 0, moved);
        return { points };
      });
    },

    addCircle: (pointId, radius) => {
      const circleId = generateId();
      set((s) => ({
        points: s.points.map((p) =>
          p.id === pointId
            ? { ...p, circles: [...p.circles, { id: circleId, radius }] }
            : p
        ),
      }));
    },

    updateCircle: (pointId, circleId, radius) => {
      set((s) => ({
        points: s.points.map((p) =>
          p.id === pointId
            ? {
                ...p,
                circles: p.circles.map((c) =>
                  c.id === circleId ? { ...c, radius } : c
                ),
              }
            : p
        ),
      }));
    },

    removeCircle: (pointId, circleId) => {
      set((s) => ({
        points: s.points.map((p) =>
          p.id === pointId
            ? { ...p, circles: p.circles.filter((c) => c.id !== circleId) }
            : p
        ),
      }));
    },

    settings: {
      unit: 'km',
      themeMode: 'system',
      mapProvider: 'osm',
      satelliteView: false,
      googleMapsApiKey: '',
      lastViewport: {
        center: [51.505, -0.09],
        zoom: 10,
      },
    },

    updateSettings: (updates) => {
      set((s) => ({ settings: { ...s.settings, ...updates } }));
    },

    colorSlots: {
      stored: [],
      recent: [],
    },

    addStoredColor: (color) => {
      set((s) => {
        const stored = [color, ...s.colorSlots.stored.filter((c) => c !== color)].slice(0, 10);
        return { colorSlots: { ...s.colorSlots, stored } };
      });
    },

    removeStoredColor: (index) => {
      set((s) => {
        const stored = [...s.colorSlots.stored];
        stored.splice(index, 1);
        return { colorSlots: { ...s.colorSlots, stored } };
      });
    },

    addRecentColor: (color) => {
      set((s) => {
        const recent = [color, ...s.colorSlots.recent.filter((c) => c !== color)].slice(0, 10);
        return { colorSlots: { ...s.colorSlots, recent } };
      });
    },

    expandedPointId: null,
    setExpandedPointId: (id) => set({ expandedPointId: id }),

    flyToRequest: null,
    requestFlyTo: (pointId) => set({ flyToRequest: { pointId, ts: Date.now() } }),

    hydrate: (data) => {
      set((s) => ({
        points: data.points ?? s.points,
        settings: data.settings ? { ...s.settings, ...data.settings } : s.settings,
        colorSlots: data.colorSlots ?? s.colorSlots,
      }));
    },
  }))
);
