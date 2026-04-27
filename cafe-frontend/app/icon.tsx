import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b91c1c",
          color: "white",
          fontSize: 120,
          fontWeight: 800,
          letterSpacing: -2,
        }}
      >
        <div
          style={{
            width: 440,
            height: 440,
            borderRadius: 96,
            background: "rgba(255,255,255,0.14)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: 150, lineHeight: 1 }}>☕</div>
          <div style={{ marginTop: 12 }}>HC</div>
        </div>
      </div>
    ),
    size
  );
}

