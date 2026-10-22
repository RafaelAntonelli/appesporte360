ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_path text;

CREATE POLICY fotos_equipe_select_propria ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-equipe' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_equipe_insert_propria ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-equipe' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_equipe_update_propria ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-equipe' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY fotos_equipe_delete_propria ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-equipe' AND (storage.foldername(name))[1] = auth.uid()::text);