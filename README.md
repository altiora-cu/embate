# Embate

Plataforma SaaS multi-tenant para que organizadores administren torneos competitivos de videojuegos sin depender de hojas de cálculo ni WhatsApp. Foco inicial en EA Sports FC, con el modelo de datos preparado para otros títulos.

Construido a partir de [`docs/paquete-direccion-creativa-v2.md`](docs/paquete-direccion-creativa-v2.md). Las referencias tipo §4.1 que aparecen en el código apuntan a las secciones de ese documento.

---

## Puesta en marcha

### 1. Dependencias

```bash
npm install
```

### 2. Esquema de la base

Crear un proyecto en [supabase.com](https://supabase.com), abrir **SQL Editor → New query**, pegar el contenido de **[`supabase/bundle.sql`](supabase/bundle.sql)** y ejecutar. Es un solo paso.

Ese archivo se genera desde `supabase/migrations/` — que sigue siendo la fuente de verdad — con `npm run db:bundle`. Las migraciones sueltas, en orden:

| Archivo | Qué hace |
|---|---|
| `0001_init.sql` | Tablas, enums, triggers y recálculo de estadísticas |
| `0002_rls.sql` | Row Level Security: el aislamiento entre comunidades |
| `0003_match_flow.sql` | Doble confirmación, disputas y funciones RPC |
| `0004_storage.sql` | Bucket privado de capturas, separado por comunidad |

Con la CLI de Supabase también sirve: `npx supabase link --project-ref TU_REF && npx supabase db push`.

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Completar con lo que aparece en **Supabase → Project Settings → API**:

| Variable | Dónde sale | ¿Obligatoria? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` `secret` | Solo para el seed y los correos |
| `RESEND_API_KEY` | Cuenta de Resend | Solo para los correos |

La `service_role` **salta RLS por completo**: va sin el prefijo `NEXT_PUBLIC_` para que nunca llegue al navegador, y no debe compartirse ni subirse al repo. Sin ella la app funciona igual; simplemente no manda avisos por correo.

### 4. Datos de prueba (opcional)

Requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.

```bash
npm run seed
```

Crea una comunidad con 6 jugadores, una liga con resultados confirmados y una copa con byes y un partido en disputa. Imprime en pantalla las credenciales para entrar como organizador y como jugador.

### 5. Levantar

```bash
npm run dev
```

---

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm run build      # build de producción
npm run test       # tests (unitarios + integración de base)
npm run typecheck  # TypeScript sin emitir
npm run lint       # ESLint
npm run db:verify  # corre las migraciones contra un Postgres embebido
npm run db:bundle  # regenera supabase/bundle.sql desde las migraciones
npm run seed       # datos de prueba (necesita SUPABASE_SERVICE_ROLE_KEY)
```

---

## Cómo está armado

```
src/
├── app/[locale]/          rutas (App Router), todas bajo prefijo de idioma
│   ├── (auth)/            login y registro
│   ├── app/               zona privada: mis comunidades, crear, unirme
│   ├── c/[slug]/          una comunidad: torneos, ranking, perfil, admin
│   └── legal/             términos y privacidad
├── components/            sistema de diseño y componentes por dominio
├── content/legal.ts       textos legales, versionados junto al producto
├── i18n/                  configuración de next-intl
├── lib/
│   ├── domain/            LÓGICA PURA: cruces, tabla, calificación (+ tests)
│   ├── data/              lectura desde Supabase
│   ├── actions/           Server Actions (escritura)
│   ├── email/             avisos transaccionales (Resend)
│   ├── supabase/          clientes y tipos de la base
│   └── validation/        esquemas Zod
├── messages/              es.json / en.json — ninguna cadena vive en un componente
└── proxy.ts               idioma + refresco de sesión (Next 16)
supabase/migrations/       esquema, RLS, flujo de partido, storage
```

### Decisiones que conviene conocer

**El aislamiento entre comunidades vive en la base, no en el código.** Toda tabla lleva `community_id` y toda lectura pasa por RLS. Si mañana un query olvida el `where community_id = ...`, Postgres igualmente no devuelve datos ajenos. El ranking "más ganador" es por comunidad por construcción: no hay forma de leer las estadísticas de una comunidad de la que no sos miembro.

**Un jugador nunca escribe un marcador.** No existe política de `UPDATE` sobre `matches` para jugadores. Cargar un resultado pasa por `submit_match_report()` y aceptarlo por `confirm_match()`, ambas `SECURITY DEFINER` en Postgres. Sin eso, cualquiera con la consola del navegador abierta se pondría "gané 5-0".

**La fórmula de las 5 estrellas vive en TypeScript, no en SQL.** `player_stats` guarda contadores crudos (victorias, puntualidad, disputas perdidas) y la nota se calcula en [`src/lib/domain/rating.ts`](src/lib/domain/rating.ts), que tiene tests. Duplicar la fórmula en SQL garantizaría que un día las dos versiones se separen.

**Las estadísticas se recalculan desde cero, no con deltas.** `recalc_player_stats()` reconstruye los contadores a partir de los partidos. Un torneo tiene decenas de partidos, así que el costo es irrelevante, y a cambio corregir el marcador de un partido ya confirmado no deja rastros de la versión anterior. Además sirve como herramienta de reparación: se puede reejecutar cuando sea.

**La tabla de posiciones se calcula en memoria.** No hay tabla agregada que pueda quedar desincronizada: [`buildStandings`](src/lib/domain/standings.ts) la arma desde los partidos confirmados en cada render.

**Los cruces se generan con claves locales, no con UUID.** El generador ([`bracket.ts`](src/lib/domain/bracket.ts)) es puro y devuelve partidos identificados como `R2-M1`. La capa de persistencia inserta, mapea `key → uuid` y recién entonces escribe los enlaces `next_match_id`. Un bracket se referencia a sí mismo, y los UUID no existen antes del INSERT.

**El acento del organizador se inyecta como variable CSS.** El layout de comunidad define `--brand-accent` y el color de texto sobre ese acento se **calcula** con contraste WCAG ([`color.ts`](src/lib/utils/color.ts)), no se asume: un acento lima necesita tinta oscura y uno azul marino tinta clara.

**Las capturas viven en un bucket privado separado por comunidad.** La ruta es `{community_id}/{tournament_id}/{match_id}/{user_id}-{ts}.jpg` y las políticas de Storage verifican tanto la pertenencia a la comunidad como que el archivo empiece por el `user_id` de quien lo sube. Se sirven con URL firmada de 10 minutos.

**La invitación se manda dentro del juego, no desde Embate.** En EA Sports FC un partido arranca cuando alguien invita al otro desde su consola, y para eso necesita su ID exacto. Ese dato se pide una sola vez al inscribirse y queda guardado en la membresía de la comunidad, así que las siguientes inscripciones vienen precargadas. En la pantalla del partido, mientras esté por jugarse, aparece el ID del rival en grande con botón de copiar — y un aviso de crossplay si los dos están en plataformas distintas, que es el motivo más común de un partido que "no se pudo jugar".

**El movimiento sigue la tabla de §8, y se apaga solo.** El cuadro dibuja sus conexiones al cargar (400ms escalonados), las filas de la tabla de liga viajan hasta su nueva posición cuando entra un resultado (500ms, sin salto), el resultado confirmado se avisa con un toast (250ms de entrada, 200ms de salida, descarte a los 4s) y el cierre del torneo lanza confeti en lima y azul señal — nunca multicolor genérico. Las listas entran escalonadas con CSS puro y no con JavaScript, para que las páginas de torneos, comunidades y ranking sigan siendo Server Components: aparecer con la página no justifica mandar una librería de animación al navegador. Todo respeta `prefers-reduced-motion`, tanto por la regla global de `globals.css` como por `useReducedMotion()` en los componentes que animan con JS.

**El correo nunca rompe una acción.** Los avisos de Resend van en `try/catch` y no devuelven error: si el correo falla, el resultado igual quedó guardado.

---

## Tests

117 tests sobre la lógica que decide cosas.

### Integración contra Postgres real

`match-flow.test.ts` levanta un Postgres embebido ([PGlite](https://pglite.dev), WebAssembly — sin Docker ni servidor), le aplica las 4 migraciones y ejerce el mecanismo de confianza del producto de verdad: doble confirmación, marcadores en conflicto, resolución de disputas, recálculo de estadísticas y avance del ganador en el cuadro. Mockear `submit_match_report` solo probaría que el mock funciona; acá corre el SQL real.

Esa decisión ya se pagó sola: encontró tres bugs que ningún test unitario habría visto —dos funciones declaradas antes que las tablas que consultan, un `CASE` sin cast al enum en `resolve_dispute`, y una referencia ambigua a `community_id` en `join_community_by_code`—. Los dos últimos solo aparecen al **ejecutar** la función, no al crearla, así que habrían llegado a producción.

Limitación conocida: PGlite corre como superusuario y un superusuario ignora RLS. Estos tests validan la lógica de funciones y triggers, no que las políticas autoricen a quien deben — eso hay que probarlo contra Supabase con usuarios reales.

### Unitarios

- **`bracket.test.ts`** — reparto de byes (nunca dos byes emparejados, siempre `n-1` partidos jugables), siembra aleatoria, liga de todos contra todos, alternancia local/visitante.
- **`standings.test.ts`** — puntos, desempates, y que los partidos pendientes o en disputa **no** cuenten para la tabla.
- **`rating.test.ts`** — que la calificación no sea solo el % de victorias: un jugador que gana pero deja plantados a sus rivales queda por debajo de uno que pierde y siempre se presenta.
- **`color.test.ts`** — contraste del acento del organizador.
- **`schemas.test.ts`** — validación de entrada.
- **`messages.test.ts`** — paridad ES/EN de todas las claves, presencia del disclaimer de EA y ausencia de lenguaje de apuestas en cualquier copy (§9).

```bash
npm run test
```

---

## Cumplimiento legal

- El disclaimer de no afiliación con Electronic Arts aparece en el footer público, en el marco de las comunidades (páginas de torneo compartibles) y en las pantallas de acceso.
- No se usa ningún asset, logo ni tipografía de EA.
- Embate no recibe ni distribuye dinero de premios; no hay ningún flujo de pagos en el MVP.
- Un test automatizado falla si aparece lenguaje de apuestas en cualquier traducción.
- Términos y privacidad están redactados en [`src/content/legal.ts`](src/content/legal.ts) a partir de lo que la app realmente hace. **Son borradores de trabajo: necesitan revisión de un abogado antes de abrir el registro público.**

---

## Qué queda fuera de este MVP

Alcance de las fases V1.5 y V2 del paquete de dirección, no construido acá:

- Bot de Discord
- Link público embebible con marca blanca completa
- Cobro de inscripción vía Stripe Connect
- Verificación de resultado con IA de visión
- Gráfica automática de campeón para redes
- Buscador de rivales

El modelo de datos ya contempla lo que estas fases van a necesitar: `player_stats` guarda los componentes de confiabilidad que alimentan al futuro buscador de rivales, y `tournaments.game` existe para el multi-juego aunque hoy solo se active EA Sports FC.

---

## Marca

Los SVG están en [`brand/`](brand/) y el isotipo se implementa como componente React en [`src/components/ui/logo.tsx`](src/components/ui/logo.tsx).

**El isotipo se rehízo (v2).** La v1 del paquete tenía los dos trazos casi colineales, así que por debajo de 40px dejaba de leerse como convergencia y parecía una raya diagonal con un punto suelto; además el dibujo estaba descentrado dentro del viewBox y flotaba en los headers. La v2 cierra el ángulo hasta formar un chevron ascendente, centra el trazo ópticamente y acentúa la asimetría entre las dos patas — que es lo que sostiene el concepto: no es una flecha simétrica, son dos recorridos distintos que terminan en el mismo punto. Se descartó el agujero de espacio negativo del vértice: a tamaño de favicon desaparecía y dejaba el punto de unión frágil.

La v1 queda archivada en [`brand/v1-descartado/`](brand/v1-descartado/) por si hace falta volver sobre la decisión. La comparación está en `brand/comparacion-isotipo.png`.

También se agregó la variante de logo horizontal para fondo claro que faltaba en el paquete (§10) y se exportaron los PNG del manifest de la PWA en 32, 192 y 512 px, más el `favicon.ico`.

### Tono de la copy

Los textos hablan desde la competencia, no desde el problema que resuelve el producto: la venta consultiva la hace el equipo comercial, la app tiene que sonar a torneo. También están en **tuteo neutro** y no en voseo, por el mercado peruano.

**Pendiente antes de registrar la marca:** la búsqueda formal en tmsearch.uspto.gov o vía abogado de IP, clases 41 y 42 (§2.2 del paquete). Es un trámite legal, no bloquea el desarrollo.
