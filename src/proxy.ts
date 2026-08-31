import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const handleI18n = createIntlMiddleware(routing);

/**
 * Proxy combinado: idioma + refresco de sesión.
 * (En Next.js 16 el antiguo `middleware.ts` pasó a llamarse `proxy.ts`.)
 *
 * El orden importa. Primero resuelve next-intl (que puede redirigir o reescribir
 * la URL con el prefijo de idioma) y luego se refresca la sesión de Supabase
 * escribiendo las cookies actualizadas sobre ESA respuesta. Al revés, la
 * redirección de idioma descartaría las cookies renovadas y el usuario se
 * desconectaría solo cada vez que expira el token.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresca el token si está por vencer. Sin esta llamada, la sesión se cae
  // en los Server Components apenas expira el access token.
  await supabase.auth.getUser();

  return response as NextResponse;
}

export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes optimizadas, y archivos con extensión.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\..*).*)",
  ],
};
