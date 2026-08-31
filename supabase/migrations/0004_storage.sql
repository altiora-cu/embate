-- =============================================================================
-- EMBATE — Almacenamiento de capturas de resultado (§13)
-- =============================================================================
-- Restricciones del paquete de dirección: JPG/PNG/WEBP, 8 MB máximo por archivo,
-- y aislamiento por comunidad. El aislamiento es lo importante: NO existe un
-- bucket compartido sin separar por comunidad. La primera carpeta de la ruta es
-- siempre el community_id, y las políticas lo verifican contra la pertenencia real.
--
-- Convención de ruta:
--   {community_id}/{tournament_id}/{match_id}/{user_id}-{timestamp}.{ext}
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'match-screenshots',
  'match-screenshots',
  false, -- privado: se sirve con URL firmada de vida corta, no con enlace público
  8388608, -- 8 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  public = excluded.public;

-- Ver capturas: cualquier miembro de esa comunidad. Hace falta para que el rival
-- pueda revisar la captura antes de confirmar, y para que el admin resuelva disputas.
create policy "screenshots_select_members"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'match-screenshots'
    and public.is_community_member((storage.foldername(name))[1]::uuid)
  );

-- Subir: miembro de la comunidad, y el archivo debe empezar con su propio user_id.
-- Así una captura nunca puede atribuirse a otro jugador.
create policy "screenshots_insert_members"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'match-screenshots'
    and public.is_community_member((storage.foldername(name))[1]::uuid)
    and (storage.filename(name)) like auth.uid()::text || '-%'
  );

-- Borrar: solo el admin de la comunidad. Un jugador no puede hacer desaparecer
-- la prueba de un partido en disputa.
create policy "screenshots_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'match-screenshots'
    and public.is_community_admin((storage.foldername(name))[1]::uuid)
  );
