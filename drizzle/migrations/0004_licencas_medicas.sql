CREATE TABLE public.licencas_medicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_retorno date NOT NULL,
  motivo text,
  anexo_path text,
  status text NOT NULL DEFAULT 'ativa',
  concluida_em timestamptz,
  concluida_por uuid,
  liberacao_path text,
  registrado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT licencas_status_check CHECK (status IN ('ativa','concluida')),
  CONSTRAINT licencas_datas_check CHECK (data_retorno >= data_inicio)
);
CREATE INDEX licencas_medicas_aluno_idx ON public.licencas_medicas(aluno_id);
CREATE UNIQUE INDEX licencas_uma_ativa_por_aluno ON public.licencas_medicas(aluno_id) WHERE status = 'ativa';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licencas_medicas TO authenticated;
GRANT ALL ON public.licencas_medicas TO service_role;
ALTER TABLE public.licencas_medicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY licencas_staff_all ON public.licencas_medicas FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));