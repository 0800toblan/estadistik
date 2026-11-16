# Puesta en marcha

1. **Supabase**: creá un proyecto gratis. En *SQL Editor* ejecutá `supabase/migrations/0001_schema.sql`.
2. **Organizador**: en *Authentication → Users → Add user* creá tu usuario (email + contraseña, "Auto confirm"). Después editá el email en `0002_primer_organizador.sql` y ejecutalo.
   Recomendado: *Authentication → Sign In / Providers → Email* y desactivá "Allow new users to sign up".
3. **Variables**: copiá `.env.example` a `.env` y completá URL y `anon key` (*Project Settings → API*).
4. **Local**: `npm install` y `npm run dev`.
5. **Publicar**: subí el repo a GitHub, importalo en Vercel y cargá las dos variables `VITE_...` en *Settings → Environment Variables*.
