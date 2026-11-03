-- Configuração única da falta automática (começa desligada, prazo padrão 15 min)
CREATE TABLE public.falta_automatica (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativa boolean NOT NULL DEFAULT false,
  minutos integer NOT NULL DEFAULT 15 CHECK (minutos BETWEEN 5 AND 60 AND minutos % 5 = 0),
  ligada_em timestamptz,
  atualizado_por uuid,
  atualizado_por_nome text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.falta_automatica TO authenticated;
GRANT ALL ON public.falta_automatica TO service_role;
ALTER TABLE public.falta_automatica ENABLE ROW LEVEL SECURITY;
CREATE POLICY falta_automatica_staff_read ON public.falta_automatica FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY falta_automatica_admin_insert ON public.falta_automatica FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY falta_automatica_admin_update ON public.falta_automatica FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Horários programados no agendador (mantidos pela função de reprogramação)
CREATE TABLE public.falta_automatica_agenda (
  nome text PRIMARY KEY,
  horario_brasilia text NOT NULL,
  agenda text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.falta_automatica_agenda TO authenticated;
GRANT ALL ON public.falta_automatica_agenda TO service_role;
ALTER TABLE public.falta_automatica_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY falta_automatica_agenda_staff_read ON public.falta_automatica_agenda FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Uma verificação por turma e dia (impede repetir e permite mostrar o resultado)
CREATE TABLE public.faltas_automaticas_execucoes (
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data date NOT NULL,
  prazo_minutos integer NOT NULL,
  faltas integer NOT NULL DEFAULT 0,
  executado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (turma_id, data)
);
GRANT SELECT ON public.faltas_automaticas_execucoes TO authenticated;
GRANT ALL ON public.faltas_automaticas_execucoes TO service_role;
ALTER TABLE public.faltas_automaticas_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY faltas_automaticas_execucoes_staff_read ON public.faltas_automaticas_execucoes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Minutos desde a meia-noite do início da aula ("16:00 às 17:30", "17 às 18:30", "16;00 às 17:30")
CREATE OR REPLACE FUNCTION public.inicio_da_aula(_horario text)
RETURNS integer LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE m text[]; h int; mi int;
BEGIN
  m := regexp_match(trim(coalesce(_horario, '')), '^(\d{1,2})(?:\s*[:;hH.]\s*(\d{2}))?');
  IF m IS NULL THEN RETURN NULL; END IF;
  h := m[1]::int; mi := coalesce(m[2], '0')::int;
  IF h > 23 OR mi > 59 THEN RETURN NULL; END IF;
  RETURN h * 60 + mi;
END $$;

-- "Seg", "Sáb", "terça" → 0 (domingo) a 6 (sábado)
CREATE OR REPLACE FUNCTION public.dia_semana_num(_dia text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT array_position(ARRAY['dom','seg','ter','qua','qui','sex','sab'],
    left(translate(lower(trim(coalesce(_dia, ''))), 'áàâãéêíóôõúç', 'aaaaeeiooouc'), 3)) - 1
$$;

-- Lança "Falta" (automática) para quem ainda não tem registro, nas turmas cujo prazo já passou hoje
CREATE OR REPLACE FUNCTION public.aplicar_faltas_automaticas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg public.falta_automatica%ROWTYPE;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_dow int := extract(dow FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  v_min int := extract(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int * 60
             + extract(minute FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
  t record; v_n int; v_total int := 0;
BEGIN
  SELECT * INTO cfg FROM public.falta_automatica WHERE id;
  IF NOT FOUND OR NOT cfg.ativa THEN RETURN 0; END IF;

  FOR t IN
    SELECT tu.id
      FROM public.turmas tu
     WHERE tu.ativa
       AND public.inicio_da_aula(tu.horario) IS NOT NULL
       AND EXISTS (SELECT 1 FROM unnest(tu.dias_semana) d WHERE public.dia_semana_num(d) = v_dow)
       AND public.inicio_da_aula(tu.horario) + cfg.minutos <= v_min
       -- só prazos que vencem depois de a falta automática ser ligada
       AND ((v_hoje::timestamp + make_interval(mins => public.inicio_da_aula(tu.horario) + cfg.minutos))
              AT TIME ZONE 'America/Sao_Paulo') >= coalesce(cfg.ligada_em, now())
       AND NOT EXISTS (SELECT 1 FROM public.faltas_automaticas_execucoes e WHERE e.turma_id = tu.id AND e.data = v_hoje)
  LOOP
    INSERT INTO public.faltas_automaticas_execucoes (turma_id, data, prazo_minutos)
    VALUES (t.id, v_hoje, cfg.minutos) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN CONTINUE; END IF;

    INSERT INTO public.presencas (aluno_id, turma_id, data, metodo, status, observacoes, horario, registrado_por_nome)
    SELECT DISTINCT m.aluno_id, t.id, v_hoje, 'automatica', 'falta',
           format('Falta automática: sem registro %s min após o início da aula', cfg.minutos), now(), 'Falta automática'
      FROM public.matriculas m
      JOIN public.alunos a ON a.id = m.aluno_id AND a.ativo
     WHERE m.turma_id = t.id AND m.status = 'ativa' AND m.data_inicio <= v_hoje
       AND NOT EXISTS (SELECT 1 FROM public.licencas_medicas l
                        WHERE l.aluno_id = m.aluno_id AND l.status = 'ativa' AND l.data_inicio <= v_hoje)
       AND NOT EXISTS (SELECT 1 FROM public.presencas p
                        WHERE p.aluno_id = m.aluno_id AND p.turma_id = t.id AND p.data = v_hoje)
    ON CONFLICT (aluno_id, turma_id, data) DO NOTHING;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    UPDATE public.faltas_automaticas_execucoes SET faltas = v_n WHERE turma_id = t.id AND data = v_hoje;
    v_total := v_total + v_n;
  END LOOP;
  RETURN v_total;
END $$;

-- Refaz a agenda: um horário por (início da aula + prazo), só nos dias com aula; nada quando desligada
CREATE OR REPLACE FUNCTION public.reprogramar_falta_automatica()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE cfg public.falta_automatica%ROWTYPE; j record; r record; v_nome text; v_agenda text;
BEGIN
  FOR j IN SELECT nome FROM public.falta_automatica_agenda LOOP
    BEGIN
      PERFORM cron.unschedule(j.nome);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  DELETE FROM public.falta_automatica_agenda WHERE true;

  SELECT * INTO cfg FROM public.falta_automatica WHERE id;
  IF NOT FOUND OR NOT cfg.ativa THEN RETURN; END IF;

  FOR r IN
    WITH base AS (
      SELECT public.inicio_da_aula(t.horario) + cfg.minutos AS m_br,
             public.dia_semana_num(d) AS dow
        FROM public.turmas t, unnest(t.dias_semana) d
       WHERE t.ativa AND public.inicio_da_aula(t.horario) IS NOT NULL
    )
    SELECT m_br, ((m_br + 180) % 1440) / 60 AS hora, ((m_br + 180) % 1440) % 60 AS minuto,  -- Brasília (UTC-3) → UTC
           string_agg(DISTINCT ((dow + (m_br + 180) / 1440) % 7)::text, ',') AS dias
      FROM base WHERE dow IS NOT NULL AND m_br < 1440
     GROUP BY 1, 2, 3
  LOOP
    v_nome := format('falta-automatica-%s%s', lpad(r.hora::text, 2, '0'), lpad(r.minuto::text, 2, '0'));
    v_agenda := format('%s %s * * %s', r.minuto, r.hora, r.dias);
    PERFORM cron.schedule(v_nome, v_agenda, 'SELECT public.aplicar_faltas_automaticas();');
    INSERT INTO public.falta_automatica_agenda (nome, horario_brasilia, agenda)
    VALUES (v_nome, lpad((r.m_br / 60)::text, 2, '0') || ':' || lpad((r.m_br % 60)::text, 2, '0'), v_agenda);
  END LOOP;
END $$;

-- Ao ligar: registra o momento; guarda quem alterou
CREATE OR REPLACE FUNCTION public.preparar_falta_automatica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.id := true;
  NEW.updated_at := now();
  NEW.atualizado_por := auth.uid();
  NEW.atualizado_por_nome := CASE WHEN auth.uid() IS NULL THEN NULL ELSE public.nome_usuario(auth.uid()) END;
  IF NEW.ativa AND (TG_OP = 'INSERT' OR NOT OLD.ativa) THEN
    NEW.ligada_em := now();
  ELSIF NOT NEW.ativa THEN
    NEW.ligada_em := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_reprogramar_falta_automatica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.reprogramar_falta_automatica();
  RETURN NULL;
END $$;

-- Marcação da equipe substitui a falta automática (some o texto e o nome "Falta automática")
CREATE OR REPLACE FUNCTION public.substituir_falta_automatica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.metodo = 'automatica' AND NEW.metodo IS DISTINCT FROM 'automatica' THEN
    IF NEW.observacoes IS NOT DISTINCT FROM OLD.observacoes THEN NEW.observacoes := NULL; END IF;
    NEW.registrado_por := coalesce(NEW.registrado_por, auth.uid());
    NEW.registrado_por_nome := NULL;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.aplicar_faltas_automaticas() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reprogramar_falta_automatica() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.preparar_falta_automatica() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_reprogramar_falta_automatica() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.substituir_falta_automatica() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER falta_automatica_preparar BEFORE INSERT OR UPDATE ON public.falta_automatica
  FOR EACH ROW EXECUTE FUNCTION public.preparar_falta_automatica();
CREATE TRIGGER falta_automatica_reprogramar AFTER INSERT OR UPDATE ON public.falta_automatica
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reprogramar_falta_automatica();
CREATE TRIGGER turmas_reprogramar_falta_automatica AFTER INSERT OR DELETE OR UPDATE OF horario, dias_semana, ativa ON public.turmas
  FOR EACH STATEMENT EXECUTE FUNCTION public.trg_reprogramar_falta_automatica();
-- nome com "a_" para rodar antes de presencas_nome_registro (que preenche o nome de quem marcou)
CREATE TRIGGER presencas_a_substituir_automatica BEFORE UPDATE ON public.presencas
  FOR EACH ROW EXECUTE FUNCTION public.substituir_falta_automatica();