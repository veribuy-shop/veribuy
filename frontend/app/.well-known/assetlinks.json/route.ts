import { NextResponse } from 'next/server';

/**
 * Tells Android which website links open in the app. Needs ANDROID_CERT_SHA256 in
 * the deployment: the app signing key's fingerprint from Play Console, comma
 * separated if there's more than one.
 */
export function GET() {
  const fingerprints = process.env.ANDROID_CERT_SHA256?.split(',').map((value) => value.trim()).filter(Boolean);
  if (!fingerprints?.length) return new NextResponse(null, { status: 404 });

  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.veribuy.app',
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ]);
}
