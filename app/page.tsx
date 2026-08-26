import { redirect } from "next/navigation";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { SetupNotice } from "@/components/setup-notice";

export default function Home() {
  const { isConfigured } = getSupabaseEnv();

  if (!isConfigured) {
    return <SetupNotice />;
  }

  redirect("/clientes");
}
