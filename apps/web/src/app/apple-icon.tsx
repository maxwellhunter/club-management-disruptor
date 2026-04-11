import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#012d1d",
          borderRadius: 40,
        }}
      >
        <span
          style={{
            fontSize: 100,
            fontFamily: "Georgia, serif",
            fontWeight: 700,
            letterSpacing: -4,
          }}
        >
          <span style={{ color: "#c1ecd4" }}>C</span>
          <span style={{ color: "#16a34a" }}>O</span>
        </span>
      </div>
    ),
    { ...size }
  );
}
