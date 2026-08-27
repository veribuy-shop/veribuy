import type { Metadata } from 'next';
import ListingDetailContent from './listing-detail-content';
import { productJsonLd } from '@/lib/structured-data';

const LISTING_SERVICE_URL = process.env.LISTING_SERVICE_URL || 'http://localhost:3003';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://veribuy.shop';

interface ListingData {
  id: string;
  title: string;
  description: string;
  brand: string;
  model: string;
  price: number | string;
  currency: string;
  conditionGrade?: 'A' | 'B' | 'C';
  status: string;
  trustLensStatus: string;
}

async function fetchListing(id: string): Promise<ListingData | null> {
  try {
    const response = await fetch(`${LISTING_SERVICE_URL}/listings/${id}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

const GRADE_LABELS: Record<string, string> = {
  A: 'Excellent',
  B: 'Good',
  C: 'Fair',
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchListing(id);

  if (!listing) {
    return {
      title: 'Listing Not Found',
      description: 'This listing does not exist or has been removed.',
      robots: { index: false, follow: true },
    };
  }

  const gradeLabel = listing.conditionGrade
    ? ` — ${GRADE_LABELS[listing.conditionGrade] || listing.conditionGrade} Condition`
    : '';
  const price = typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price;
  const title = `${listing.title}${gradeLabel}`;
  const description = `${listing.brand} ${listing.model} for £${price.toFixed(2)}. Trust Lens verified on VeriBuy.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/listings/${id}`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `/listings/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await fetchListing(id);

  const jsonLd = listing
    ? productJsonLd({
        name: listing.title,
        description: listing.description,
        brand: listing.brand,
        model: listing.model,
        price: typeof listing.price === 'string' ? parseFloat(listing.price) : listing.price,
        currency: listing.currency,
        url: `${SITE_URL}/listings/${id}`,
        conditionGrade: listing.conditionGrade,
        availability: listing.trustLensStatus === 'PASSED' ? 'InStock' : 'PreOrder',
      })
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ListingDetailContent id={id} />
    </>
  );
}
