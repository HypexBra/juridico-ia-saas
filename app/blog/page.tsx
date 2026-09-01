import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/marketing/footer";
import { IconArrowRight } from "@/components/marketing/icons";
import { Nav } from "@/components/marketing/nav";
import { Reveal } from "@/components/marketing/reveal";
import { BLOG_POSTS } from "@/lib/blog-posts";

export const metadata: Metadata = {
  title: "Blog: Jurídico IA",
  description:
    "Artigos práticos sobre prazos processuais, auditoria de peças e uso responsável de inteligência artificial na advocacia.",
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogIndexPage() {
  return (
    <div className="marketing-root flex min-h-full flex-1 flex-col bg-paper font-sans-ed text-ink">
      <Nav />
      <main id="conteudo" className="flex-1 py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-5 md:px-10">
          <Reveal>
            <p className="font-mono-ed text-xs uppercase tracking-[0.2em] text-ink-3">Blog</p>
            <h1 className="mt-4 font-serif-ed text-4xl leading-[1.05] tracking-tight text-ink md:text-5xl">
              Notas práticas sobre a rotina do escritório.
            </h1>
            <p className="mt-5 max-w-prose text-lg leading-relaxed text-ink-2">
              Prazos, auditoria de peças e uso responsável de inteligência
              artificial no direito: sem propaganda, com o que dá pra aplicar
              na prática.
            </p>
          </Reveal>

          <div className="mt-16 divide-y divide-ink/10 border-y border-ink/10">
            {BLOG_POSTS.map((post, indice) => (
              <Reveal key={post.slug} delayMs={indice * 80}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group grid grid-cols-1 gap-3 py-8 transition-colors hover:bg-paper-2 md:grid-cols-[auto_1fr_auto] md:items-center md:gap-8 md:px-4"
                >
                  <span className="font-mono-ed text-[11px] uppercase tracking-[0.16em] text-ink-3 md:w-32">
                    {post.publishedAt}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif-ed text-2xl leading-tight tracking-tight text-ink">
                      {post.title}
                    </span>
                    <span className="mt-1.5 block max-w-prose text-sm leading-relaxed text-ink-2">
                      {post.description}
                    </span>
                    <span className="mt-2 block font-mono-ed text-[11px] uppercase tracking-[0.16em] text-ink-3">
                      {post.readingMinutes} min de leitura
                    </span>
                  </span>
                  <IconArrowRight className="hidden h-4 w-4 shrink-0 text-ink-3 transition-all group-hover:translate-x-0.5 group-hover:text-accent md:block" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
