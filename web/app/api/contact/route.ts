import { NextRequest, NextResponse } from 'next/server';

const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3008';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromName, fromEmail, subject, message } = body;

    if (!fromName || !fromEmail || !subject || !message) {
      return NextResponse.json(
        { message: 'All fields are required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/notifications/contact-us`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromName, fromEmail, subject, message }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { message: data.message || 'Failed to send message' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('[contact API] Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
