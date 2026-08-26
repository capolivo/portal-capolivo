import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { SetupNotice } from "@/components/setup-notice";
import { Sidebar } from "@/components/sidebar";

// Páginas do dashboard sempre dependem de sessão/dados ao vivo — nunca pré-renderizar em build.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar userEmail={user?.email ?? null} />
      <div className="flex-1 overflow-x-auto px-4 py-6 md:px-8 md:py-8">{children}</div>
    </div>
  );
}
