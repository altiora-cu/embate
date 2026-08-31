import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Wrappers de navegación con idioma. Usar SIEMPRE estos en vez de los de
 * `next/link` y `next/navigation`: mantienen el prefijo de idioma sin que
 * cada componente tenga que acordarse de agregarlo.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
