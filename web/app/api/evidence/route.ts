import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/api-auth';
import { sanitizeEvidenceItem } from '@/lib/sanitize';

const EVIDENCE_SERVICE_URL = process.env.EVIDENCE_SERVICE_URL || 'http://localhost:3006';

export async function POST(req: NextRequest) {
  try {
    // Get and validate access token
    const authResult = getAccessToken(req);
    if ('error' in authResult) {
      return authResult.error;
    }

    const formData = await req.formData();

    // Forward the formData to evidence service with authorization
    const response = await fetch(`${EVIDENCE_SERVICE_URL}/evidence/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authResult.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.message || 'Failed to upload evidence' },
        { status: response.status }
      );
    }

    const data = await response.json();
    // Return only the safe fields — not file size, mime type, or internal metadata
    return NextResponse.json(sanitizeEvidenceItem(data), { status: 201 });
  } catch (error) {
    console.error('Error uploading evidence:', error);
    return NextResponse.json(
      { message: 'Failed to upload evidence' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const listingId = searchParams.get('listingId');
    const sellerId = searchParams.get('sellerId');

    // Evidence by sellerId is sensitive — require auth
    if (sellerId) {
      const authResult = getAccessToken(req);
      if ('error' in authResult) {
        return authResult.error;
      }
    }

    let url = `${EVIDENCE_SERVICE_URL}/evidence`;

    if (listingId) {
      url += `/listing/${listingId}`;
    } else if (sellerId) {
      url += `/seller/${sellerId}`;
    } else {
      return NextResponse.json(
        { message: 'listingId or sellerId is required' },
        { status: 400 },
      );
    }

    // Build headers — include auth token when querying by sellerId, or when logged in
    const headers: HeadersInit = {};
    const authResult = getAccessToken(req);
    if (!('error' in authResult)) {
      headers['Authorization'] = `Bearer ${authResult.token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { message: error.message || 'Failed to fetch evidence' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Sanitize each item — strip fileSize, mimeType, and internal metadata
    const rawItems: any[] = Array.isArray(data) ? data : (data.data ?? data.items ?? []);
    const items = rawItems.map(sanitizeEvidenceItem);
    // Return as { items: [] } so all consumers can use evidenceData.items
    return NextResponse.json({ items });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json(
      { message: 'Failed to fetch evidence' },
      { status: 500 },
    );
  }
}
