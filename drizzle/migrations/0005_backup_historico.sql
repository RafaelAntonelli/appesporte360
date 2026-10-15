CREATE TABLE public.backup_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  tipo text NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual','automatico')),
  usuario_id uuid,
  usuario_nome text,
  enviados integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sucesso',
  planilha_nome text,
  planilha_id text,
  falhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  resumo text
);
GRANT SELECT ON public.backup_historico TO authenticated;
GRANT ALL ON public.backup_historico TO service_role;
ALTER TABLE public.backup_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem histórico de backup" ON public.backup_historico
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX backup_historico_iniciado_idx ON public.backup_historico (iniciado_em DESC);