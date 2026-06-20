-- Migration: reemplaza duracion_horas por cantidad_clases (bloques 45min) + agrega notas a clases
-- Fecha: 2026-06-20
-- IMPORTANTE: NO elimina duracion_horas — esperar confirmación manual antes del DROP

-- 1. Agregar cantidad_clases
ALTER TABLE cuaderno.clases
  ADD COLUMN IF NOT EXISTS cantidad_clases integer NOT NULL DEFAULT 1
  CONSTRAINT clases_cantidad_clases_check CHECK (cantidad_clases > 0);

-- 2. Migrar valores: CEIL(duracion_horas * 60 / 45)
--    45min(0.75h)→1, 1h→2, 1.5h→2, 2h→3, 3h→4, 4h→6
UPDATE cuaderno.clases
SET cantidad_clases = CEIL(duracion_horas * 60.0 / 45)::integer
WHERE duracion_horas IS NOT NULL
  AND duracion_horas > 0;

-- Filas con duracion_horas NULL o 0 quedan en default 1

-- 3. Agregar notas a clases (campo rápido, distinto a tabla notas)
ALTER TABLE cuaderno.clases
  ADD COLUMN IF NOT EXISTS notas text;
