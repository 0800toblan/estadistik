# Liga de Korfball — contexto del proyecto

Web de una liga de korfball (equipos, jugadores, partidos, estadísticas). Vite + React + Tailwind v4 + Supabase.
Nació de una copia de un proyecto de un amigo; este repo es independiente.

## Arquitectura
- `src/App.jsx`: toda la UI (vistas Inicio, Nuevo partido, Partidos, Equipos, Estadísticas, Ligas). Estilos inline.
  Mantiene la base en memoria como `{ leagues, teams, players, matches, stats }` y la modifica con `commit(updater)`.
- `src/lib/syncDb.js`: `loadDb()` lee las 5 tablas; `saveDiff(prev, next)` sube solo lo que cambió.
- `src/lib/useAuth.js` + `src/Root.jsx`: login con email/contraseña y chequeo de organizador.
- `supabase/migrations/`: esquema SQL, seguridad (RLS) y datos iniciales.

## Reglas
- Cualquiera lee; solo usuarios en la tabla `organizers` escriben (RLS en la base, no solo en la UI).
- `commit()` ignora los cambios si `canEdit` es false. Los botones de editar/borrar todavía se ven en modo lectura.
- Para agregar una métrica: sumarla a `STAT_FIELDS` (App.jsx), a `COLUMNS.stats` (syncDb.js) y crear una migración SQL nueva (`alter table public.stats add column ...`).
- No subir `.env` (solo `.env.example`). La clave `anon` es pública; la seguridad la dan las políticas RLS.

## Pendiente (en este orden)
1. Ocultar botones de crear/editar/borrar cuando `canEdit` es false (ya llega en `ctx`).
2. Responsive real: barra de tabs inferior en celu, tabla de estadísticas como tarjetas en pantallas chicas, botones +/− de carga de al menos 44 px, modales como hoja inferior en celu.
3. Pasar los estilos inline a clases de Tailwind con breakpoints.
4. Opcional: Supabase Realtime para que varios organizadores vean los cambios al instante.
