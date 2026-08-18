import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/app/current-user";
import { listarConversasAction, contarUsoIaMesAction } from "./actions";
import { ChatApp } from "@/components/app/chat-app";

export const metadata = { title: "Chat IA — Jurídico IA" };

export default async function ChatPage() {
  const usuario = await getUsuarioAtual();
  if (!usuario) redirect("/login");

  const [conversas, uso] = await Promise.all([listarConversasAction(), contarUsoIaMesAction()]);

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col sm:h-[calc(100dvh-10rem)] md:h-[calc(100vh-4rem)]">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ice">Chat IA</h1>
          <p className="mt-1 text-sm text-muted">
            Converse com o copiloto jurídico. Peça análises, minutas de peças e pareceres.
          </p>
        </div>
        <Link href="/app/base-conhecimento" className="text-sm text-gold-2 underline underline-offset-2">
          Gerenciar base de conhecimento
        </Link>
      </div>
      <ChatApp conversasIniciais={conversas} usoInicial={uso} />
    </div>
  );
}
