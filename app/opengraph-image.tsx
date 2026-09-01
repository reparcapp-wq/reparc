import { ImageResponse } from "next/og";

export const alt = "RepArc — Train. Record. Progress.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#0b0d0c", color: "#f5f3ef", padding: "72px 82px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", background: "radial-gradient(circle at 80% 15%, rgba(247,198,107,.2), transparent 34%)" }} />
      <div style={{ position: "absolute", right: -90, bottom: -190, width: 610, height: 610, border: "3px solid rgba(247,198,107,.22)", borderRadius: "50%" }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 78, height: 78, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #f7c66b", borderRadius: 22, color: "#f7c66b", fontSize: 44, fontWeight: 800 }}>R</div>
          <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: "-2px" }}>RepArc</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#f7c66b", fontSize: 22, fontWeight: 800, letterSpacing: "5px", textTransform: "uppercase" }}>Evidence-aligned training</div>
          <div style={{ marginTop: 22, maxWidth: 850, fontSize: 80, lineHeight: 1.02, letterSpacing: "-5px", fontWeight: 800 }}>Train. Record. Progress.</div>
          <div style={{ marginTop: 28, color: "#a8a29e", fontSize: 25 }}>Focused workouts · Deterministic progression · Offline-first logging</div>
        </div>
      </div>
    </div>,
    size,
  );
}
