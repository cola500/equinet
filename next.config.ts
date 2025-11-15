import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable source maps in production for security
  productionBrowserSourceMaps: false,

  // Security headers
  async headers() {
    const isDev = process.env.NODE_ENV === 'development'

    return [
      {
        source: '/:path*',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Script sources - stricter in production
              isDev
                ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" // Dev: React DevTools need unsafe-eval
                : "script-src 'self' 'unsafe-inline'", // Prod: Remove unsafe-eval
              "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
              "img-src 'self' data: blob: https:", // blob: for image uploads
              "font-src 'self' data:", // Next.js Google Fonts self-hosting
              "connect-src 'self'", // API calls
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
          // Cross-Origin Policies - Spectre protection
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
