import type { MetadataRoute } from "next";
import { obterAppUrl } from "@/lib/app/url";

export default function robots(): MetadataRoute.Robots {
  const appUrl = obterAppUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Área logada, admin, portal do cliente e API nunca devem ser
      // indexados — são todos autenticados e/ou específicos por escritório,
      // sem valor de busca e potencial vazamento de estrutura interna.
      disallow: ["/app", "/admin", "/api", "/portal", "/login", "/cadastro", "/auth"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
