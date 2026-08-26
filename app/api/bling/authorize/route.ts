import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

// TODO: confirmar esta URL contra a documentação atual em developer.bling.com.br
// antes do primeiro uso — endpoints de API podem mudar.
const BLING_AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";

// Inicia o fluxo OAuth2 do Bling (passo manual, único). O proxy (middleware) já
// exige sessão para qualquer rota fora de /login, então não repetimos o check aqui.
export async function GET() {
  const clientId = process.env.BLING_CLIENT_ID;
  const redirectUri = process.env.BLING_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "BLING_CLIENT_ID ou BLING_REDIRECT_URI ausente no .env.local." },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");

  const url = new URL(BLING_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set("bling_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
