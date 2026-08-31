import { headers } from "next/headers";

/**
 * URL absoluta de la aplicación.
 *
 * Hace falta para los enlaces de los correos, que no pueden ser relativos.
 * Prefiere `NEXT_PUBLIC_SITE_URL` cuando está definida (el dominio real en
 * producción) y cae al `host` del request, que es lo correcto en las URL de
 * preview de Vercel, donde el dominio cambia en cada despliegue.
 */
export async function absoluteUrl(path: string): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return new URL(path, configured).toString();

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}${path}` : path;
}
