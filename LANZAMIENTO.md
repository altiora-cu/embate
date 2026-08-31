# Checklist de lanzamiento — Embate MVP

Estado del código: **listo**. 130 tests, build limpio, esquema verificado contra Postgres real.
Lo que sigue es todo lo que está **fuera** del código y hace falta para abrir al público.

Los bloqueantes están marcados con 🔴. Sin ellos la app no funciona para un usuario real.

---

## 🔴 1. Ejecutar el esquema

SQL Editor de Supabase → pegar `supabase/bundle.sql` entero → Run.

Son 6 migraciones en un solo archivo. Si ya ejecutaste una versión anterior del bundle, **no lo vuelvas a correr entero**: pedí solo las migraciones que falten.

Verificación rápida, en el mismo editor:

```sql
select count(*) from pg_tables where schemaname = 'public';        -- 9
select count(*) from pg_policies where schemaname = 'public';      -- 29
select id from storage.buckets;                                    -- match-screenshots
```

---

## 🔴 2. Correo de confirmación

Supabase trae un servidor de correo propio **limitado a unos pocos envíos por hora** y explícitamente no apto para producción. Si abres el registro sin resolver esto, la mayoría de tus usuarios no recibe el correo de confirmación y no puede entrar.

Dos caminos:

**A. Conectar SMTP propio (recomendado).** Authentication → Emails → SMTP Settings. Con Resend, que ya usa el proyecto para los avisos, alcanza. Requiere un dominio verificado.

**B. Desactivar la confirmación de correo.** Authentication → Providers → Email → apagar *Confirm email*. El usuario entra al instante. El costo: cualquiera puede registrarse con un correo que no le pertenece, y eso debilita el límite del plan gratuito.

Para arrancar hoy con 5–10 organizadores conocidos, **B es aceptable**. Antes de abrir al público, pasar a A.

---

## 🔴 3. URLs de redirección

Authentication → URL Configuration:

- **Site URL**: el dominio de producción (`https://embate.vercel.app` o el propio).
- **Redirect URLs**: agregar `https://TU-DOMINIO/auth/callback` y, si vas a probar en preview, `https://*.vercel.app/auth/callback`.

Sin esto, el enlace del correo de confirmación devuelve error y el registro queda cortado por la mitad.

---

## 🔴 4. Variables de entorno en Vercel

| Variable | Valor | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ggjjyfocbipfmenbknfa.supabase.co` | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon public` | Sí |
| `NEXT_PUBLIC_SITE_URL` | El dominio de producción | Recomendada |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` | Solo para correos |
| `RESEND_API_KEY` | Cuenta de Resend | Solo para correos |
| `EMBATE_EMAIL_FROM` | `Embate <no-reply@tu-dominio.com>` | Solo para correos |

La `service_role` va **sin** el prefijo `NEXT_PUBLIC_` a propósito: salta RLS por completo y nunca debe llegar al navegador.

---

## 🔴 5. Probar RLS con usuarios reales

**Este es el riesgo técnico más importante que queda.**

Los 130 tests corren contra un Postgres embebido, y ahí el proceso es superusuario — un superusuario **ignora RLS**. O sea: la lógica de negocio está probada a fondo, pero *que las políticas dejen entrar exactamente a quien deben* no lo está.

Prueba manual mínima, con dos cuentas en dos navegadores distintos:

1. Cuenta A crea comunidad. Cuenta B crea otra comunidad.
2. B intenta abrir `/c/<slug-de-A>` → debe dar 404, no la comunidad de A.
3. B se une a la comunidad de A con el código → ahora sí la ve.
4. A crea torneo, ambos se anotan, A cierra inscripciones.
5. B carga un marcador. A lo confirma. La tabla se mueve.
6. Repetir con marcadores distintos → el partido queda en disputa.
7. A resuelve la disputa. B **no** debe poder resolverla.
8. B intenta entrar a `/c/<slug>/admin` → 404.

Si algo de esto falla, es una política de RLS, no la aplicación.

---

## 6. Cobro manual (mientras no haya pasarela)

Activar Pro a una comunidad, desde el SQL Editor:

```sql
select public.set_community_plan('slug-de-la-comunidad', 'pro');
```

Desactivar cuando deja de pagar:

```sql
select public.set_community_plan('slug-de-la-comunidad', 'free');
```

Ver quién está en cada plan:

```sql
select slug, name, plan, created_at from public.communities order by created_at desc;
```

Bajar de plan **no corta ningún torneo en juego** — eso es a propósito: dejar a los jugadores con un torneo muerto por una cuestión de facturación sería inaceptable. El límite se aplica al crear el siguiente.

Límites del plan gratuito, aplicados en la base:

- 1 comunidad por cuenta
- 1 torneo activo por comunidad

---

## 7. Pendientes que no bloquean el lanzamiento

| Qué | Por qué importa | Cuándo |
|---|---|---|
| Revisión legal de Términos y Privacidad | Son borradores míos, no asesoramiento legal | Antes de cobrar |
| Búsqueda formal de marca (clases 41 y 42) | Riesgo de tener que renombrar | Antes de registrar |
| Dominio propio | `embate.app` no está comprado ni verificado | Cuando quieras salir de la URL de Vercel |
| Analítica (Plausible o PostHog) | Sin esto decides el roadmap a ciegas | Primera semana |
| Monitoreo de errores | Hoy los errores solo quedan en los logs de Vercel | Primera semana |
| Fotos de perfil | Ver nota abajo | Después de validar |

---

## 8. Lo que NO está construido

Para que no haya sorpresas:

- Pasarela de pago y webhooks (el cobro es manual por decisión propia)
- Bot de Discord
- Bracket embebible en otro sitio
- Verificación de resultados con IA
- Gráfica de campeón para redes
- Buscador de rivales
- Fotos de perfil (el campo `avatar_url` existe en la base; falta la subida)

**La recuperación de contraseña sí está.** `/forgot` pide el enlace y `/reset-password` guarda la nueva. Depende del correo, así que si desactivas la confirmación de email (punto 2, opción B) igual necesitas SMTP para que esto funcione — o el usuario que olvide su contraseña queda afuera.
