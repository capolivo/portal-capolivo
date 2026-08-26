import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// TODO: confirmar esta URL contra a documentação atual em developer.bling.com.br.
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

function htmlResponse(title: string, message: string, ok: boolean) {
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title></head>
     <body style="font-family: system-ui; padding: 2rem; max-width: 32rem; margin: 0 auto;">
       <h1 style="color: ${ok ? "#5F6301" : "#B91C1C"}">${title}</h1>
       <p>${message}</p>
       <p><a href="/produtos">Voltar ao portal</a></p>
     </body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("bling_oauth_state")?.value;

  if (!code) {
    return htmlResponse("Falha na conexão com o Bling", "O Bling não retornou um código de autorização.", false);
  }

  if (!state || !savedState || state !== savedState) {
    return htmlResponse(
      "Falha na conexão com o Bling",
      "O parâmetro state não confere (possível tentativa expirada ou inválida). Tente novamente a partir de /api/bling/authorize.",
      false,
    );
  }

  const clientId = process.env.BLING_CLIENT_ID;
  const clientSecret = process.env.BLING_CLIENT_SECRET;
  const redirectUri = process.env.BLING_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return htmlResponse(
      "Configuração incompleta",
      "BLING_CLIENT_ID, BLING_CLIENT_SECRET, BLING_REDIRECT_URI ou SUPABASE_SERVICE_ROLE_KEY ausente no .env.local.",
      false,
    );
  }

  const tokenResponse = await fetch(BLING_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const detalhe = await tokenResponse.text();
    return htmlResponse(
      "Falha ao trocar o código por tokens",
      `Bling respondeu ${tokenResponse.status}: ${detalhe}`,
      false,
    );
  }

  const tokenData = await tokenResponse.json();
  const expiraEm = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("bling_auth").upsert({
    id: 1,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expira_em: expiraEm,
  });

  if (error) {
    return htmlResponse("Falha ao salvar os tokens", error.message, false);
  }

  const response = htmlResponse(
    "Bling conectado com sucesso",
    "O Portal Capolivo agora tem acesso à API do Bling. A próxima sincronização (manual ou agendada) já pode usar esses tokens.",
    true,
  );
  response.cookies.delete("bling_oauth_state");
  return response;
}
