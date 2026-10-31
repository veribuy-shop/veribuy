import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',

  // ioredis is a native Node dependency used only in server-side BFF route
  // handlers — never bundle it into the client or server bundles.
  serverExternalPackages: ['ioredis'],

  // Remove the X-Powered-By: Next.js header for security
  poweredByHeader: false,

  // Images: allow Cloudinary as a remote pattern for evidence/listing images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Prevent clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // Prevent MIME type sniffing
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin', // Control referrer information
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(self)', // Restrict browser features
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block', // Enable XSS protection (legacy browsers)
          },
          {
            // HSTS — tell browsers to only use HTTPS for the next year
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-eval' is only needed by the dev server (React Refresh). 'unsafe-inline'
              // remains for Next.js inline bootstrap scripts until nonce-based CSP is adopted.
              process.env.NODE_ENV === 'development'
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com"
                : "script-src 'self' 'unsafe-inline' https://js.stripe.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'", // Allow inline styles (Tailwind)
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              // In production the Next.js server calls backend services directly (server-side);
              // the browser only needs to connect to this origin + Stripe.
              // http://localhost:* is intentionally omitted from production CSP.
              process.env.NODE_ENV === 'development'
                ? "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com http://localhost:*"
                : "connect-src 'self' https://api.stripe.com https://*.stripe.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
