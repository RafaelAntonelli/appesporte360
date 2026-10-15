CREATE OR REPLACE FUNCTION public.preencher_nome_registro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'alunos' THEN
    IF NEW.ativo THEN NEW.inativado_por_nome := NULL;
    ELSIF NEW.inativado_por IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.inativado_por IS DISTINCT FROM OLD.inativado_por) THEN
      NEW.inativado_por_nome := public.nome_usuario(NEW.inativado_por);
    END IF;
  ELSE
    IF NEW.registrado_por IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.registrado_por IS DISTINCT FROM OLD.registrado_por) THEN
      NEW.registrado_por_nome := public.nome_usuario(NEW.registrado_por);
    END IF;
  END IF;
  RETURN NEW;
END $$;