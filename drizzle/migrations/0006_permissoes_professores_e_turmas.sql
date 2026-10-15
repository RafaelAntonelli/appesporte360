CREATE TABLE public.permissoes_professor (
  chave text PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.permissoes_professor TO authenticated;
GRANT ALL ON public.permissoes_professor TO service_role;
ALTER TABLE public.permissoes_professor ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissoes_staff_read ON public.permissoes_professor FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY permissoes_admin_insert ON public.permissoes_professor FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY permissoes_admin_update ON public.permissoes_professor FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.permissoes_professor (chave)
SELECT unnest(ARRAY['cadastrar_alunos','editar_alunos','editar_turmas','registrar_presenca','gerenciar_licencas','gerenciar_fila','ver_relatorios','editar_configuracoes']);

CREATE OR REPLACE FUNCTION public.pode(_user_id uuid, _permissao text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin')
    OR (public.has_role(_user_id, 'professor')
        AND COALESCE((SELECT ativo FROM public.permissoes_professor WHERE chave = _permissao), false));
$$;

CREATE TABLE public.professor_turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turma_id)
);
GRANT SELECT, INSERT, DELETE ON public.professor_turmas TO authenticated;
GRANT ALL ON public.professor_turmas TO service_role;
ALTER TABLE public.professor_turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY prof_turmas_staff_read ON public.professor_turmas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY prof_turmas_admin_insert ON public.professor_turmas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY prof_turmas_admin_delete ON public.professor_turmas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas com permissões
DROP POLICY alunos_staff_insert ON public.alunos;
CREATE POLICY alunos_staff_insert ON public.alunos FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(), 'cadastrar_alunos'));
DROP POLICY alunos_staff_update ON public.alunos;
CREATE POLICY alunos_staff_update ON public.alunos FOR UPDATE TO authenticated USING (public.pode(auth.uid(), 'editar_alunos') OR public.pode(auth.uid(), 'cadastrar_alunos')) WITH CHECK (public.pode(auth.uid(), 'editar_alunos') OR public.pode(auth.uid(), 'cadastrar_alunos'));

DROP POLICY matriculas_staff_all ON public.matriculas;
CREATE POLICY matriculas_staff_read ON public.matriculas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY matriculas_staff_write ON public.matriculas FOR ALL TO authenticated USING (public.pode(auth.uid(), 'cadastrar_alunos') OR public.pode(auth.uid(), 'editar_alunos')) WITH CHECK (public.pode(auth.uid(), 'cadastrar_alunos') OR public.pode(auth.uid(), 'editar_alunos'));

DROP POLICY turmas_staff_write ON public.turmas;
CREATE POLICY turmas_staff_write ON public.turmas FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(), 'editar_turmas'));
DROP POLICY turmas_staff_update ON public.turmas;
CREATE POLICY turmas_staff_update ON public.turmas FOR UPDATE TO authenticated USING (public.pode(auth.uid(), 'editar_turmas')) WITH CHECK (public.pode(auth.uid(), 'editar_turmas'));
DROP POLICY horarios_staff_insert ON public.horarios;
CREATE POLICY horarios_staff_insert ON public.horarios FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(), 'editar_turmas'));
DROP POLICY horarios_staff_update ON public.horarios;
CREATE POLICY horarios_staff_update ON public.horarios FOR UPDATE TO authenticated USING (public.pode(auth.uid(), 'editar_turmas')) WITH CHECK (public.pode(auth.uid(), 'editar_turmas'));
DROP POLICY grupos_dias_staff_insert ON public.grupos_dias;
CREATE POLICY grupos_dias_staff_insert ON public.grupos_dias FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(), 'editar_turmas'));
DROP POLICY grupos_dias_staff_update ON public.grupos_dias;
CREATE POLICY grupos_dias_staff_update ON public.grupos_dias FOR UPDATE TO authenticated USING (public.pode(auth.uid(), 'editar_turmas')) WITH CHECK (public.pode(auth.uid(), 'editar_turmas'));

DROP POLICY presencas_staff_all ON public.presencas;
CREATE POLICY presencas_staff_read ON public.presencas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY presencas_staff_write ON public.presencas FOR ALL TO authenticated USING (public.pode(auth.uid(), 'registrar_presenca')) WITH CHECK (public.pode(auth.uid(), 'registrar_presenca'));

DROP POLICY licencas_staff_all ON public.licencas_medicas;
CREATE POLICY licencas_staff_read ON public.licencas_medicas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY licencas_staff_write ON public.licencas_medicas FOR ALL TO authenticated USING (public.pode(auth.uid(), 'gerenciar_licencas')) WITH CHECK (public.pode(auth.uid(), 'gerenciar_licencas'));

DROP POLICY fila_espera_staff_all ON public.fila_espera;
CREATE POLICY fila_espera_staff_read ON public.fila_espera FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY fila_espera_staff_write ON public.fila_espera FOR ALL TO authenticated USING (public.pode(auth.uid(), 'gerenciar_fila')) WITH CHECK (public.pode(auth.uid(), 'gerenciar_fila'));

DROP POLICY configuracoes_staff_update ON public.configuracoes;
CREATE POLICY configuracoes_staff_update ON public.configuracoes FOR UPDATE TO authenticated USING (public.pode(auth.uid(), 'editar_configuracoes')) WITH CHECK (public.pode(auth.uid(), 'editar_configuracoes'));
DROP POLICY configuracoes_staff_write ON public.configuracoes;
CREATE POLICY configuracoes_staff_write ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(), 'editar_configuracoes'));

-- Nomes de quem registrou, preservados após remoção da conta
ALTER TABLE public.matriculas ADD COLUMN registrado_por_nome text;
ALTER TABLE public.presencas ADD COLUMN registrado_por_nome text;
ALTER TABLE public.alunos ADD COLUMN inativado_por_nome text;

CREATE OR REPLACE FUNCTION public.nome_usuario(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(u.raw_user_meta_data->>'nome',''), NULLIF(u.raw_user_meta_data->>'full_name',''), p.nome, u.email)
  FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = _id;
$$;

CREATE OR REPLACE FUNCTION public.preencher_nome_registro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'alunos' THEN
    IF NEW.inativado_por IS NULL THEN NEW.inativado_por_nome := NULL;
    ELSIF TG_OP = 'INSERT' OR NEW.inativado_por IS DISTINCT FROM OLD.inativado_por THEN
      NEW.inativado_por_nome := public.nome_usuario(NEW.inativado_por);
    END IF;
  ELSE
    IF NEW.registrado_por IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.registrado_por IS DISTINCT FROM OLD.registrado_por) THEN
      NEW.registrado_por_nome := public.nome_usuario(NEW.registrado_por);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER matriculas_nome_registro BEFORE INSERT OR UPDATE ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.preencher_nome_registro();
CREATE TRIGGER presencas_nome_registro BEFORE INSERT OR UPDATE ON public.presencas FOR EACH ROW EXECUTE FUNCTION public.preencher_nome_registro();
CREATE TRIGGER alunos_nome_inativacao BEFORE INSERT OR UPDATE ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.preencher_nome_registro();

UPDATE public.matriculas SET registrado_por_nome = public.nome_usuario(registrado_por) WHERE registrado_por IS NOT NULL;
UPDATE public.presencas SET registrado_por_nome = public.nome_usuario(registrado_por) WHERE registrado_por IS NOT NULL;
UPDATE public.alunos SET inativado_por_nome = public.nome_usuario(inativado_por) WHERE inativado_por IS NOT NULL;
UPDATE public.anotacoes_alunos SET autor_nome = public.nome_usuario(autor_id) WHERE autor_nome IS NULL AND autor_id IS NOT NULL;

ALTER TABLE public.matriculas DROP CONSTRAINT matriculas_registrado_por_fkey;
ALTER TABLE public.matriculas ADD CONSTRAINT matriculas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.presencas DROP CONSTRAINT presencas_registrado_por_fkey;
ALTER TABLE public.presencas ADD CONSTRAINT presencas_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.alunos DROP CONSTRAINT alunos_inativado_por_fkey;
ALTER TABLE public.alunos ADD CONSTRAINT alunos_inativado_por_fkey FOREIGN KEY (inativado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.anotacoes_alunos DROP CONSTRAINT anotacoes_alunos_autor_id_fkey;
ALTER TABLE public.anotacoes_alunos ADD CONSTRAINT anotacoes_alunos_autor_id_fkey FOREIGN KEY (autor_id) REFERENCES auth.users(id) ON DELETE SET NULL;