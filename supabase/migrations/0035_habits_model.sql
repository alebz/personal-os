-- 0035_habits_model.sql
-- Proper habit model: a `habits` table (binary habit definitions) + `habit_completions`
-- (one row per habit per day). Replaces the loose daily_logs.metadata.habits.done snapshots,
-- which are kept and backfilled below. SOFT DELETE only — habits are archived, never deleted.

create table if not exists habits (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null,
  category   text        not null default 'Salud',
  icon       text        not null default '✅',
  color      text        not null default '#9B59B6',
  sort_order int         not null default 0,
  archived   boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive: evolve an already-existing habits table rather than replace it.
alter table habits add column if not exists category   text        not null default 'Salud';
alter table habits add column if not exists icon       text        not null default '✅';
alter table habits add column if not exists color      text        not null default '#9B59B6';
alter table habits add column if not exists sort_order int         not null default 0;
alter table habits add column if not exists archived   boolean     not null default false;

create table if not exists habit_completions (
  habit_id   uuid not null references habits(id) on delete cascade,
  done_date  date not null,
  created_at timestamptz not null default now(),
  primary key (habit_id, done_date)
);
create index if not exists habit_completions_date_idx on habit_completions (done_date);

-- Seed the user's current habits — only if the table is still empty.
insert into habits (name, category, icon, color, sort_order)
select v.name, v.category, v.icon, v.color, v.ord
from (values
  ('Proteína',  'Fitness', '🥤', '#e0473a', 0),
  ('Ejercicio', 'Fitness', '🏋️', '#EA4335', 1),
  ('Yoga',      'Salud',   '🧘', '#9B59B6', 2),
  ('Weed',      'Detox',   '🌿', '#34A853', 3)
) as v(name, category, icon, color, ord)
where not exists (select 1 from habits);

-- Best-effort history backfill from the legacy daily_logs snapshots. Matches a done-entry to a
-- seeded habit by accent-folded lowercase name. Habits that were custom-added carried opaque ids
-- and won't match (clean start for those); the slug-named ones keep their streaks.
insert into habit_completions (habit_id, done_date)
select h.id, dl.log_date
from daily_logs dl
cross join lateral jsonb_array_elements_text(
  case when jsonb_typeof(dl.metadata #> '{habits,done}') = 'array'
       then dl.metadata #> '{habits,done}'
       else '[]'::jsonb end
) as done(slug)
join habits h
  on translate(lower(h.name), 'áéíóúñ', 'aeioun') = lower(done.slug)
where dl.kind = 'habits'
on conflict (habit_id, done_date) do nothing;
