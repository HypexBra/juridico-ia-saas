import type { MetadataRoute } from "next";
import { obterAppUrl } from "@/lib/app/url";

/**
 * Só a landing pública entra aqui: `/login`, `/cadastro` etc. estão em
 * `disallow` no robots.ts (sem valor de busca) e `/triagem/[slug]` é um link
 * privado por escritório (compartilhado diretamente com o cliente, nunca
 * pensado para indexação pública).
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
  ];
}
