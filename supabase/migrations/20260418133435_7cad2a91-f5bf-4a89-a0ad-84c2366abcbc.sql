create table public.interview_contexts (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Interview',
  context text not null default '',
  hypothesis text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.interview_contexts enable row level security;

-- Open policies: hardcoded admin login, no real auth yet.
create policy "anyone can read contexts"
  on public.interview_contexts for select
  using (true);

create policy "anyone can insert contexts"
  on public.interview_contexts for insert
  with check (true);

create policy "anyone can update contexts"
  on public.interview_contexts for update
  using (true) with check (true);

create policy "anyone can delete contexts"
  on public.interview_contexts for delete
  using (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger interview_contexts_set_updated_at
before update on public.interview_contexts
for each row execute function public.set_updated_at();