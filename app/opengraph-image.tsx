import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Kaylee Williams - Software Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            "linear-gradient(135deg, #f5f3ff 0%, #ffffff 50%, #f5f3ff 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(139, 92, 246, 0.1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <h1
            style={{
              fontSize: "72px",
              fontWeight: 700,
              color: "#171717",
              margin: 0,
            }}
          >
            Kaylee Williams
          </h1>
          <p
            style={{
              fontSize: "36px",
              color: "#8b5cf6",
              margin: 0,
            }}
          >
            Full-Stack Engineer
          </p>
          <p
            style={{
              fontSize: "24px",
              color: "#6b7280",
              margin: 0,
            }}
          >
            Building c15t & Inth · YC P26
          </p>
        </div>

        {/* Domain */}
        <p
          style={{
            position: "absolute",
            bottom: "40px",
            fontSize: "20px",
            color: "#9ca3af",
          }}
        >
          kaylee.dev
        </p>
      </div>
    ),
    { ...size }
  );
}
