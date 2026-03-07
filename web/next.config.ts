import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // standalone output is required for the Docker/self-hosted build (web/Dockerfile).
  // Vercel ignores this setting and uses its own build pipeline, so it is safe to keep.
  output: 'standalone',

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
              // SEC-10: 'unsafe-eval' removed (prevents eval-based code execution).
              // 'unsafe-inline' replaced with 'strict-dynamic' so explicitly allowed
              // scripts (Stripe SDK) can load their own dynamic sub-scripts.
              "script-src 'self' 'strict-dynamic' https://js.stripe.com", // Allow Stripe SDK
              "style-src 'self' 'unsafe-inline'", // Allow inline styles (Tailwind)
              "img-src 'self' data: https: http:",
              "font-src 'self' data:",
              // In production the Next.js server calls backend services directly (server-side);
              // the browser only needs to connect to this origin + Stripe.
              // http://localhost:* is intentionally omitted from production CSP.
              process.env.NODE_ENV === 'development'
                ? "connect-src 'self' https://api.stripe.com https://*.stripe.com http://localhost:*"
                : "connect-src 'self' https://api.stripe.com https://*.stripe.com",
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
