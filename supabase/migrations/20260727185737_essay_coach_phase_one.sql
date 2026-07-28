-- EssayCoach, phase 1: accounts, essays, versions and coaching feedback.
-- Apply with: npm run db:push -- --yes

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  full_name text,
  locale text not null default 'ru' check (locale in ('ru', 'kz', 'en')),
  target_schools text[] not null default '{}',
  application_type text,
  created_at timestamptz not null default now()
);

create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  school text not null,
  program text,
  prompt_text text not null,
  word_limit_min integer,
  word_limit_max integer,
  deadline date,
  academic_year text not null default '2026-2027',
  source_url text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  prompt_id uuid references public.prompts (id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  essay_type text not null default 'personal_statement'
    check (essay_type in ('personal_statement', 'supplemental', 'scholarship', 'grant')),
  target_school text,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'final', 'submitted')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.essay_versions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  content text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.essays
  add constraint essays_current_version_id_fkey
  foreign key (current_version_id) references public.essay_versions (id) on delete set null;

create table public.feedback_logs (
  id uuid primary key default gen_random_uuid(),
  essay_version_id uuid not null references public.essay_versions (id) on delete cascade,
  feedback jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_prompts_school on public.prompts (school);
create index idx_essays_user on public.essays (user_id);
create index idx_versions_essay on public.essay_versions (essay_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.users (id, email, full_name)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', '')
from auth.users
on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_essays_updated_at
  before update on public.essays
  for each row execute procedure public.set_updated_at();

alter table public.users enable row level security;
alter table public.prompts enable row level security;
alter table public.essays enable row level security;
alter table public.essay_versions enable row level security;
alter table public.feedback_logs enable row level security;

grant usage on schema public to authenticated;
grant select, update on public.users to authenticated;
grant select on public.prompts to authenticated;
grant select, insert, update, delete on public.essays to authenticated;
grant select, insert, update, delete on public.essay_versions to authenticated;
grant select, insert, update, delete on public.feedback_logs to authenticated;

create policy "users read their profile"
  on public.users for select using (auth.uid() = id);
create policy "users update their profile"
  on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "authenticated users read prompts"
  on public.prompts for select using (auth.role() = 'authenticated');

create policy "users read own essays"
  on public.essays for select using (auth.uid() = user_id);
create policy "users create own essays"
  on public.essays for insert with check (auth.uid() = user_id);
create policy "users update own essays"
  on public.essays for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own essays"
  on public.essays for delete using (auth.uid() = user_id);

create policy "users read own essay versions"
  on public.essay_versions for select
  using (exists (
    select 1 from public.essays where essays.id = essay_versions.essay_id and essays.user_id = auth.uid()
  ));
create policy "users create own essay versions"
  on public.essay_versions for insert
  with check (exists (
    select 1 from public.essays where essays.id = essay_versions.essay_id and essays.user_id = auth.uid()
  ));

create policy "users read own feedback"
  on public.feedback_logs for select
  using (exists (
    select 1 from public.essay_versions
    join public.essays on essays.id = essay_versions.essay_id
    where essay_versions.id = feedback_logs.essay_version_id and essays.user_id = auth.uid()
  ));
create policy "users create own feedback"
  on public.feedback_logs for insert
  with check (exists (
    select 1 from public.essay_versions
    join public.essays on essays.id = essay_versions.essay_id
    where essay_versions.id = feedback_logs.essay_version_id and essays.user_id = auth.uid()
  ));
