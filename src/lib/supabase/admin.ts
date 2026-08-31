import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Cliente con rol de servicio. **Salta RLS por completo.**
 *
 * Uso permitido: exclusivamente tareas de servidor que necesitan datos que
 * ningún usuario debería poder leer — hoy, resolver la dirección de correo de un
 * jugador para mandarle un aviso. Los correos NO viven en `profiles` justamente
 * para que un miembro de la comunidad no pueda cosechar las direcciones de los
 * demás con una consulta normal.
 *
 * El `import "server-only"` hace que el build falle si algún día este módulo
 * termina importado desde un componente de cliente, que filtraría la clave.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Solo hace falta para enviar notificaciones por correo.",
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** `true` si el servidor puede usar el rol de servicio. */
export function isAdminClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

/**
 * Direcciones de correo de una lista de usuarios.
 * Devuelve solo las que existan: un usuario borrado no debe romper el envío.
 */
export async function getUserEmails(
  userIds: readonly string[],
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  if (userIds.length === 0 || !isAdminClientConfigured()) return emails;

  const admin = createAdminClient();

  await Promise.all(
    [...new Set(userIds)].map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data?.user?.email) emails.set(userId, data.user.email);
    }),
  );

  return emails;
}
