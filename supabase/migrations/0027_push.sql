-- ============================================================
-- 0027 — Notifications sur le téléphone, et l'interrupteur.
--
-- L'email prévient les absents, la pastille prévient les présents.
-- Manquait le cas le plus fréquent : le téléphone dans la poche,
-- le site fermé. C'est ce que fait une notification push.
--
-- Un abonnement push est lié à un appareil, pas à une personne :
-- quelqu'un qui utilise son téléphone et son ordinateur en a deux.
-- La table les stocke donc par (personne, endpoint), et l'interrupteur
-- du profil vaut appareil par appareil — activer sur le téléphone
-- n'allume pas l'ordinateur, et c'est le comportement attendu.
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  -- L'URL fournie par le navigateur : c'est elle qui identifie l'appareil.
  endpoint   text not null check (char_length(endpoint) between 10 and 1000),
  p256dh     text not null,
  auth       text not null,
  -- Purement indicatif, pour que quelqu'un reconnaisse ses appareils.
  appareil   text,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);

-- Un navigateur peut réémettre le même endpoint : on remplace plutôt
-- que d'empiler, sinon la même personne recevrait n notifications.
create unique index if not exists uq_push_endpoint on public.push_subscriptions (endpoint);
create index if not exists idx_push_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Chacun ne voit et ne gère que ses propres appareils. Pas de lecture
-- croisée possible : un endpoint est une adresse d'envoi, le connaître
-- suffirait à pousser des notifications à quelqu'un d'autre.
drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (user_id, endpoint, p256dh, auth, appareil) on public.push_subscriptions to authenticated;
grant update (endpoint, p256dh, auth, appareil) on public.push_subscriptions to authenticated;

-- ---------- Ce que le serveur d'envoi peut lire ----------

-- Réservée à la clé de service, comme destinataire_a_prevenir. Elle rend
-- les appareils d'une personne, et seulement si elle n'a pas coupé les
-- notifications — la préférence est vérifiée ici, pas côté serveur web,
-- pour qu'il n'y ait qu'un seul endroit où la règle vit.
create or replace function public.appareils_a_notifier(p_user_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce((select p.notify_push from public.profiles p where p.id = p_user_id), true) then
    return;
  end if;
  return query
    select s.id, s.endpoint, s.p256dh, s.auth
      from public.push_subscriptions s
     where s.user_id = p_user_id;
end $$;

-- Un endpoint refusé par le service de push (appareil réinitialisé,
-- application désinstallée) ne se répare pas : il se supprime, sinon
-- chaque envoi ultérieur repart pour rien.
create or replace function public.oublier_appareil(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where id = p_id;
$$;

alter table public.profiles
  add column if not exists notify_push boolean not null default true;

grant select (notify_push) on public.profiles to anon, authenticated;
grant update (notify_push) on public.profiles to authenticated;

revoke all on function public.appareils_a_notifier(uuid) from public, anon, authenticated;
revoke all on function public.oublier_appareil(uuid)     from public, anon, authenticated;

-- Vérification : doit renvoyer 0 ligne tant qu'aucun appareil n'est inscrit.
-- select count(*) from public.push_subscriptions;
