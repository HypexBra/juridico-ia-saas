import type { MetadataRoute } from "next";
import { obterAppUrl } from "@/lib/app/url";

/**
 * Só a landing pública e as páginas legais estáticas entram aqui: `/login`,
 * `/cadastro` etc. estão em `disallow` no robots.ts (sem valor de busca) e
 * `/triagem/[slug]` é um link privado por escritório (compartilhado
 * diretamente com o cliente, nunca pensado para indexação pública).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = obterAppUrl();

  return [
    {
      url: appUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${appUrl}/termos-de-uso`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${appUrl}/politica-de-privacidade`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${appUrl}/exclusao-de-dados`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
