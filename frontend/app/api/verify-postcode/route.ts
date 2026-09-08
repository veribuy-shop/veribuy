import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPostcode = searchParams.get('postcode');

  if (!rawPostcode || !rawPostcode.trim()) {
    return NextResponse.json({ valid: false, message: 'Postcode required' }, { status: 400 });
  }

  const postcode = rawPostcode.trim().replace(/\s+/g, '').toUpperCase();
  const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;

  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 86400 }, // Cache 24 hours
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 200 && data.result) {
        const res = data.result;
        return NextResponse.json({
          valid: true,
          postcode: res.postcode,
          adminDistrict: res.admin_district,
          adminCounty: res.admin_county || res.admin_district,
          region: res.region,
          country: res.country,
          latitude: res.latitude,
          longitude: res.longitude,
        });
      }
    }
  } catch (error) {
    console.warn('[Postcode API] Live lookup failed:', error);
  }

  // Fallback regex validation if offline / network hiccup
  if (ukPostcodeRegex.test(postcode)) {
    return NextResponse.json({
      valid: true,
      postcode: rawPostcode.trim().toUpperCase(),
      adminDistrict: 'UK Region',
      adminCounty: 'United Kingdom',
      region: 'United Kingdom',
      country: 'United Kingdom',
    });
  }

  return NextResponse.json({
    valid: false,
    message: 'Please enter a valid UK postcode (e.g. M1 1AA, SW1A 1AA)',
  }, { status: 400 });
}
