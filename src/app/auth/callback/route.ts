import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Destino del enlace de confirmación de correo y del login social.
 *
 * Canjea el código por una sesión y manda al usuario a sus comunidades.
 * Vive fuera de `[locale]` a propósito: la URL la construye Supabase y no debe
 * depender del prefijo de idioma.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/app";

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
