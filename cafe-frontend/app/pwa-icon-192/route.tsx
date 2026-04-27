import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#b91c1c',
          color: 'white',
          fontSize: 48,
          fontWeight: 800,
          letterSpacing: -1,
        }}
      >
        <div
          style={{
            width: 164,
            height: 164,
            borderRadius: 36,
            background: 'rgba(255,255,255,0.14)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 56, lineHeight: 1 }}>☕</div>
          <div style={{ marginTop: 4 }}>HC</div>
        </div>
      </div>
    ),
    { width: 192, height: 192 }
  )
}
