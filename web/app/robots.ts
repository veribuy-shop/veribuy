import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://veribuy.shop';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/dashboard/',
          '/admin',
          '/admin/',
          '/checkout',
          '/checkout/',
          '/orders',
          '/orders/',
          '/settings',
          '/settings/',
          '/profile',
          '/profile/',
          '/listings/create',
          '/listings/create/',
          '/listings/*/edit',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
