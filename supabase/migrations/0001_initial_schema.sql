create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table public.challenge_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  type text not null,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.challenge_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  challenge_id uuid not null references public.challenge_definitions(id),
  raw_response jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.talent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  dimension_scores jsonb not null default '{}'::jsonb,
  summary_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.future_paths (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  paths jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sessions_user_id_started_at_idx
  on public.sessions(user_id, started_at desc);
create index challenge_responses_session_id_idx
  on public.challenge_responses(session_id);
create index user_events_user_id_created_at_idx
  on public.user_events(user_id, created_at desc);
create index user_events_session_id_created_at_idx
  on public.user_events(session_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger challenge_definitions_set_updated_at
before update on public.challenge_definitions
for each row execute function public.set_updated_at();

create trigger challenge_responses_set_updated_at
before update on public.challenge_responses
for each row execute function public.set_updated_at();

create trigger talent_profiles_set_updated_at
before update on public.talent_profiles
for each row execute function public.set_updated_at();

create trigger future_paths_set_updated_at
before update on public.future_paths
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(excluded.display_name, public.users.display_name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.challenge_definitions enable row level security;
alter table public.challenge_responses enable row level security;
alter table public.talent_profiles enable row level security;
alter table public.future_paths enable row level security;
alter table public.user_events enable row level security;

create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Users can manage own sessions"
  on public.sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Authenticated users can read active challenges"
  on public.challenge_definitions for select
  to authenticated
  using (active = true);

create policy "Users can manage own challenge responses"
  on public.challenge_responses for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can manage own talent profiles"
  on public.talent_profiles for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can manage own future paths"
  on public.future_paths for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users can read own events"
  on public.user_events for select
  using (user_id = auth.uid());

create policy "Users can append own events"
  on public.user_events for insert
  with check (
    user_id = auth.uid()
    and (
      session_id is null
      or exists (
        select 1
        from public.sessions s
        where s.id = session_id
          and s.user_id = auth.uid()
      )
    )
  );

insert into public.challenge_definitions (slug, title, type, sort_order, config)
values
  (
    'scarce-resources',
    'Scarce Resources',
    'decision_tree',
    10,
    '{
      "prompt": "You have one weekend, three people depending on you, and a stalled project. What do you do first?",
      "options": [
        {"id": "align", "label": "Align everyone on the real constraint"},
        {"id": "prototype", "label": "Build a rough version immediately"},
        {"id": "delegate", "label": "Split the work and create checkpoints"}
      ]
    }'::jsonb
  ),
  (
    'ambiguous-opportunity',
    'Ambiguous Opportunity',
    'ranked_choice',
    20,
    '{
      "prompt": "A promising opportunity has unclear upside and social risk. Rank your first three moves.",
      "moves": ["Ask sharper questions", "Test quietly", "Bring in allies", "Wait for proof", "Make a visible bet"]
    }'::jsonb
  );
