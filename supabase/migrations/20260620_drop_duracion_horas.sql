-- Migration: eliminar campo duracion_horas de cuaderno.clases
-- Fecha: 2026-06-20
-- Prerequisito: cantidad_clases ya migrado y validado en producción

ALTER TABLE cuaderno.clases DROP COLUMN duracion_horas;
