import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: 'linear-gradient(135deg, #2D5016 0%, #4A7C2F 100%)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Shield shape via a bold "V" letter */}
        <span
          style={{
            color: '#F5E6C8',
            fontSize: 20,
            fontWeight: 900,
            lineHeight: 1,
            fontFamily: 'sans-serif',
            letterSpacing: '-1px',
          }}
        >
          V
        </span>
      </div>
    ),
    { ...size },
  );
}
