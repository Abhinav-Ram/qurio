-- 1. Add owner column (nullable for now so backfill works)
alter table public.interview_contexts
  add column if not exists owner_id uuid;

-- 2. Create admin user if missing, then backfill
do $$
declare
  admin_uid uuid;
begin
  select id into admin_uid from auth.users
    where email = 'admin@users.invalid' limit 1;

  if admin_uid is null then
    admin_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    )
    values (
      admin_uid, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'admin@users.invalid',
      crypt('admin', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('username','admin'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      created_at, updated_at, last_sign_in_at
    )
    values (
      gen_random_uuid(), admin_uid,
      jsonb_build_object('sub', admin_uid::text, 'email', 'admin@users.invalid'),
      'email', admin_uid::text, now(), now(), now()
    );
    insert into public.profiles (user_id, username, email)
      values (admin_uid, 'admin', 'admin@users.invalid')
      on conflict (user_id) do nothing;
  end if;

  -- Backfill every ownerless context to admin
  update public.interview_contexts
    set owner_id = admin_uid
    where owner_id is null;
end $$;

-- 3. Lock owner_id down
alter table public.interview_contexts
  alter column owner_id set not null;

create index if not exists interview_contexts_owner_id_idx
  on public.interview_contexts(owner_id);

-- 4. Auto-assign owner_id on insert if the client didn't set it
create or replace function public.set_interview_context_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_owner_on_interview_context on public.interview_contexts;
create trigger set_owner_on_interview_context
  before insert on public.interview_contexts
  for each row execute function public.set_interview_context_owner();

-- 5. Reset RLS policies on interview_contexts
drop policy if exists "anyone can read contexts"    on public.interview_contexts;
drop policy if exists "anyone can insert contexts"  on public.interview_contexts;
drop policy if exists "anyone can update contexts"  on public.interview_contexts;
drop policy if exists "anyone can delete contexts"  on public.interview_contexts;

-- Owners (signed-in users) can fully manage their own contexts
create policy "owners can read contexts"
  on public.interview_contexts for select
  to authenticated using (auth.uid() = owner_id);

create policy "owners can insert contexts"
  on public.interview_contexts for insert
  to authenticated with check (auth.uid() = owner_id);

create policy "owners can update contexts"
  on public.interview_contexts for update
  to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "owners can delete contexts"
  on public.interview_contexts for delete
  to authenticated using (auth.uid() = owner_id);

-- Anyone (anon + authenticated) can read a context that has a share_slug.
-- This powers the public /i/$slug respondent page.
create policy "public can read shared contexts"
  on public.interview_contexts for select
  to anon, authenticated
  using (share_slug is not null);

-- 6. Reset RLS on interview_questions (scoped via parent context)
drop policy if exists "anyone can read questions"    on public.interview_questions;
drop policy if exists "anyone can insert questions"  on public.interview_questions;
drop policy if exists "anyone can update questions"  on public.interview_questions;
drop policy if exists "anyone can delete questions"  on public.interview_questions;

create policy "owners can manage questions"
  on public.interview_questions for all
  to authenticated
  using (
    exists (
      select 1 from public.interview_contexts c
      where c.id = interview_questions.context_id
        and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interview_contexts c
      where c.id = interview_questions.context_id
        and c.owner_id = auth.uid()
    )
  );

-- Public can read questions for a shared context (respondent flow)
create policy "public can read questions for shared contexts"
  on public.interview_questions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.interview_contexts c
      where c.id = interview_questions.context_id
        and c.share_slug is not null
    )
  );

-- 7. Reset RLS on interview_responses
drop policy if exists "anyone can read responses"    on public.interview_responses;
drop policy if exists "anyone can insert responses"  on public.interview_responses;
drop policy if exists "anyone can delete responses"  on public.interview_responses;

-- Owners read/delete responses for their own contexts
create policy "owners can read responses"
  on public.interview_responses for select
  to authenticated
  using (
    exists (
      select 1 from public.interview_contexts c
      where c.id = interview_responses.context_id
        and c.owner_id = auth.uid()
    )
  );

create policy "owners can delete responses"
  on public.interview_responses for delete
  to authenticated
  using (
    exists (
      select 1 from public.interview_contexts c
      where c.id = interview_responses.context_id
        and c.owner_id = auth.uid()
    )
  );

-- Anyone can submit a response to a shared context
create policy "anyone can submit responses to shared contexts"
  on public.interview_responses for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.interview_contexts c
      where c.id = interview_responses.context_id
        and c.share_slug is not null
    )
  );