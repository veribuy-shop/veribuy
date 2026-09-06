import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

const NOTIFICATION_SERVICE_URL = getBackendUrl();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phoneNumber, email, message, preferredTime } = body;

    if (!name || !phoneNumber) {
      return NextResponse.json(
        { message: 'Name and phone number are required.' },
        { status: 400 },
      );
    }

    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/notifications/request-callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phoneNumber, email, message, preferredTime }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Failed to submit callback request.' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[contact callback API] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 },
    );
  }
}
