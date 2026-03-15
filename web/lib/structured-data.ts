/**
 * JSON-LD structured data helpers for SEO.
 *
 * Each function returns a plain object conforming to a Schema.org type.
 * Render with: <script type="application/ld+json">{JSON.stringify(data)}</script>
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://veribuy.shop';

/* ------------------------------------------------------------------ */
/*  Organization — used in root layout                                 */
/* ------------------------------------------------------------------ */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VeriBuy',
    url: SITE_URL,
    logo: `${SITE_URL}/icon`,
    description: 'Verified electronics marketplace. Every device checked by Trust Lens.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'veribuy.shop@gmail.com',
      contactType: 'customer support',
    },
  };
}

/* ------------------------------------------------------------------ */
/*  WebSite + SearchAction — used on homepage                          */
/* ------------------------------------------------------------------ */
export function webSiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'VeriBuy',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/browse?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Product — used on /listings/[id]                                   */
/* ------------------------------------------------------------------ */
export interface ProductJsonLdInput {
  name: string;
  description: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  imageUrl?: string;
  url: string;
  conditionGrade?: 'A' | 'B' | 'C';
  availability: 'InStock' | 'OutOfStock' | 'PreOrder';
}

const CONDITION_MAP: Record<string, string> = {
  A: 'https://schema.org/NewCondition',
  B: 'https://schema.org/UsedCondition',
  C: 'https://schema.org/UsedCondition',
};

export function productJsonLd(input: ProductJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    brand: {
      '@type': 'Brand',
      name: input.brand,
    },
    model: input.model,
    ...(input.imageUrl ? { image: input.imageUrl } : {}),
    url: input.url,
    ...(input.conditionGrade
      ? { itemCondition: CONDITION_MAP[input.conditionGrade] || 'https://schema.org/UsedCondition' }
      : {}),
    offers: {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: input.currency,
      availability: `https://schema.org/${input.availability}`,
      seller: {
        '@type': 'Organization',
        name: 'VeriBuy',
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  FAQPage — used on /help                                            */
/* ------------------------------------------------------------------ */
export interface FaqItem {
  question: string;
  answer: string;
}

export function faqPageJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}
