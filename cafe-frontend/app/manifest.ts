import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hello Cafe - Cafe Management',
    short_name: 'Hello Cafe',
    description:
      "Complete Cafe management: orders, menu, inventory, reports. Nepal's own cafe system.",
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#dc2626',
    orientation: 'any',
    icons: [
      {
        src: '/pwa-icon-192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/orders-desktop.svg',
        sizes: '1280x720',
        type: 'image/svg+xml',
        form_factor: 'wide',
      } as any,
      {
        src: '/screenshots/orders-mobile.svg',
        sizes: '390x844',
        type: 'image/svg+xml',
        form_factor: 'narrow',
      } as any,
    ],
  }
}
