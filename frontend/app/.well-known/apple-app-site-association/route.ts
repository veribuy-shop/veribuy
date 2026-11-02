import { NextResponse } from 'next/server';

/** Tells iOS which website links open in the app. Needs APPLE_TEAM_ID in the deployment. */
export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) return new NextResponse(null, { status: 404 });

  return NextResponse.json({
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.com.veribuy.app`],
          components: [
            { '/': '/listings/create', exclude: true },
            { '/': '/listings/*' },
            { '/': '/orders/*' },
            { '/': '/offers' },
            { '/': '/messages' },
          ],
        },
      ],
    },
  });
}
