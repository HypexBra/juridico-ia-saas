"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";

export function AdminShell({ nomeAdmin, children }: { nomeAdmin: string; children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar nomeAdmin={nomeAdmin} open={menuAberto} onOpen={() => setMenuAberto(true)} onClose={() => setMenuAberto(false)} />
      <main className="min-w-0 flex-1 px-4 py-6 pb-10 sm:px-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
