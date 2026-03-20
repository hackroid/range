import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg'],
    manifest: {
      id: '/',
      start_url: '/',
      scope: '/',
      name: 'Range - Distance Visualizer',
      short_name: 'Range',
      description: 'Visualize distance ranges as concentric circles on an interactive map',
      theme_color: '#1976d2',
      background_color: '#ffffff',
      display: 'standalone',
      orientation: 'any',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      runtimeCaching: [
        {
          // Cache OSM tiles
          urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'osm-tiles',
            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Cache CartoDB dark tiles
          urlPattern: /^https:\/\/[abcd]\.basemaps\.cartocdn\.com\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'carto-tiles',
            expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Cache satellite tiles
          urlPattern: /^https:\/\/server\.arcgisonline\.com\//,
          handler: 'CacheFirst',
          options: {
            cacheName: 'satellite-tiles',
            expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          // Cache Nominatim geocoding
          urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\//,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'geocoding',
            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  }), cloudflare()],
})