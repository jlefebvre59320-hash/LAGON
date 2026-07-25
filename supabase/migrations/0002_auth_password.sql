-- ============================================================
-- Ti Kanal — Inscription par email + mot de passe
-- Reprend le nom affiché saisi au moment de l'inscription.
-- Idempotent : peut être rejoué sur un projet où 0001 est déjà passé.
-- ============================================================

-- Le formulaire d'inscription envoie { display_name } dans les métadonnées
-- utilisateur. On le reprend ici, avec en secours la partie locale de l'email
-- (lien magique, ou compte créé avant cette migration), puis 'Utilisateur' —
-- profiles.display_name est not null.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Utilisateur'
    )
  )
  on conflict (id) do nothing;
  return new;
end; $$;
