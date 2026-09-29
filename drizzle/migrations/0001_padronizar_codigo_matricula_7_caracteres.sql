CREATE OR REPLACE FUNCTION public.gerar_codigo_matricula()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  caracteres constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  candidato text;
  indice integer;
BEGIN
  LOOP
    candidato := '';
    FOR indice IN 1..7 LOOP
      candidato := candidato || substr(caracteres, floor(random() * length(caracteres))::integer + 1, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.alunos
      WHERE codigo = candidato
    );
  END LOOP;

  RETURN candidato;
END;
$$;

ALTER TABLE public.alunos
  ALTER COLUMN codigo SET DEFAULT public.gerar_codigo_matricula();

ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_codigo_formato_7_caracteres
  CHECK (codigo ~ '^[A-Z0-9]{7}$');