-- EssayCoach: semantic overlap checks, mock interviews and reader personas.

create extension if not exists vector with schema extensions;

alter table public.essay_versions
  add column if not exists embedding extensions.vector(1024);

create table public.interview_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references public.essays (id) on delete cascade,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  answers jsonb check (answers is null or jsonb_typeof(answers) = 'array'),
  feedback jsonb check (feedback is null or jsonb_typeof(feedback) = 'array'),
  created_at timestamptz not null default now()
);

create index idx_interview_sessions_essay
  on public.interview_practice_sessions (essay_id, created_at desc);

create or replace function public.find_similar_essay_versions(
  target_essay_id uuid,
  target_embedding extensions.vector(1024),
  similarity_threshold double precision default 0.75,
  match_limit integer default 5
)
returns table (
  essay_id uuid,
  title text,
  content text,
  similarity double precision
)
language sql
security invoker
set search_path = public, extensions
as $$
  select
    e.id,
    e.title,
    ev.content,
    (1 - (ev.embedding <=> target_embedding))::double precision as similarity
  from public.essays as e
  join public.essay_versions as ev on ev.id = e.current_version_id
  where e.user_id = auth.uid()
    and e.id <> target_essay_id
    and ev.embedding is not null
    and (1 - (ev.embedding <=> target_embedding)) > similarity_threshold
  order by ev.embedding <=> target_embedding
  limit greatest(match_limit, 1);
$$;

alter table public.interview_practice_sessions enable row level security;

grant select, update on public.essay_versions to authenticated;
grant select, insert, update, delete on public.interview_practice_sessions to authenticated;
grant execute on function public.find_similar_essay_versions(uuid, extensions.vector, double precision, integer) to authenticated;

create policy "users update own essay versions"
  on public.essay_versions for update
  using (exists (
    select 1 from public.essays
    where essays.id = essay_versions.essay_id and essays.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.essays
    where essays.id = essay_versions.essay_id and essays.user_id = auth.uid()
  ));

create policy "users read own interview sessions"
  on public.interview_practice_sessions for select
  using (exists (
    select 1 from public.essays
    where essays.id = interview_practice_sessions.essay_id and essays.user_id = auth.uid()
  ));

create policy "users create own interview sessions"
  on public.interview_practice_sessions for insert
  with check (exists (
    select 1 from public.essays
    where essays.id = interview_practice_sessions.essay_id and essays.user_id = auth.uid()
  ));

create policy "users update own interview sessions"
  on public.interview_practice_sessions for update
  using (exists (
    select 1 from public.essays
    where essays.id = interview_practice_sessions.essay_id and essays.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.essays
    where essays.id = interview_practice_sessions.essay_id and essays.user_id = auth.uid()
  ));

create policy "users delete own interview sessions"
  on public.interview_practice_sessions for delete
  using (exists (
    select 1 from public.essays
    where essays.id = interview_practice_sessions.essay_id and essays.user_id = auth.uid()
  ));
