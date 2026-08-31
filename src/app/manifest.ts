import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA (§1: aplicación web responsiva instalable, sin app nativa).
 * Los iconos se exportaron desde `brand/embate_app-icon_v1.svg`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Embate — Sala de comando para tus torneos",
    short_name: "Embate",
    description:
      "Gestión de torneos competitivos: cruces automáticos, doble confirmación de resultados y reputación real de jugadores.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0D12",
    theme_color: "#0B0D12",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
