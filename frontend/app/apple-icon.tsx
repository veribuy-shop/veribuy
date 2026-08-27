import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(135deg, #2D5016 0%, #4A7C2F 100%)',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#F5E6C8',
            fontSize: 110,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: 'sans-serif',
            letterSpacing: '-4px',
          }}
        >
          V
        </span>
      </div>
    ),
    { ...size },
  );
}
