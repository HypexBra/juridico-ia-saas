import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/marketing/footer";
import { IconArrowRight } from "@/components/marketing/icons";
import { Nav } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";
import { obterAppUrl } from "@/lib/app/url";
import { BLOG_POSTS, obterBlogPost, type BlogBlock } from "@/lib/blog-posts";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = obterBlogPost(slug);
  if (!post) {
    return { title: "Artigo não encontrado — Jurídico IA" };
  }
  return {
    title: `${post.title} — Jurídico IA`,
    description: post.description,
    alternates: {
      canonical: `/blog/${post.slug}`,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAtIso,
    },
  };
}

function renderBloco(bloco: BlogBlock, indice: number) {
  switch (bloco.type) {
    case "h2":
      return (
        <h2 key={indice} className="mt-10 font-serif-ed text-2xl font-semibold tracking-tight text-ink">
          {bloco.text}
        </h2>
      );
    case "h3":
      return (
        <h3 key={indice} className="mt-8 font-serif-ed text-xl font-semibold tracking-tight text-ink">
          {bloco.text}
        </h3>
      );
    case "ul":
      return (
        <ul key={indice} className="mt-4 list-disc space-y-2 pl-5">
          {(bloco.items ?? []).map((item) => (
            <li key={item} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ul>
      );
    case "p":
    default:
      return (
        <p key={indice} className="mt-4 leading-relaxed">
          {bloco.text}
        </p>
      );
  }
}

/**
 * `BlogPosting` gerado a partir dos mesmos campos do artigo (título,
 * descrição, data de publicação) — sem uma segunda cópia de conteúdo
 * divergente do que é renderizado na página.
 */
function construirJsonLd(appUrl: string, post: ReturnType<typeof obterBlogPost>) {
  if (!post) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${appUrl}/blog/${post.slug}#artigo`,
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAtIso,
    dateModified: post.publishedAtIso,
    inLanguage: "pt-BR",
    url: `${appUrl}/blog/${post.slug}`,
    mainEntityOfPage: `${appUrl}/blog/${post.slug}`,
    author: {
      "@type": "Organization",
      name: "Jurídico IA",
      url: appUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Jurídico IA",
      url: appUrl,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = obterBlogPost(slug);
  if (!post) {
    notFound();
  }

  const jsonLd = construirJsonLd(obterAppUrl(), post);

  return (
    <div className="marketing-root flex min-h-full flex-1 flex-col bg-paper font-sans-ed text-ink">
      <Nav />
      <main id="conteudo" className="flex-1 py-32 md:py-40">
        <article className="mx-auto max-w-3xl px-5 md:px-10">
          <Reveal>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 font-mono-ed text-[11px] uppercase tracking-[0.16em] text-ink-3 transition-colors hover:text-ink"
            >
              <IconArrowRight className="h-3.5 w-3.5 rotate-180" aria-hidden />
              Blog
            </Link>
            <p className="mt-6 font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">
              {post.kicker} · {post.publishedAt} · {post.readingMinutes} min de leitura
            </p>
            <h1 className="mt-4 font-serif-ed text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl">
              {post.title}
            </h1>
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-2">
              {post.description}
            </p>
          </Reveal>

          <Reveal delayMs={80}>
            <div className="mt-12 max-w-prose text-base leading-relaxed text-ink-2">
              {post.blocks.map((bloco, indice) => renderBloco(bloco, indice))}
            </div>
          </Reveal>

          <Reveal delayMs={120}>
            <div className="mt-16 border-t border-ink/10 pt-10">
              <p className="max-w-prose text-base leading-relaxed text-ink-2">
                Quer ver esses mecanismos funcionando num caso real?
              </p>
              <Link
                href="/cadastro"
                className="mt-4 inline-flex items-center gap-2 rounded-none bg-ink px-6 py-3 font-sans-ed text-sm font-medium text-paper transition-colors hover:bg-ink/90"
              >
                Começar gratuitamente
                <IconArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </Reveal>
        </article>
      </main>
      <Footer />
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
    </div>
  );
}
