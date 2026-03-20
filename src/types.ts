export interface CircleRange {
  id: string;
  radius: number; // always stored in km internally
}

export interface CenterPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  color: string;
  circles: CircleRange[];
  visible: boolean;
}

export type UnitSystem = 'km' | 'miles';
export type ThemeMode = 'light' | 'dark' | 'system';
export type MapProvider = 'osm' | 'google';

export interface AppSettings {
  unit: UnitSystem;
  themeMode: ThemeMode;
  mapProvider: MapProvider;
  satelliteView: boolean;
  googleMapsApiKey: string;
  lastViewport: {
    center: [number, number];
    zoom: number;
  };
}

export interface ColorSlots {
  stored: string[]; // max 10
  recent: string[]; // max 10
}

export interface ExportData {
  version: 1;
  points: CenterPoint[];
  settings: Omit<AppSettings, 'googleMapsApiKey'>;
  colorSlots: ColorSlots;
}
