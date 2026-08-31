import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { readSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Debe crearse por request: guarda las cookies de sesión del usuario actual.
 * Nunca reutilizar una instancia entre requests, o un usuario vería la sesión de otro.
 */
export async function createClient() {
  const { url, anonKey } = readSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies. El middleware ya
          // refresca la sesión en cada request, así que ignorarlo es seguro.
        }
      },
    },
  });
}

/**
 * Usuario autenticado del request actual, o `null`.
 *
 * Usa `getUser()` y no `getSession()`: `getUser` valida el token contra el
 * servidor de Auth. `getSession` solo lee la cookie, que el cliente podría falsear.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
