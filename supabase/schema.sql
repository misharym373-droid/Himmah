-- ============================================================
--  مسار — مخطط قاعدة البيانات (Supabase / PostgreSQL)
--  شغّل هذا الملف مرة واحدة في Supabase SQL Editor
--  كل الجداول محمية بـ Row Level Security: كل مستخدم يرى بياناته فقط
-- ============================================================

-- ————— دالة تحديث updated_at تلقائيًا —————
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ————— الملف الشخصي —————
create table if not exists public.profiles (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  name           text not null default '' check (char_length(name) <= 80),
  email          text,
  phone          text not null default '' check (char_length(phone) <= 20),
  age            smallint check (age between 5 and 120),
  weight         numeric(5, 1) check (weight between 20 and 400),
  height         numeric(5, 1) check (height between 50 and 260),
  field          text not null default '' check (char_length(field) <= 120),
  city           text not null default '' check (char_length(city) <= 80),
  interests      text[] not null default '{}',
  personal_goals text[] not null default '{}',
  main_goal      text not null default '' check (char_length(main_goal) <= 200),
  wake_time      time not null default '07:00',
  sleep_time     time not null default '23:00',
  avatar_url     text check (avatar_url is null or char_length(avatar_url) < 400000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ————— الإعدادات (المظهر، الإشعارات، تخصيص الرئيسية...) —————
create table if not exists public.user_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  settings           jsonb not null default '{}',
  dashboard          jsonb not null default '{}',
  onboarded          boolean not null default false,
  energy             jsonb not null default '{}',
  flags              jsonb not null default '{}',
  notifications      jsonb not null default '[]',
  dismissed_insights jsonb not null default '[]',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ————— التقدم: XP، المستوى، Streak، الإنجازات —————
create table if not exists public.user_progress (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  total_xp       integer not null default 0 check (total_xp >= 0),
  xp             integer not null default 0 check (xp >= 0),
  streak         jsonb not null default '{"count":0,"best":0,"lastDate":null,"days":{}}',
  achievements   jsonb not null default '{}',
  reward_history jsonb not null default '[]',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ————— الأهداف —————
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  area          text not null default 'study',
  icon          text not null default 'target',
  deadline      date,
  months        smallint not null default 6 check (months between 1 and 24),
  milestones    jsonb not null default '[]',
  daily         jsonb not null default '[]',
  last_activity timestamptz not null default now(),
  plan          jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ————— المهام —————
-- المهام المتكررة: صف "قالب" واحد (is_template) يحمل قاعدة التكرار،
-- والتطبيق يولّد نسخ الأيام القريبة فقط (series_id) بمعرّف ثابت لكل يوم لمنع التكرار.
create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 300),
  description     text not null default '',
  notes           text not null default '',
  date            date not null,
  start_time      time,
  end_time        time,
  duration        integer not null default 30 check (duration between 1 and 1440),
  priority        text not null default 'med' check (priority in ('low', 'med', 'high', 'urgent')),
  category        text not null default 'work' check (category in ('study', 'health', 'work', 'money', 'family', 'fun')),
  icon            text not null default 'sparkles',
  completed       boolean not null default false,
  completed_at    timestamptz,
  recurring       boolean not null default false,
  recurrence_type text not null default 'none' check (recurrence_type in ('none', 'daily', 'weekly', 'monthly', 'days')),
  recurrence_days smallint[] not null default '{}',
  is_template     boolean not null default false,
  series_id       uuid,
  goal_id         uuid references public.goals (id) on delete set null,
  subtasks        jsonb not null default '[]',
  postponed       integer not null default 0 check (postponed >= 0),
  xp_awarded      integer not null default 0 check (xp_awarded >= 0),
  reminder        boolean not null default true,
  archived        boolean not null default false,
  deleted_at      timestamptz,
  source          text not null default '' check (char_length(source) <= 20),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ————— العادات —————
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  icon       text not null default 'sparkles',
  color      text not null default '#2E6B57',
  target     integer not null default 1 check (target between 1 and 100),
  unit       text not null default 'مرة',
  log        jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ————— التحديات —————
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 160),
  icon        text not null default 'flame',
  description text not null default '',
  days        integer not null default 7 check (days between 1 and 365),
  start_date  date not null default current_date,
  log         jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ————— المكافآت —————
create table if not exists public.rewards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  icon       text not null default 'gift',
  cost       integer not null check (cost between 1 and 1000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ————— المشاريع المشتركة (يملكها المستخدم الذي أنشأها) —————
create table if not exists public.projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  icon       text not null default 'folder',
  members    jsonb not null default '[]',
  tasks      jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ————— جلسات التركيز —————
create table if not exists public.focus_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  minutes    integer not null check (minutes between 0 and 1440),
  task_id    uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ————— سجل الصلاة: صف لكل يوم (في وقتها / قضاء) —————
create table if not exists public.prayer_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date       date not null,
  fajr       text check (fajr in ('ontime', 'late')),
  dhuhr      text check (dhuhr in ('ontime', 'late')),
  asr        text check (asr in ('ontime', 'late')),
  maghrib    text check (maghrib in ('ontime', 'late')),
  isha       text check (isha in ('ontime', 'late')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ————— الفهارس —————
create index if not exists tasks_user_date_idx on public.tasks (user_id, date);
create index if not exists tasks_user_template_idx on public.tasks (user_id) where is_template;
create index if not exists tasks_goal_idx on public.tasks (goal_id) where goal_id is not null;
create unique index if not exists tasks_series_date_uidx on public.tasks (series_id, date) where series_id is not null;
create index if not exists goals_user_idx on public.goals (user_id);
create index if not exists habits_user_idx on public.habits (user_id);
create index if not exists challenges_user_idx on public.challenges (user_id);
create index if not exists rewards_user_idx on public.rewards (user_id);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists focus_user_date_idx on public.focus_sessions (user_id, date);
create index if not exists focus_task_idx on public.focus_sessions (task_id) where task_id is not null;

-- ————— updated_at triggers —————
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_settings', 'user_progress', 'goals', 'tasks', 'habits', 'challenges', 'rewards', 'projects', 'prayer_log']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ————— Row Level Security: كل مستخدم يصل لصفوفه فقط —————
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_settings', 'user_progress', 'goals', 'tasks', 'habits', 'challenges', 'rewards', 'projects', 'focus_sessions', 'prayer_log']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own_select" on public.%I', t);
    execute format('drop policy if exists "own_insert" on public.%I', t);
    execute format('drop policy if exists "own_update" on public.%I', t);
    execute format('drop policy if exists "own_delete" on public.%I', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- ————— إنشاء الملف الشخصي والإعدادات تلقائيًا عند التسجيل —————
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name, email, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'name', ''), 80),
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'phone', ''), 20)
  )
  on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_progress (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- المستخدمون الموجودون مسبقًا (من تطبيقات أخرى على نفس المشروع) يحصلون على صفوفهم أيضًا
insert into public.profiles (user_id, name, email)
  select id, left(coalesce(raw_user_meta_data ->> 'name', ''), 80), email from auth.users
  on conflict (user_id) do nothing;
insert into public.user_settings (user_id) select id from auth.users on conflict (user_id) do nothing;
insert into public.user_progress (user_id) select id from auth.users on conflict (user_id) do nothing;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ————— حذف الحساب —————
-- التطبيق يحذف بيانات المستخدم في مسار جدولًا جدولًا عبر سياسات own_delete (RLS)،
-- ولا يحذف حساب الدخول لأنه قد يكون مشتركًا مع تطبيقات أخرى على نفس المشروع.

revoke all on function public.handle_new_user() from public, anon, authenticated;
