import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { ThemeScript } from "@/components/theme/theme-script";
import { Analytics } from "@vercel/analytics/next";
import { obterAppUrl } from "@/lib/app/url";
import "./globals.css";

/* ---- Fontes GLOBAIS unificadas (landing + app interno) ----
   ADR 0016: o produto inteiro agora compartilha a identidade
   editorial. As variáveis históricas do app (--font-display /
   --font-sans) apontam para as MESMAS famílias da landing, então
   as classes font-display/font-sans existentes em ~140 arquivos
   continuam válidas sem nenhum churn:
   · --font-display = Fraunces (serif de display; era Playfair)
   · --font-sans    = Instrument Sans (interface; era Inter)
   · IBM Plex Mono segue dedicado a dados/microtipografia via
     --font-plex / font-mono-ed.
   Playfair e Inter foram REMOVIDOS do carregamento: menos bytes
   de fonte por visita (Fase 28 — perf). */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  // Necessário para resolver URLs absolutas de OG/canonical (sem isso, a
  // imagem gerada por app/opengraph-image.tsx e as tags og:url ficam
  // relativas — preview quebrado ao compartilhar em WhatsApp/LinkedIn).
  metadataBase: new URL(obterAppUrl()),
  title: "Jurídico IA — O trabalho jurídico, finalmente organizado",
  description:
    "Documentos analisados, prazos encontrados no diário oficial, tarefas criadas sozinhas e o cliente informado. Um lugar para o caso inteiro. Comece gratuitamente.",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jurídico IA",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Jurídico IA — O trabalho jurídico, finalmente organizado",
    description:
      "Um lugar para o caso inteiro: documentos, prazos, tarefas e o cliente. Você fica com a parte que só um advogado faz.",
    type: "website",
    locale: "pt_BR",
    siteName: "Jurídico IA",
  },
  twitter: {
    card: "summary",
    title: "Jurídico IA — O trabalho jurídico, finalmente organizado",
    description:
      "Um lugar para o caso inteiro: documentos, prazos, tarefas e o cliente. Comece gratuitamente.",
  },
};

export const viewport: Viewport = {
  // Paleta unificada papel-e-tinta (ADR 0016) + tema escuro (toggle
  // manual, ver components/theme): a cor de chrome do navegador reage à
  // preferência do SO como fallback — quando o usuário troca manualmente
  // via toggle, o <ThemeScript> já corrigiu a classe .dark antes do
  // paint, então a UI do produto está correta mesmo que o chrome do OS
  // fique 1 tom "atrasado" até a preferência do sistema mudar (mesma
  // limitação de qualquer implementação manual, incl. next-themes).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#131210" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Nonce gerado por request em `middleware.ts` — repassado ao ThemeScript
  // para satisfazer a CSP `script-src 'nonce-...'` sem `unsafe-inline`.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="pt-BR"
      // suppressHydrationWarning: a classe `dark` é aplicada por um script
      // inline ANTES da hidratação (ver ThemeScript) — o HTML enviado pelo
      // servidor nunca tem essa classe, então o React veria uma
      // divergência client/server que NÃO é um bug real, é o próprio
      // mecanismo anti-FOUC funcionando. Escopo do supressão é só este
      // atributo do <html>, não silencia outros mismatches da árvore.
      suppressHydrationWarning
      className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-navy text-ice font-sans">
        {/* `strategy="beforeInteractive"` faz o Next.js injetar este script
            no <head> do documento automaticamente durante o SSR e executá-lo
            antes da hidratação, independente de onde é renderizado na árvore
            — não precisa (e não deve) ficar dentro de um <head> manual, que
            conflitaria com o <head> já gerenciado pela Metadata API do App
            Router. Ver docs do next/script. */}
        <ThemeScript nonce={nonce} />
        <PwaRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
