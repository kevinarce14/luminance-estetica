-- Alinea las fechas de "appointments" con producción: timestamptz.
--
-- En Neon ya son timestamptz (las creó una versión anterior de FastAPI) y esta migración
-- no hace nada. En las bases creadas por el código actual de FastAPI o por 0_init son
-- timestamp sin zona con valores en UTC: se convierten interpretándolos como UTC, así
-- cada turno conserva el mismo instante.
DO $$
DECLARE
  col TEXT;
BEGIN
  FOREACH col IN ARRAY ARRAY['appointment_date', 'cancelled_at', 'created_at', 'updated_at'] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'luminance-estetica'
        AND table_name = 'appointments'
        AND column_name = col
        AND data_type = 'timestamp without time zone'
    ) THEN
      EXECUTE format(
        'ALTER TABLE "luminance-estetica"."appointments" ALTER COLUMN %I SET DATA TYPE TIMESTAMPTZ(6) USING %I AT TIME ZONE ''UTC''',
        col, col
      );
    END IF;
  END LOOP;
END $$;
