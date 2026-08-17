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
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-ice">Chat IA</h1>
        <p className="mt-1 text-sm text-muted">
          Converse com o copiloto jurídico. Peça análises, minutas de peças e pareceres.
        </p>
      </div>
      <ChatApp conversasIniciais={conversas} usoInicial={uso} />
    </div>
  );
}
