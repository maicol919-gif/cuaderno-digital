# Cuaderno Digital del Instructor — Brief técnico (MVP)

## Stack (ajustado a tu setup: GitHub Pages + Supabase)

- **Frontend:** React + Vite (PWA), desplegado en **GitHub Pages**.
- **Backend:** **Supabase** — Postgres (tablas `alumnos` y `clases`), Auth para login del instructor, Storage para las firmas (PNG).
- **Firma digital:** `signature_pad` (canvas en el navegador).
- **PDF:** `jspdf` + `jspdf-autotable`, generado en el cliente.

### ⚠️ Punto a decidir: modo offline
El MVP original asume que el instructor puede registrar clases sin internet (parking, calle, etc.). Con Supabase, **escribir una clase requiere conexión**. Dos opciones:
1. **MVP v1 simple:** requiere conexión para guardar (aceptable si la cobertura no es un problema real para tu hermano).
2. **Cola offline:** guardar primero en `localStorage`/IndexedDB y sincronizar a Supabase cuando vuelva la señal (poco código extra, recomendado si quieres mantener la promesa "sin papeleo, sin depender de nada").

Recomiendo **empezar con la opción 1** y agregar la cola offline solo si en la práctica se nota el problema — menos complejidad inicial.

## Modelo de datos (Supabase / Postgres)

```sql
create table alumnos (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references auth.users(id),
  nombre text not null,
  codigo text
);

create table clases (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references auth.users(id),
  alumno_id uuid references alumnos(id),
  fecha date not null,
  hora_inicio time not null,
  duracion_horas numeric not null,       -- 1, 1.5, 2, 3...
  firma_url text,                        -- Supabase Storage
  origen text default 'manual',          -- 'manual' | 'importada' (fase 2)
  estado text default 'confirmada'
);
```

> `origen` y `estado` no se usan en el MVP (siempre "manual"/"confirmada"), pero quedan listos para la futura integración con calendario sin migrar nada.

## Estructura de carpetas sugerida (Vite + React)

```
/src
  /pages
    Hoy.tsx
    NuevaClase.tsx
    Firma.tsx
    Alumnos.tsx
    Resumen.tsx
  /components
    ClaseCard.tsx
    AlumnoRow.tsx
    DuracionPicker.tsx
  /lib
    supabaseClient.ts
    pdf.ts
/supabase
  migrations/
    001_init.sql
.github/workflows/deploy.yml   // build + deploy a GitHub Pages
```

## Orden sugerido de construcción
1. **Proyecto Supabase** — crear tablas (`001_init.sql`) + Auth simple (email/password para el instructor).
2. **Mis alumnos** — alta/listado.
3. **Nueva clase** — formulario (alumno + hora + duración).
4. **Hoy** — lista del día, botón "+".
5. **Firma** — captura, sube a Supabase Storage, guarda `firma_url`.
6. **Resumen** — suma de horas por alumno (semana/mes), vía query a Supabase.
7. **Exportar PDF** — usar `informe-visual-cuaderno-instructor.pdf` (última página) como referencia exacta de diseño.
8. **Deploy** — GitHub Actions a GitHub Pages.

## Referencias de diseño ya aprobadas
- `cuaderno-instructor-mockups.html` — pantallas de alta fidelidad (colores, tipografía, componentes).
- `informe-visual-cuaderno-instructor.pdf` — última página = formato exacto del PDF a generar.

## Recordatorios de producto (no perder de vista)
- Sin cronómetro, sin geolocalización, sin "iniciar/finalizar clase".
- 1 registro = 1 clase = N horas (no horas separadas de clases).
- Cada instructor solo ve sus propios alumnos y clases (RLS en Supabase con `instructor_id = auth.uid()`).
