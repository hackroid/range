# Range — Product Requirements Document

## 1. Overview

**Range** is a frontend-only Progressive Web App (PWA) that visualizes distance ranges as concentric circles around user-defined center points on an interactive map. Users can compare distances from multiple locations at a glance.

**Tech Stack:** React + TypeScript, Material UI (MUI v6), Leaflet (via react-leaflet) + Google Maps option, Vite.

---

## 2. Core Features

### 2.1 Map Display
- Default map provider: OpenStreetMap (free, no API key required)
- Optional Google Maps provider (user provides their own API key)
- Satellite/aerial imagery toggle when available
- Dark-style map tiles when dark mode is active (e.g., CartoDB Dark Matter for OSM)
- Standard map controls: zoom, pan, fullscreen

### 2.2 Center Points
- Support **multiple** center points, each independently configurable
- Each point has a user-editable label (defaults to "Point 1", "Point 2", etc.)
- Methods to set a center point:
  - Click/tap on the map
  - Enter coordinates (lat/lng with input validation)
  - Paste a Google Maps URL (extract coordinates automatically)
  - Use browser geolocation (current location)
  - Search by place name (geocoding via Nominatim for OSM / Google Places for Google Maps)
- If a user clicks the map without having configured any center point yet, show a guided prompt to set up a center point and circle range first

### 2.3 Circle Ranges (Distance Rings)
- Each center point has its own **circle profile**: a set of concentric circles with individual radii
- User inputs radius value for each circle (supports km and miles, togglable)
- Distance labels displayed on each circle ring on the map
- No hard limit on number of circles per point (practical UX limit ~10)
- Circle outlines with distinct visibility against the map

### 2.4 Transparency / Opacity
- Circle opacity auto-adjusts based on the number of circles in a profile
- Innermost circle is always semi-transparent enough to see the underlying map
- Outermost circles are more opaque
- Smooth gradient of opacity from inner to outer

### 2.5 Color Customization
- Each center point's circle profile has its own color
- Color picker supporting: RGB input, HEX input, CMYK input, color wheel, eyedropper/pickup tool
- **Use an existing popular React color picker library** (e.g., `react-colorful` or `@uiw/react-color`) if it covers most needs; build from scratch only if no library suffices
- **10 stored color slots** — user can save favorite colors
- **10 recent color slots** — automatically tracks recently used colors
- Stored and recent colors persist across sessions

---

## 3. Sidebar (Point & Range Manager)

### 3.1 Layout
- **Accordion / collapsible card** design
- Each center point is a card showing: label, coordinates, circle count summary
- Expanded card shows: full circle list with radii, color swatch, edit/delete controls
- "Add Center Point" button at the bottom
- Drag-to-reorder support for points

### 3.2 Circle Management (within each card)
- Add / remove individual circles
- Edit radius inline
- Visual color indicator per profile
- Quick toggle to show/hide a point's circles on the map

---

## 4. Additional Features

### 4.1 Unit Toggle
- Global toggle: kilometers ↔ miles
- All radius inputs and distance labels update accordingly
- Persisted in settings

### 4.2 Export / Import Configuration
- Export all center points, circle profiles, colors, and settings as a JSON file
- Import from a previously exported JSON file
- Validation on import with user-friendly error messages

### 4.3 Stylish Image Export
- **Clean screenshot mode**: captures the current map view as a PNG image
- **Legend mode**: exported image includes a side panel with center point names, circle distances, color keys, and app branding
- User can toggle between clean and legend modes before exporting
- Implementation: use `html-to-image` or `html2canvas` library

### 4.4 Dark Mode
- Light / Dark / System (auto-detect) theme modes
- Theme toggle in app header or settings
- Map tiles switch to dark variants when in dark mode
- MUI theme adapts all components accordingly

---

## 5. Data Persistence

### 5.1 Storage Strategy
- All user data stored client-side using **IndexedDB** (via `idb` or `Dexie.js` wrapper) for structured data (points, profiles, colors, settings)
- Fallback to `localStorage` for simple key-value settings
- **API key storage**: Google Maps API key stored in IndexedDB, never exposed in URLs or exported configs. Warn user that client-side storage has inherent limitations.

### 5.2 What is Persisted
- All center points and their circle profiles
- Stored color slots and recent colors
- Selected map provider and satellite toggle state
- Theme preference (light/dark/system)
- Unit preference (km/miles)
- Last map viewport (center + zoom level)

---

## 6. PWA & Offline Support

- Full PWA with Web App Manifest and Service Worker
- **Installable** on mobile and desktop (Add to Home Screen)
- **Offline support**:
  - App shell (HTML/CSS/JS) cached for offline load
  - Recently viewed map tiles cached via Service Worker (cache-first strategy with size limit)
  - All user data available offline (IndexedDB)
  - Graceful degradation: show cached tiles, indicate when new tiles can't load

---

## 7. Responsive Design

- **Fully responsive** across desktop, tablet, and mobile
- Desktop: sidebar always visible alongside the map
- Tablet: sidebar as a resizable drawer
- Mobile: sidebar as a bottom sheet / swipeable drawer; map takes full screen
- Touch-friendly controls: larger tap targets, swipe gestures for sidebar
- Map controls adapt to screen size

---

## 8. UI / Design System

- **Material UI (MUI) v6** — latest version
- Consistent use of MUI components: Cards, Accordions, Buttons, Inputs, Dialogs, Drawers, Tooltips
- App bar with: app name, theme toggle, settings, export/import actions
- Snackbar notifications for user actions (saved, exported, errors)
- Smooth transitions and animations for sidebar expand/collapse, circle rendering

---

## 9. Technical Architecture

### 9.1 Project Structure
- Modular, well-organized folder structure
- Feature-based organization (e.g., `features/map`, `features/sidebar`, `features/color-picker`)
- Shared components, hooks, and utilities in dedicated folders
- State management: React Context + useReducer or Zustand (lightweight)

### 9.2 Key Libraries (Preliminary)
| Purpose | Library |
|---|---|
| UI Framework | MUI v6 (`@mui/material`) |
| Map (OSM) | `react-leaflet` + `leaflet` |
| Map (Google) | `@vis.gl/react-google-maps` or `@react-google-maps/api` |
| Color Picker | `react-colorful` or `@uiw/react-color` |
| IndexedDB | `idb` or `Dexie.js` |
| Image Export | `html-to-image` |
| PWA/SW | `vite-plugin-pwa` (Workbox) |
| Build Tool | Vite |

### 9.3 Deployment
- Build produces static assets (HTML/CSS/JS)
- Deployable to: GitHub Pages, Vercel, Netlify, any static host, self-hosted (nginx/Docker)
- No server-side dependencies

---

## 10. Verification / Testing Plan
- Unit tests for coordinate parsing, Google Maps URL extraction, unit conversion
- Component tests for sidebar interactions, color picker state
- E2E smoke test: add a center point → add circles → verify circles render on map
- PWA audit via Lighthouse
- Responsive testing across breakpoints
