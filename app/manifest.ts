import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RepArc",
    short_name: "RepArc",
    description: "A secure offline-first workout log with evidence-aligned progression guidance.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#0b0d0c",
    theme_color: "#0b0d0c",
    categories: ["fitness", "health", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
