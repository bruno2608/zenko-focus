-- USERS (auth.users é gerenciado pelo Supabase)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  focus_area text,
  objectives text,
  avatar_url text,
  notifications_enabled boolean default true,
  auto_move_done boolean default true,
  pomodoro_sound boolean default true,
  theme_preference text check (theme_preference in ('light','dark')) default 'dark',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TASKS
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('todo','doing','done')) default 'todo',
  due_date date,
  start_date date,
  due_time time,
  due_reminder text,
  due_recurrence text,
  labels text[] default '{}',
  checklist jsonb default '[]',
  attachments jsonb default '[]',
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_tasks_user on tasks(user_id);

-- POMODORO SESSIONS
create table if not exists pomodoro_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references tasks(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes int not null check (duration_minutes > 0)
);
create index if not exists idx_pomo_user on pomodoro_sessions(user_id);

-- REMINDERS
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  remind_at timestamptz not null,
  sent boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_reminders_user on reminders(user_id);
create index if not exists idx_reminders_time on reminders(remind_at);

-- VIEWS PARA DASHBOARD
create or replace view v_task_counts as
select user_id,
  count(*) filter (where status='todo')   as todo,
  count(*) filter (where status='doing')  as doing,
  count(*) filter (where status='done')   as done,
  count(*)                                 as total
from tasks
group by user_id;

create or replace view v_pomodoro_today as
select user_id,
  coalesce(sum(duration_minutes),0) as minutes_today,
  count(*) as sessions_today
from pomodoro_sessions
where started_at::date = now()::date
group by user_id;

create or replace view v_reminders_today as
select user_id,
  count(*) filter (where remind_at::date = now()::date and sent=false) as active_today
from reminders
group by user_id;
