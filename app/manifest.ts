import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jurídico IA — Copiloto jurídico",
    short_name: "Jurídico IA",
    description: "Petições, contratos, triagem de clientes, prazos e financeiro com IA em um só lugar.",
    start_url: "/app/dashboard",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#faf9f5",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
