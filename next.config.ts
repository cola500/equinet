import type { NextConfig } from "next";
import { spawnSync } from "node:child_process";
import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";

const revision = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ?? crypto.randomUUID();

const nextConfig: NextConfig = {
  // Suppress X-Powered-By: Next.js header (information disclosure)
  poweredByHeader: false,

  // Disable source maps in production for security
  productionBrowserSourceMaps: false,

  // NOTE: experimental.sri removed -- SRI integrity hashes don't survive Vercel's
  // post-build processing (compression/CDN), causing hash mismatches that block
  // script loading entirely. unsafe-inline in CSP covers inline scripts instead.

  // TypeScript errors checked separately in CI - skip during build to avoid timeout
  typescript: {
    ignoreBuildErrors: true,
  },

  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'

    return [
      // Relaxed headers for map tiles and routing (route-planning page)
      {
        source: '/provider/route-planning',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              isDev
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" // Dev: React DevTools need unsafe-eval
                : "script-src 'self' 'unsafe-inline'", // Prod: SRI hashes don't cover inline scripts on Vercel
              "style-src 'self' 'unsafe-inline'", // Required: Tailwind CSS + dynamic style={} attributes
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://router.project-osrm.org", // Allow OSRM API
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              isDev ? "" : "upgrade-insecure-requests",
            ].filter(Boolean).join('; '),
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none', // Disable COEP for map tiles
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin', // Allow cross-origin resources
          },
        ],
      },
      // Service worker must not be cached by the browser
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Script sources - unsafe-inline required: Next.js injects inline scripts that SRI can't cover on Vercel
              isDev
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" // Dev: React DevTools need unsafe-eval
                : "script-src 'self' 'unsafe-inline'", // Prod: SRI covers external scripts, inline still needed
              "style-src 'self' 'unsafe-inline'", // Required: Tailwind CSS + dynamic style={} attributes
              "img-src 'self' data: blob: https:", // blob: for image uploads
              "font-src 'self' data:", // Next.js Google Fonts self-hosting
              "connect-src 'self'", // API calls
              "worker-src 'self' blob:", // browser-image-compression uses Web Workers via blob URLs
              "frame-ancestors 'none'", // Clickjacking protection
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'", // Block Flash, Java, etc.
              isDev ? "" : "upgrade-insecure-requests", // Force HTTPS in production
            ].filter(Boolean).join('; '),
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions Policy - expanded
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
          // XSS Protection (legacy browsers)
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          // HSTS - Force HTTPS (production only)
          ...(isDev ? [] : [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          }]),
          // Cross-Origin Policies
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'cross-origin', // Allow Supabase Storage images to be loaded
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none', // Required for cross-origin images (Supabase Storage)
          },
        ],
      },
    ];
  },
};

// Sentry configuration
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
};

// Wrap with Serwist (service worker)
// Active in all environments by default. Opt-out with DISABLE_SW=true.
// Standard `dev` (Turbopack) should use DISABLE_SW=true; `dev:offline` runs webpack with SW enabled.
const withSerwist = withSerwistInit({
  cacheOnNavigation: true,
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.DISABLE_SW === "true",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
})

// Wrap with Sentry config (outermost wrapper)
export default withSentryConfig(withSerwist(nextConfig), sentryWebpackPluginOptions);
