/**
 * Lectura y validación de las variables de entorno de Supabase.
 *
 * Falla en el arranque y con un mensaje concreto en vez de dejar que la app
 * explote más adelante con un "fetch failed" imposible de diagnosticar.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export function readSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copia .env.example a .env.local y completa las credenciales de tu proyecto Supabase.",
    );
  }

  return { url, anonKey };
}

/** `true` si la app tiene credenciales para hablar con Supabase. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
