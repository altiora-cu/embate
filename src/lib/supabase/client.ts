"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";
import { readSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para componentes de cliente.
 * Solo usa la clave anónima: toda la autorización real la aplica RLS en Postgres.
 */
export function createClient() {
  const { url, anonKey } = readSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
