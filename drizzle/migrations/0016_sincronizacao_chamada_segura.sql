CREATE TABLE public.chamada_offline_acoes (id uuid PRIMARY KEY, user_id uuid NOT NULL, resultado text NOT NULL, recebida_em timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.chamada_offline_acoes TO authenticated;
GRANT ALL ON public.chamada_offline_acoes TO service_role;
ALTER TABLE public.chamada_offline_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY chamada_offline_propria ON public.chamada_offline_acoes FOR SELECT TO authenticated USING (user_id=auth.uid());
CREATE TABLE public.chamada_offline_versoes (aluno_id uuid NOT NULL, turma_id uuid NOT NULL, data date NOT NULL, versao timestamptz NOT NULL, PRIMARY KEY(aluno_id,turma_id,data));
GRANT SELECT ON public.chamada_offline_versoes TO authenticated;
GRANT ALL ON public.chamada_offline_versoes TO service_role;
ALTER TABLE public.chamada_offline_versoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY chamada_versoes_staff ON public.chamada_offline_versoes FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.chamada_guardar_versao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
 IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
 IF r.turma_id IS NOT NULL AND r.metodo IS DISTINCT FROM 'automatica' THEN
 INSERT INTO public.chamada_offline_versoes(aluno_id,turma_id,data,versao) VALUES(r.aluno_id,r.turma_id,r.data,clock_timestamp()) ON CONFLICT(aluno_id,turma_id,data) DO UPDATE SET versao=excluded.versao;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER presencas_offline_versao AFTER INSERT OR UPDATE OR DELETE ON public.presencas FOR EACH ROW EXECUTE FUNCTION public.chamada_guardar_versao();
CREATE OR REPLACE FUNCTION public.enviar_chamada_offline(_id uuid, _conta uuid, _aluno uuid, _turma uuid, _data date, _horario timestamptz, _status text, _remover boolean, _metodo text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v text; antiga timestamptz; em_licenca boolean;
BEGIN
 IF auth.uid() IS NULL OR auth.uid()<>_conta THEN RAISE EXCEPTION 'A conta mudou. Entre na conta que fez a chamada.'; END IF;
 IF NOT public.pode(auth.uid(),'registrar_presenca') THEN RAISE EXCEPTION 'Sua conta não tem permissão para registrar presença.'; END IF;
 IF _turma IS NULL OR _data>current_date+1 OR _horario>clock_timestamp()+interval '5 minutes' THEN RAISE EXCEPTION 'Data ou turma inválida. Confira o relógio do aparelho.'; END IF;
 IF _status IS NOT NULL AND _status NOT IN ('presente','falta','falta_justificada') THEN RAISE EXCEPTION 'Marcação inválida.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_aluno::text||_turma::text||_data::text,0));
 SELECT resultado INTO v FROM public.chamada_offline_acoes WHERE id=_id AND user_id=auth.uid();
 IF FOUND THEN RETURN v; END IF;
 IF EXISTS(SELECT 1 FROM public.chamada_offline_acoes WHERE id=_id) THEN RAISE EXCEPTION 'Ação de outra conta.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.alunos a JOIN public.matriculas m ON m.aluno_id=a.id JOIN public.turmas t ON t.id=m.turma_id WHERE a.id=_aluno AND a.ativo AND m.turma_id=_turma AND m.status='ativa' AND t.ativa) THEN RAISE EXCEPTION 'Aluno ou matrícula não está ativo nesta turma.'; END IF;
 SELECT versao INTO antiga FROM public.chamada_offline_versoes WHERE aluno_id=_aluno AND turma_id=_turma AND data=_data;
 IF antiga IS NULL THEN SELECT horario INTO antiga FROM public.presencas WHERE aluno_id=_aluno AND turma_id=_turma AND data=_data AND metodo IS DISTINCT FROM 'automatica'; END IF;
 IF antiga>_horario THEN v:='mais_recente'; ELSE
 SELECT EXISTS(SELECT 1 FROM public.licencas_medicas WHERE aluno_id=_aluno AND status='ativa' AND data_inicio<=_data AND data_retorno>=_data) INTO em_licenca;
 IF em_licenca AND (_remover OR _status IS DISTINCT FROM 'falta_justificada') THEN RAISE EXCEPTION 'Aluno em licença médica deve permanecer justificado.'; END IF;
 IF _remover THEN DELETE FROM public.presencas WHERE aluno_id=_aluno AND turma_id=_turma AND data=_data;
 ELSE
 INSERT INTO public.presencas(aluno_id,turma_id,data,status,metodo,horario,registrado_por) VALUES(_aluno,_turma,_data,_status,CASE WHEN _metodo='qrcode' THEN 'qrcode' ELSE 'manual' END,_horario,auth.uid()) ON CONFLICT(aluno_id,turma_id,data) DO UPDATE SET status=excluded.status,metodo=excluded.metodo,horario=excluded.horario,registrado_por=excluded.registrado_por;
 END IF;
 INSERT INTO public.chamada_offline_versoes VALUES(_aluno,_turma,_data,_horario) ON CONFLICT(aluno_id,turma_id,data) DO UPDATE SET versao=excluded.versao;
 v:='enviado'; END IF;
 INSERT INTO public.chamada_offline_acoes(id,user_id,resultado) VALUES(_id,auth.uid(),v);
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.enviar_chamada_offline(uuid,uuid,uuid,uuid,date,timestamptz,text,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.enviar_chamada_offline(uuid,uuid,uuid,uuid,date,timestamptz,text,boolean,text) TO authenticated;
REVOKE ALL ON FUNCTION public.chamada_guardar_versao() FROM PUBLIC,anon,authenticated;