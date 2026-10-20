ALTER TABLE public.aluno_aparelhos ADD COLUMN IF NOT EXISTS lembretes_aula boolean NOT NULL DEFAULT true;

CREATE TABLE public.lembretes_aula_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data date NOT NULL,
  antecedencia smallint NOT NULL CHECK (antecedencia IN (15, 30)),
  celulares integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turma_id, data, antecedencia)
);

GRANT SELECT ON public.lembretes_aula_enviados TO authenticated;
GRANT ALL ON public.lembretes_aula_enviados TO service_role;

ALTER TABLE public.lembretes_aula_enviados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Administradores veem os lembretes enviados"
  ON public.lembretes_aula_enviados FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));