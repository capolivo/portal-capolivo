"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/clientes", label: "Clientes" },
  { href: "/produtos", label: "Produtos" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/ecommerce", label: "E-commerce" },
  { href: "/estoque", label: "Estoque" },
];

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-full flex-col justify-between border-b border-preto/10 bg-white px-4 py-3 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-4 md:py-6">
      <div>
        <div className="mb-6 hidden md:block">
          <span className="text-xl text-dourado">CapOlivo</span>
          <p className="text-xs text-preto/50">Portal interno</p>
        </div>
        <nav className="flex gap-2 md:flex-col">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-2 text-sm transition ${
                  active
                    ? "bg-dourado text-white"
                    : "text-preto/70 hover:bg-bege"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 hidden md:block">
        {userEmail && <p className="mb-2 truncate text-xs text-preto/50">{userEmail}</p>}
        <button
          onClick={handleSignOut}
          className="text-sm text-preto/60 underline-offset-2 hover:underline"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
