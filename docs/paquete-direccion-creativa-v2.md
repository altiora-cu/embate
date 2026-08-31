# EMBATE — Paquete de Dirección Creativa v2
**Fecha:** 2026-07-29
**Cliente/Proyecto:** Embate — SaaS de gestión de torneos competitivos
**Estado:** ✅ Nombre final confirmado y verificado. Logo vectorizado con wordmark actualizado. Listo para desarrollo (handoff a Claude Code).

**Changelog de esta revisión (v1 → v2):**
- Cambio de nombre definitivo: **Cruzo → Embate**, tras encontrar colisiones de marca reales con Cruzo (plataforma SaaS de delivery con el mismo nombre) y con todas las alternativas en inglés exploradas (Rondo, Liggo, Clutch, Bracketly, Matchly, Scoreo, Koppa, Rivus — todas colisionan; ver historial de verificación en sección 2.2).
- Isotipo, logo horizontal y app-icon regenerados en SVG con el wordmark "EMBATE".
- El concepto de logo "Nodo de Convergencia" se mantiene sin cambios — encaja igual o mejor con el significado de Embate (choque/enfrentamiento decisivo).

---

## 1. Resumen ejecutivo

Embate es una plataforma SaaS multi-tenant para que organizadores (comunidades de Discord, gaming cafés, streamers, marcas) administren torneos competitivos de videojuegos sin depender de hojas de cálculo, WhatsApp o Excel. El foco inicial es **EA Sports FC (FC 26 y FC 27)**, con arquitectura preparada para soportar otros títulos en el futuro sin rediseño.

**Modelo de negocio:** SaaS vendido a organizadores (no operamos dinero de premios ni apuestas — ver sección 9, Cumplimiento Legal). El organizador cobra su propia inscripción por fuera o vía Stripe Connect dentro de la plataforma.

**Idioma:** Bilingüe ES/EN desde el día uno — toda cadena de texto vive en archivos de traducción (i18n), nunca hardcodeada en componentes.

**Plataforma:** Aplicación web responsiva (PWA) — un solo código para móvil y escritorio, instalable desde el navegador. No se planea app nativa en esta fase.

---

## 2. Identidad de marca

### Nombre
**EMBATE** — significa choque/embestida/enfrentamiento decisivo: el momento exacto del partido que define todo. Palabra real en español/portugués con peso dramático que, a oídos angloparlantes, suena a marca inventada y premium — no necesita significar nada en inglés para funcionar como nombre global.

### Concepto de logo — APROBADO Y VECTORIZADO: "Nodo de Convergencia"
Dos trazos angulares de distinto tamaño que convergen hacia arriba en un solo punto — dos caminos compitiendo hasta que uno gana. Lee como movimiento hacia adelante, **no** como una cruz simétrica (se descartó la primera dirección por parecerse a una cinta de concientización de salud).

**Archivos SVG vectoriales (listos para implementar):**
| Archivo | Uso |
|---|---|
| `embate_isotipo_v1.svg` | Marca sola, fondo transparente. Uso en avatares, favicon base, marcas de agua |
| `embate_logo-horizontal_v1.svg` | Isotipo + wordmark "EMBATE", para headers y navegación |
| `embate_app-icon_v1.svg` | Isotipo sobre fondo redondeado oscuro, para manifest de PWA / ícono de app |

**Isotipo (código fuente de referencia):**
```svg
<svg width="200" height="200" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <line x1="172" y1="18" x2="140" y2="60" stroke="#C6FF3D" stroke-width="24" stroke-linecap="round"/>
  <line x1="28" y1="162" x2="140" y2="60" stroke="#C6FF3D" stroke-width="24" stroke-linecap="round"/>
  <circle cx="140" cy="60" r="17" fill="#0B0D12"/>
</svg>
```

**Guía rápida de uso:**
- Espacio de protección mínimo: dejar un margen alrededor del isotipo equivalente al radio del nodo de convergencia (no pegar texto/elementos más cerca de eso).
- Tamaño mínimo legible: 24px de alto para el isotipo solo; por debajo de eso, usar solo el ícono de app simplificado.
- El wordmark en `embate_logo-horizontal_v1.svg` usa `fill="#F5F3EE"` (blanco hueso) para fondo oscuro. Sobre fondo claro, cambiar ese fill a `#0B0D12` — dejar ambas variantes listas en el repo de assets, no solo la oscura.
- No estirar el isotipo de forma no proporcional; no rotar; no rellenar los trazos con degradados.

### 2.2 — Verificación de marca y dominio (hallazgos — leer antes de decidir en firme)

**Importante:** esta fue una búsqueda de colisión por web abierta, **no** una búsqueda formal en la base de datos del USPTO (tmsearch.uspto.gov es un sistema interactivo que no se puede consultar por búsqueda web general). Es suficiente para tomar una decisión informada, pero antes de registrar la marca en firme se necesita una búsqueda formal (abogado de IP o el sistema oficial del USPTO) — esto aplica a cualquier nombre, no es exclusivo de Embate.

**Nombres descartados en el proceso (por colisión real encontrada):**
| Nombre | Por qué se descartó |
|---|---|
| Cruzo | Plataforma SaaS de delivery/e-commerce con el mismo nombre (Cruzo Software Pvt. Ltd., `cruzotec.com`), más una empresa NFT/Web3 y varios dominios `.com`/`.io`/`.us` ya en uso |
| Rondo | "Play Rondo" — plataforma de ligas/torneos/reservas deportivas casi idéntica en concepto |
| Liggo | Plataforma de manufactura IIoT (Canadá) + app de citas con 500K+ descargas |
| Clutch | Colisión masiva: app de torneos gaming, app de matchmaking social, y equipo de esports de los Houston Rockets |
| Bracketly / Matchly / Scoreo / Goald | Todas ya existen como apps o marcas registradas de gestión de torneos/marcador |
| Koppa | Colisión masiva: SaaS de protección de marca, app de contabilidad, app de coreano, suite de oficina |
| Rivus | Colisión + **solicitud de marca ante el USPTO ya presentada** (agosto 2024) para software de aplicaciones descargables — obstáculo legal real, no solo de imagen |

**Verificación de EMBATE — resultado limpio:**
- No encontré ninguna empresa de software, gaming ni SaaS usando "Embate" como marca. Las únicas apariciones son uso genérico de la palabra en noticias deportivas/tecnológicas en portugués y español (ej. "el embate judicial", "el embate de la final") — eso no es una marca compitiendo, es el uso normal del idioma.
- No hallé evidencia de uso de `embate.com`, `embate.gg` ni `embate.app` en la búsqueda — señal limpia, aunque **falta confirmarlo directo en un registrador** (Namecheap/GoDaddy) antes de comprar.
- **Sigue pendiente** (no ejecutable por búsqueda web general): la búsqueda formal en tmsearch.uspto.gov, o vía abogado de IP, enfocada en clases 41 (entretenimiento/torneos) y 42 (software/SaaS) — hacerlo antes de cualquier registro de marca en firme.

**Conclusión:** Embate es, de todos los nombres evaluados en este proceso, el que salió limpio. Aprobado para avanzar a desarrollo con la reserva de que la verificación formal de marca sigue pendiente antes del registro legal (no antes de programar).

### Tono de marca
Rápido, preciso, confiable con el dato (maneja estadísticas y reputación real de jugadores), "sala de comando de torneo" — no infantil, no genérico de gaming con exceso de neón.

### Disclaimer legal obligatorio
En cualquier superficie pública de la app debe aparecer, visible:

> "Embate no está afiliado, patrocinado ni respaldado por Electronic Arts Inc. ni sus licenciantes." / "Embate is not affiliated with, sponsored by, or endorsed by Electronic Arts Inc. or its licensors."

No usar logos, tipografía de marca ni assets de EA/EA Sports FC en ningún lugar del producto.

---

## 3. Arquitectura de producto (crítico — leer antes de modelar la base de datos)

### Multi-tenancy — una sola base de código para todos los organizadores
Embate **no** se despliega como una app nueva por cliente. Es una sola plataforma donde cada organizador es una **comunidad (tenant)** aislada lógicamente:

- Cada comunidad tiene su propio identificador único (slug — ej. `embate.app/nombre-comunidad` o subdominio).
- Todo registro de datos (torneos, partidos, estadísticas) lleva una referencia a `community_id`. Una comunidad nunca puede leer ni escribir datos de otra.
- Cada comunidad aplica su propia marca (logo/colores del organizador) sobre la interfaz base de Embate — marca blanca, no un fork del producto.
- Beneficio: una sola actualización de producto llega a todos los organizadores a la vez.

### Cuenta de usuario — única en toda la plataforma
**Un jugador tiene una sola cuenta (email/password o login social) para toda la plataforma**, no una contraseña distinta por comunidad. Se une a la(s) comunidad(es) de sus organizadores vía código de invitación o link — como unirse a servidores de Discord con un solo login. Sus estadísticas y perfil son globales a su cuenta; el ranking de "más ganador" y las estadísticas de liga quedan **acotadas por comunidad** (ver sección 4).

### Multi-juego (preparado, no activo)
El modelo de datos debe permitir que un torneo tenga un campo `juego` (ej. `ea_sports_fc_26`) sin acoplar la lógica de negocio a un solo título. Por ahora solo se activa EA Sports FC; no construir nada que asuma que el único juego posible es FC.

---

## 4. Funcionalidades — por fase

### MVP (fase 1 de desarrollo)
| # | Funcionalidad | Detalle |
|---|---|---|
| 1 | Formatos de torneo | Liga (todos contra todos, estadísticas), Copa (eliminación directa), Torneo Relámpago (formato rápido, tamaños 4/6/8 con manejo de "byes" si el número no es potencia de 2) |
| 2 | Modo de juego por torneo | Ultimate Team o Partidos Rápidos (Kick Off), elegido por el organizador al crear el torneo |
| 3 | Registro de jugador | Usuario/gamertag + plataforma (PS5/Xbox/PC) |
| 4 | Cruces aleatorios | Generados automáticamente al cerrar inscripciones; en Copa, el sistema arma el cruce con el siguiente rival tras cada ronda |
| 5 | Carga de resultado | Ambos jugadores suben captura de pantalla; **confirmación doble** (o el perdedor confirma el resultado del ganador) antes de actualizar la tabla |
| 6 | Sistema de disputa | Si las capturas no coinciden o hay reclamo, el partido queda "en disputa" hasta que el admin de la comunidad lo resuelva manualmente |
| 7 | Calendario de partidos | Visible para jugadores y admin, por torneo |
| 8 | Registro histórico | Historial de todos los torneos jugados, por comunidad y por jugador |
| 9 | Estadísticas de jugador | V-D-E (victorias-derrotas-empates), % de victorias |
| 10 | Calificación de 5 estrellas | Ver detalle en sección 4.1 — no es solo win-rate |
| 11 | Ranking "más ganador" | **Acotado por comunidad**, no global de toda la plataforma |
| 12 | Panel de administrador | Crear/gestionar torneos, ver inscritos, resolver disputas, marca blanca básica (logo/colores) |

### V1.5 (post-validación de MVP)
| # | Funcionalidad | Detalle |
|---|---|---|
| 13 | Bot de Discord | Publica automáticamente nuevos cruces, resultados subidos, y recordatorios de partido pendiente en el servidor del organizador |
| 14 | Marca blanca completa + link público embebible | El bracket/tabla se puede compartir o incrustar fuera de la app, con la marca del organizador |
| 15 | Cobro de inscripción vía Stripe Connect | El organizador conecta su propia cuenta; Embate nunca custodia el dinero (ver sección 9) |

### V2 (diferenciadores premium)
| # | Funcionalidad | Detalle |
|---|---|---|
| 16 | Verificación de resultado con IA de visión | Lee el marcador de la captura y propone el resultado; el admin solo confirma |
| 17 | Generación automática de gráfica de campeón para redes | Al cerrar el torneo, genera una imagen tipo "podio" lista para Instagram/WhatsApp |
| 18 | Buscador de rivales ("¿quién te reta?") | Filtros por plataforma, nivel/racha, modo de juego y disponibilidad horaria — comparte base de datos con el calendario |

### 4.1 — Cómo calcular la calificación de 5 estrellas
**No debe ser solo el % de victorias** (eso incentiva a evitar rivales fuertes). Debe combinar:
- % de victorias (V-D-E)
- Puntualidad/asistencia (no dejar plantado a un rival)
- Comportamiento en disputas (perder disputas por mala fe baja la calificación)

Es una métrica de **confiabilidad**, no solo de habilidad — necesaria para que el futuro buscador de rivales (ítem 18) funcione sin que la gente le tenga miedo a retar desconocidos.

---

## 5. Flujos de usuario

### Jugador
1. Crea su cuenta una sola vez (email/password o login social).
2. Se une a la comunidad de su organizador (código/link).
3. Ve los torneos activos → se inscribe, elige modo de juego, pone gamertag y plataforma.
4. Recibe su cruce y horario → juega, sube su captura.
5. El rival confirma o disputa → la tabla/bracket se actualiza automáticamente.
6. Ve su perfil: V-D-E, % de victorias, calificación de 5 estrellas, historial de torneos, posición en el ranking de esa comunidad.

### Organizador (admin)
1. Crea su comunidad — sube logo y colores.
2. Crea el torneo: formato, tamaño, modo de juego, fechas.
3. Comparte el link de inscripción (Discord/redes).
4. Panel: inscritos, cruces generados, resultados pendientes, disputas por resolver.
5. Al cerrar el torneo: ranking final visible; en V2, gráfica de campeón lista para compartir.

---

## 6. Consideraciones técnicas de datos (para el modelo de base de datos)

Entidades mínimas que el esquema debe contemplar desde el día uno (nombres orientativos):

- `users` (cuenta única de la plataforma, no por comunidad)
- `communities` (tenant del organizador: slug, branding, idioma por defecto)
- `community_memberships` (relación user ↔ community, many-to-many)
- `tournaments` (community_id, formato: liga/copa/relámpago, modo: UT/partidos rápidos, juego, tamaño, fechas)
- `matches` (tournament_id, jugadores, ronda, estado: pendiente/confirmado/en disputa)
- `match_results` (capturas subidas por cada jugador, resultado propuesto, confirmaciones)
- `disputes` (match_id, estado, resolución del admin)
- `player_stats` (scoped por community_id: V-D-E, % victorias)
- `player_ratings` (componentes: win-rate, asistencia, comportamiento en disputas → calificación compuesta de 5 estrellas)

**No construir** ninguna tabla que asuma una sola comunidad o un solo torneo activo — todo debe llevar `community_id` desde el primer commit.

---

## 7. Design tokens

### Paleta de color
| Token | Hex | Uso |
|---|---|---|
| `color-base` | `#0B0D12` | Fondo principal (modo oscuro por defecto) |
| `color-accent-primary` | `#C6FF3D` | Acento eléctrico — victorias, estados "en vivo", CTAs principales |
| `color-accent-secondary` | `#2E5CFF` | Azul señal — enlaces, elementos de confianza/tecnología |
| `color-neutral` | `#F5F3EE` | Blanco hueso — texto sobre fondo oscuro |
| `color-surface` | `#1A1D24` | Tarjetas/paneles sobre el fondo base |
| `color-surface-alt` | `#2A2E38` | Elementos secundarios de UI, bordes |
| `color-text-muted` | `#8A93A6` | Texto secundario, metadatos |
| `color-warning` | `#FFB020` | Estados "pendiente de confirmación" |
| `color-error` | `#FF4D4D` | Estados "en disputa" / error |

### Tipografía
- **Display/Headings:** Space Grotesk (geométrica, alto contraste, gratuita vía Google Fonts)
- **UI/Cuerpo:** Inter
- Escala tipográfica sugerida (rem, base 16px): `0.75rem` (12px, metadatos) / `0.875rem` (14px, cuerpo secundario) / `1rem` (16px, cuerpo) / `1.25rem` (20px, subtítulos) / `1.75rem` (28px, títulos de sección) / `2.5rem` (40px, hero/títulos principales)

### Espaciado, radios, sombras
- Escala de espaciado en base 8px: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px`
- Radios: `8px` (botones/inputs), `16px` (tarjetas), `9999px` (chips/badges/avatares)
- Sombra estándar de tarjeta sobre fondo oscuro: `0 4px 24px rgba(0,0,0,0.4)` — usar con moderación, el fondo ya es oscuro

---

## 8. Especificaciones de animación

Librería recomendada: **Framer Motion** (es una app de interacción, no un sitio de scroll cinematográfico — GSAP/ScrollTrigger se reserva para si en el futuro se construye un landing de marketing aparte para Embate).

| Qué se anima | Trigger | Duración | Easing | Notas |
|---|---|---|---|---|
| Línea de bracket dibujándose | Carga de la página del torneo | 400ms por conexión, escalonado 80ms entre líneas | `cubic-bezier(0.22, 1, 0.36, 1)` | Da sensación de "armado en vivo" |
| Tarjeta de partido — hover | Hover/focus | 150ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Elevación sutil + borde en acento lima |
| Toast de resultado confirmado | Confirmación de resultado | 250ms entrada, 200ms salida (auto-dismiss 4s) | `cubic-bezier(0.22, 1, 0.36, 1)` | Color de acento según éxito/disputa |
| Actualización de posición en tabla de liga | Nuevo resultado confirmado | 500ms | `cubic-bezier(0.65, 0, 0.35, 1)` | Reordenar filas con transición de posición, no salto brusco |
| Celebración al cerrar torneo | Torneo finalizado | 800ms | `cubic-bezier(0.22, 1, 0.36, 1)` | Confeti sutil en acento lima/azul, no genérico multicolor |

---

## 9. Cumplimiento legal — qué NO hacer (obligatorio)

- **Nunca** usar logos, marca o assets de propiedad intelectual de EA/EA Sports FC en la interfaz, marketing o nombre del producto.
- Incluir el disclaimer de no afiliación (sección 2) en el footer público y en cualquier página de torneo compartible.
- Embate **no custodia dinero de premios ni de inscripción** — si un organizador cobra inscripción vía Stripe Connect (V1.5), el dinero va directo a la cuenta del organizador; Embate solo cobra su comisión de plataforma sobre esa transacción. No construir ningún flujo donde Embate reciba y luego redistribuya el dinero de premios — eso convierte a Embate en operador de juego con dinero real y dispara requisitos regulatorios que están fuera de alcance de este producto.
- No usar lenguaje de apuesta/gambling ("apuesta", "wager", "bet") en ninguna copy del producto, incluso si el organizador ofrece premio en efectivo por su cuenta.

---

## 10. Inventario de assets (a producir en fase de producción)

| Asset | Uso | Formato | Estado |
|---|---|---|---|
| `embate_isotipo_v1.svg` | Logo principal, marca sola | SVG vectorial | ✅ Completado |
| `embate_logo-horizontal_v1.svg` | Headers, marca blanca | SVG vectorial | ✅ Completado (falta variante para fondo claro — ver nota sección 2) |
| `embate_app-icon_v1.svg` | PWA manifest, favicon | SVG vectorial | ✅ Completado — falta exportar a PNG en 512×512, 192×192 y 32×32 para el manifest (cualquier herramienta de conversión SVG→PNG sirve, no requiere rediseño) |
| Brand-kit board de referencia | Documentación interna, no para producción | PNG (generado en esta conversación) | Disponible como referencia visual del mood, no del logo final |
| Iconografía UI (bracket, calendario, estrella, disputa/bandera) | Interfaz de la app | SVG, set consistente de 1-2px stroke | Pendiente — se produce durante el desarrollo del design system en Fase 3, no bloquea el arranque |

---

## 11. Modelo de negocio (contexto para decisiones de producto, no para desarrollo directo)

- **Plan gratuito:** 1 torneo activo, máx. 8 jugadores, marca de Embate visible.
- **Starter (~$15–25/mes):** torneos ilimitados, hasta 32 jugadores, sin marca de Embate.
- **Pro (~$49–79/mes):** liga + copa + relámpago sin límite, bot de Discord, marca blanca completa, estadísticas de jugador.
- **Elite (~$99–149/mes o comisión por torneo):** verificación por IA + gráficas automáticas para redes.
- **Opción de comisión (V1.5):** 3–5% por transacción si el organizador usa el cobro de inscripción integrado (Stripe Connect), a cambio de un plan mensual más bajo.
- Estrategia de lanzamiento: 5–10 organizadores "fundadores" gratis a cambio de testimonios antes de cobrar en serio.

---

## 12. Instrucciones directas para Claude Code

**Stack sugerido:** Next.js 14 (App Router) + Tailwind CSS + Supabase (Postgres + Auth + Storage para las capturas de pantalla) como combinación pragmática para lanzar rápido. Ajustable si Claude Code tiene una razón técnica mejor, pero la app **requiere backend real con base de datos multi-tenant y autenticación** — esto no es un sitio estático de marketing.

**Qué NO improvisar:**
- No asumir un solo tenant/comunidad en ninguna parte del esquema de datos ni de la lógica de negocio.
- No fabricar afiliación con EA ni usar sus assets.
- No omitir el flujo de confirmación doble / disputa — es el mecanismo central de confianza del producto.
- No hacer el ranking "más ganador" global entre comunidades — siempre acotado por `community_id`.
- No hardcodear texto en componentes — toda cadena vive en archivos de traducción ES/EN desde el primer commit.
- No usar el logo/paleta genérica de IA — seguir estrictamente los design tokens de la sección 7.
- Mobile-first en cada pantalla — la mayoría de jugadores subirá capturas desde el celular.

**Criterios de aceptación visual:**
- Modo oscuro como estética principal, coherente con la paleta aprobada.
- Bracket y tabla de liga legibles y claros incluso con 32+ jugadores.
- Calificación de 5 estrellas y V-D-E visibles en el perfil sin necesidad de navegar a una subpágina.
- Panel de admin funcional en móvil, no solo en escritorio.
- Nada que se vea a plantilla genérica de IA — jerarquía visual clara, un solo punto focal por pantalla.

---

## 13. Piezas que faltaban (encontradas en esta revisión)

Revisando el paquete completo antes de pasarlo a desarrollo, esto faltaba y hay que resolverlo antes o durante el MVP:

- **Páginas legales:** Términos de Servicio y Política de Privacidad — obligatorias por estar recolectando emails, gamertags y estadísticas de jugadores, independientes del disclaimer de no afiliación con EA (sección 9). No están redactadas todavía; hay que producirlas antes de abrir registro público, no antes del desarrollo interno.
- **Librería de internacionalización:** usar `next-intl` (o `next-i18next`) desde el primer commit — nunca cadenas de texto sueltas en componentes, ni siquiera "para arreglar después".
- **Notificaciones transaccionales:** para MVP, al menos email de "tienes un resultado pendiente de confirmar" y "tu cruce está disponible". Ya tienes **Resend** conectado en tu cuenta — es la opción más directa, no hace falta evaluar otra.
- **Restricciones de carga de capturas:** formatos aceptados JPG/PNG/WEBP, tamaño máximo sugerido 8MB por archivo, almacenamiento en bucket de Supabase Storage separado por `community_id` (nunca un bucket compartido sin aislar por comunidad).
- **Límite de intentos / anti-abuso:** limitar cuántas capturas se pueden subir por partido en poco tiempo (evita spam/trolling en el sistema de disputas).
- **Analítica ligera (opcional pero recomendada):** algo simple tipo Plausible o PostHog para saber qué organizadores realmente usan la app antes de invertir en las features de V1.5/V2 — sin esto, decides el roadmap a ciegas.

## 14. Flujo de desarrollo y pruebas (iterativo)

Mismo estándar que ya usas en tus otros proyectos (RolyGuzM, Noble Line): **nunca se entrega código fuente directo, siempre una URL de vista previa.**

1. Claude Code construye por rebanadas, no todo de un jalón. Orden sugerido: (1) autenticación + creación de comunidad → (2) creación de torneo + inscripción → (3) generación de cruces + carga de resultado con confirmación doble → (4) tabla de liga/bracket automático → (5) perfil de jugador con V-D-E y estrellas → (6) panel de admin y disputas.
2. Cada rebanada se despliega a una **URL de preview de Vercel** — tú la pruebas como si fueras un organizador real, con datos de prueba.
3. Feedback se da sobre esa URL, no sobre descripciones — mucho más fácil detectar lo que no cuadra viéndolo funcionar.
4. Solo cuando el MVP completo esté probado y aprobado, se conecta el dominio real (una vez resuelto el tema de la sección 2.2) y se pasa a producción.
5. Las features de V1.5/V2 se agregan como rebanadas nuevas sobre la base ya validada, no como un relanzamiento.

---

*Fin del documento. Cualquier ajuste posterior a este paquete debe versionarse (v2, v3...) y no sobrescribir este archivo.*
