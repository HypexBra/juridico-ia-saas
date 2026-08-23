import type { Metadata, Viewport } from "next";
import {
  Playfair_Display,
  Inter,
  Fraunces,
  Instrument_Sans,
  IBM_Plex_Mono,
} from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/* ---- Fontes globais do APP INTERNO (não alterar) ---- */
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

/* ---- Fontes da LANDING PÚBLICA (editorial claro) ----
   Expostas apenas como VARIÁVEIS CSS e consumidas somente pelos
   componentes de marketing, via tokens novos em globals.css
   (--font-serif-ed / --font-sans-ed / --font-mono-ed). O app interno
   continua usando --font-display (Playfair) e --font-sans (Inter).
   · Fraunces: serif de display contemporânea (eixo óptico variável)
   · Instrument Sans: interface sans limpa, ≠ Inter
   · IBM Plex Mono: dados/números/microtipografia */
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
  // Mantém a cor do app interno (navy): o tema do navegador é global e as
  // rotas internas continuam escuras. A landing clara convive com isso.
  themeColor: "#13294b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${playfair.variable} ${inter.variable} ${fraunces.variable} ${instrument.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-navy text-ice font-sans">
        <PwaRegister />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
