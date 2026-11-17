CREATE TABLE public.registro_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL,
  descricao text NOT NULL,
  feito_por uuid,
  feito_por_nome text
);
CREATE INDEX registro_acoes_created_at_idx ON public.registro_acoes (created_at DESC);
GRANT SELECT ON public.registro_acoes TO authenticated;
GRANT ALL ON public.registro_acoes TO service_role;
ALTER TABLE public.registro_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem o registro de acoes" ON public.registro_acoes
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.registrar_acao(_tipo text, _descricao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.registro_acoes (tipo, descricao, feito_por, feito_por_nome)
  VALUES (_tipo, _descricao, auth.uid(), CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.nome_usuario(auth.uid()) END);
END $$;
REVOKE ALL ON FUNCTION public.registrar_acao(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nome_ou_email(_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(public.nome_usuario(_id), ''), (SELECT email FROM auth.users WHERE id = _id), 'conta removida')
$$;
REVOKE ALL ON FUNCTION public.nome_ou_email(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_aluno_excluido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.registrar_acao('aluno_excluido', 'Aluno excluído: ' || OLD.nome || ' (matrícula ' || COALESCE(OLD.codigo, '—') || ')');
  RETURN OLD;
END $$;
CREATE TRIGGER registro_aluno_excluido AFTER DELETE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.log_aluno_excluido();

CREATE OR REPLACE FUNCTION public.log_papel_equipe() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    r := CASE NEW.role WHEN 'admin' THEN 'Administrador' ELSE 'Professor' END;
    PERFORM public.registrar_acao('acesso_concedido', 'Acesso concedido a ' || public.nome_ou_email(NEW.user_id) || ' como ' || r);
    RETURN NEW;
  ELSE
    -- Conta apagada: a remoção já fica registrada pelo servidor.
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.user_id) THEN RETURN OLD; END IF;
    r := CASE OLD.role WHEN 'admin' THEN 'Administrador' ELSE 'Professor' END;
    PERFORM public.registrar_acao('acesso_retirado', 'Acesso retirado de ' || public.nome_ou_email(OLD.user_id) || ' (era ' || r || ')');
    RETURN OLD;
  END IF;
END $$;
CREATE TRIGGER registro_papel_equipe AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_papel_equipe();

CREATE OR REPLACE FUNCTION public.log_permissao_professor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    PERFORM public.registrar_acao(
      CASE WHEN NEW.ativo THEN 'permissao_liberada' ELSE 'permissao_bloqueada' END,
      'Permissão dos professores ' || CASE WHEN NEW.ativo THEN 'liberada' ELSE 'bloqueada' END || ': ' || NEW.chave);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER registro_permissao_professor AFTER INSERT OR UPDATE ON public.permissoes_professor
  FOR EACH ROW EXECUTE FUNCTION public.log_permissao_professor();

CREATE TABLE public.avisos_atestado_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  vencimento date NOT NULL,
  antecedencia integer NOT NULL,
  aviso_id uuid,
  enviados integer NOT NULL DEFAULT 0,
  UNIQUE (aluno_id, vencimento, antecedencia)
);
GRANT ALL ON public.avisos_atestado_enviados TO service_role;
ALTER TABLE public.avisos_atestado_enviados ENABLE ROW LEVEL SECURITY;