-- Enable case-insensitive text first (must exist before columns use it)
create extension if not exists citext;

-- 1. Profiles table
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username citext not null unique,
  email citext not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_.]{3,32}$')
);

alter table public.profiles enable row level security;

drop policy if exists "profiles select for authenticated" on public.profiles;
create policy "profiles select for authenticated"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profiles delete own" on public.profiles;
create policy "profiles delete own"
  on public.profiles for delete
  to authenticated
  using (auth.uid() = user_id);

-- updated_at trigger (uses existing public.set_updated_at)
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 2. Auto-create profile on signup using user_metadata.username
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(new.raw_user_meta_data->>'username', '');
  if uname ~ '^[A-Za-z0-9_.]{3,32}$' then
    insert into public.profiles (user_id, username, email)
    values (new.id, uname, new.email)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email synced when auth email changes
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
      set email = new.email
      where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- 3. Helper: resolve identifier (username OR email) -> email.
create or replace function public.lookup_email_by_identifier(identifier text)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  found_email text;
begin
  if identifier is null or length(trim(identifier)) = 0 then
    return null;
  end if;

  select email into found_email
    from public.profiles
    where username = identifier::citext
       or email = identifier::citext
    limit 1;

  return found_email;
end;
$$;

revoke all on function public.lookup_email_by_identifier(text) from public;
grant execute on function public.lookup_email_by_identifier(text) to anon, authenticated;

-- 4. Helper: is_username_available
create or replace function public.is_username_available(uname text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where username = uname::citext
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;