import type { Metadata, Viewport } from "next";
import { Fraunces, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { Analytics } from "@vercel/analytics/next";
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
  title: "Jurídico IA — O trabalho jurídico, finalmente organizado",
  description:
    "Documentos analisados, prazos encontrados no diário oficial, tarefas criadas sozinhas e o cliente informado. Um lugar para o caso inteiro. Comece gratuitamente.",
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
  // Paleta unificada papel-e-tinta (ADR 0016): o tema do navegador casa
  // com o fundo de TODAS as telas agora — landing e app interno claros.
  themeColor: "#faf9f5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-navy text-ice font-sans">
        <PwaRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
