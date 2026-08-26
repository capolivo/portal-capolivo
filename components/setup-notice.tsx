export function SetupNotice() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl text-dourado">Portal Capolivo</h1>
      <p className="max-w-md text-sm text-preto/80">
        O Supabase ainda não está configurado. Crie um projeto em{" "}
        <span className="font-medium">supabase.com</span>, copie{" "}
        <code className="rounded bg-bege px-1">.env.example</code> para{" "}
        <code className="rounded bg-bege px-1">.env.local</code> e preencha as chaves. Veja o
        passo a passo em <code className="rounded bg-bege px-1">docs/ARQUITETURA.md</code>.
      </p>
    </main>
  );
}
