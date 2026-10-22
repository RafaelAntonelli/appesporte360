GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);