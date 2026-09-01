import type { MetadataRoute } from "next";
import { obterAppUrl } from "@/lib/app/url";
import { BLOG_POSTS } from "@/lib/blog-posts";

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
      url: `${appUrl}/termos`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${appUrl}/privacidade`,
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
    {
      url: `${appUrl}/comparativo/juridico-ia-vs-astrea`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${appUrl}/comparativo/juridico-ia-vs-advbox`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${appUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    ...BLOG_POSTS.map((post) => ({
      url: `${appUrl}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAtIso),
      changeFrequency: "yearly" as const,
      priority: 0.5,
    })),
  ];
}
