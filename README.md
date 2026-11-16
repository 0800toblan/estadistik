<div align="center">

# Estadistik
### A WEB APP for organizing a Korfball League

### Estadísticas, partidos y equipos de la liga, en una web que se ve bien en el celu y en la compu.

![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

[Ver la web](#) · [Reportar un problema](../../issues)

</div>

---

## ✨ ¿Qué es?

Una web para llevar el día a día de una liga de korfball: quién juega con quién, cómo salieron los partidos y cómo rinde cada jugador. **Cualquiera puede mirar** los resultados y las estadísticas; **solo los organizadores** pueden cargar y editar datos, con su usuario y contraseña.

> 📸 *Acá va una captura de la web. Subila a una carpeta `docs/` y reemplazá esta línea por `![Captura](docs/captura.png)`.*

## 🚀 Funciones

| | |
|---|---|
| 🏠 **Inicio** | Resumen de la liga y últimos partidos |
| ➕ **Nuevo partido** | Alta de partidos y carga de estadísticas jugador por jugador |
| 📅 **Partidos** | Historial con resultado, fecha, hora y lugar |
| 👥 **Equipos** | Equipos y planteles con número de camiseta |
| 📊 **Estadísticas** | Puntos, asistencias, rebotes, tiros, robos y pérdidas por jugador |
| 🏆 **Ligas** | Varias ligas dentro de la misma web |
| 🔐 **Login de organizadores** | Solo ellos pueden crear, editar y borrar |

## 🧱 Stack

| Capa | Tecnología |
|---|---|
| Interfaz | React 18 + Tailwind CSS 4 |
| Empaquetado | Vite 5 |
| Base de datos y login | Supabase (Postgres + Auth) |
| Hosting | Vercel |

## 🛠️ Puesta en marcha

**Requisitos:** Node.js (LTS) y una cuenta gratuita de [Supabase](https://supabase.com).

### 1. Clonar e instalar
```bash
git clone https://github.com/USUARIO/REPO.git
cd REPO
npm install
```

### 2. Crear la base de datos
En tu proyecto de Supabase, abrí **SQL Editor** y ejecutá el contenido de
[`supabase/migrations/0001_schema.sql`](supabase/migrations/0001_schema.sql).
Crea las tablas, las reglas de seguridad y los datos iniciales.

### 3. Crear el organizador
1. **Authentication → Users → Add user**: cargá email y contraseña.
2. Editá el email en [`supabase/migrations/0002_primer_organizador.sql`](supabase/migrations/0002_primer_organizador.sql) y ejecutalo en el SQL Editor.
3. Recomendado: en **Authentication → Sign In / Providers → Email**, desactivá el alta de nuevos usuarios.

### 4. Variables de entorno
Copiá el archivo de ejemplo y completalo con la URL y la *publishable key* de tu proyecto (**Settings → API Keys**):

```bash
cp .env.example .env      # en Windows: copy .env.example .env
```
```env
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

### 5. Correr en local
```bash
npm run dev
```
Abrí la dirección que muestra la terminal (normalmente `http://localhost:5173`).

## ☁️ Publicar

1. Subí el repo a GitHub.
2. En [Vercel](https://vercel.com): **Add New → Project** e importá el repo.
3. En **Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Desde ahí, cada `git push` publica solo.

## 🔒 Seguridad

- **Lectura pública, escritura restringida.** Las reglas viven en la base de datos (Row Level Security), no solo en la pantalla: solo los usuarios de la tabla `organizers` pueden modificar datos.
- La *publishable key* es pública por diseño. La **secret key** de Supabase **nunca** se usa en este proyecto ni se sube al repo.
- El archivo `.env` está en el `.gitignore`.

## 🗂️ Estructura

```
├── src/
│   ├── App.jsx            # Vistas y lógica de la liga
│   ├── Root.jsx           # Login y pantalla de ingreso
│   └── lib/
│       ├── supabase.js    # Cliente de Supabase
│       ├── syncDb.js      # Lectura y guardado de datos
│       └── useAuth.js     # Sesión y rol de organizador
├── supabase/migrations/   # Esquema SQL y seguridad
└── index.html
```

## 🗺️ Próximos pasos

- [x] Datos persistentes con Supabase
- [x] Login de organizadores
- [ ] Ocultar botones de edición para el público
- [ ] Diseño responsive completo (menú inferior en celu, estadísticas en tarjetas)
- [ ] Actualización en vivo para varios organizadores a la vez

## 🤝 Contribuir

Ideas y mejoras son bienvenidas: abrí un *issue* o mandá un *pull request*.

---

<div align="center">

Hecho con ❤️ para la comunidad del korfball 🧉

</div>
