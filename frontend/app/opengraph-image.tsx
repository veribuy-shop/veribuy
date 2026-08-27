import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'VeriBuy — Verified Electronics Marketplace';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #232F3E 0%, #1a2332 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 80,
            height: 80,
            background: 'linear-gradient(135deg, #2D5016 0%, #4A7C2F 100%)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
          }}
        >
          <span
            style={{
              color: '#F5E6C8',
              fontSize: 50,
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-2px',
            }}
          >
            V
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-1px',
            marginBottom: 16,
          }}
        >
          VeriBuy
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: '#FF9900',
            fontWeight: 600,
            marginBottom: 32,
          }}
        >
          Verified Electronics Marketplace
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 18,
            color: 'rgba(255,255,255,0.7)',
            maxWidth: 600,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Buy and sell verified electronics with confidence. Every device checked by Trust Lens.
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, #2D7A4F 0%, #FF9900 50%, #2D7A4F 100%)',
          }}
        />
      </div>
    ),
    { ...size },
  );
}
