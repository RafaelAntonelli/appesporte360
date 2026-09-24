CREATE UNIQUE INDEX IF NOT EXISTS matriculas_aluno_modalidade_ativa_key
ON public.matriculas (aluno_id, modalidade)
WHERE status = 'ativa';

CREATE OR REPLACE FUNCTION public.validar_limite_matriculas_ativas()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ativa' AND (
    SELECT count(*)
    FROM public.matriculas
    WHERE aluno_id = NEW.aluno_id
      AND status = 'ativa'
      AND id <> NEW.id
  ) >= 3 THEN
    RAISE EXCEPTION 'O aluno pode ter no máximo 3 modalidades ativas.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_limite_matriculas_ativas_trigger ON public.matriculas;
CREATE TRIGGER validar_limite_matriculas_ativas_trigger
BEFORE INSERT OR UPDATE OF aluno_id, status ON public.matriculas
FOR EACH ROW
EXECUTE FUNCTION public.validar_limite_matriculas_ativas();