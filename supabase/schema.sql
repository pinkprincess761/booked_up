-- Booked Up database. Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- Safe to run once on a fresh project.

create extension if not exists pgcrypto;

-- people ---------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text default '',
  phone text default '',
  color text default '',
  photo text default '',
  notif jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- clubs ----------------------------------------------------------------
create table if not exists clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  theme_key int not null default 0,
  book jsonb,                         -- the book the club is reading now
  up_next jsonb,                      -- the picked next book, if any
  defaults jsonb default '{}'::jsonb, -- usual time / place
  invite_code text unique default substr(md5(random()::text), 1, 8),
  owner uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists members (
  club_id uuid references clubs(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text default 'member',
  joined_at timestamptz default now(),
  primary key (club_id, user_id)
);

create or replace function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where club_id = cid and user_id = auth.uid());
$$;

-- meetings -------------------------------------------------------------
create table if not exists meetings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  starts_at timestamptz not null,
  place text default 'TBD',
  address text default '',
  note text default '',
  book jsonb,                         -- book for this meeting (null = club's current book)
  table_items jsonb default '[]'::jsonb, -- [{name, food}]
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists rsvps (
  meeting_id uuid references meetings(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  status text not null check (status in ('yes', 'no')),
  primary key (meeting_id, user_id)
);

-- the list, votes, notes, chat -------------------------------------------
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  book jsonb not null,
  by_user uuid references profiles(id),
  created_at timestamptz default now()
);
create table if not exists votes (
  suggestion_id uuid references suggestions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  primary key (suggestion_id, user_id)
);
create table if not exists wishlist (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  book jsonb not null,
  created_at timestamptz default now()
);
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  author uuid references profiles(id),
  kind text not null check (kind in ('note', 'quote')),
  body text not null,
  page int,
  created_at timestamptz default now()
);
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  author uuid references profiles(id),
  body text not null,
  created_at timestamptz default now()
);
create table if not exists discussed (
  club_id uuid references clubs(id) on delete cascade,
  question text,
  primary key (club_id, question)
);

-- previous meetings ----------------------------------------------------
create table if not exists history (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  book jsonb not null,
  met_at timestamptz not null,
  place text default '',
  note text default '',
  going uuid[] default '{}',
  table_items jsonb default '[]'::jsonb,
  quotes jsonb default '[]'::jsonb,
  notes jsonb default '[]'::jsonb,
  discussed jsonb default '[]'::jsonb,
  ratings jsonb default '{}'::jsonb,   -- { user_id: 1..5 }
  created_at timestamptz default now()
);

-- the shared wrap-up: first person to finish sets the next book and meeting;
-- everyone else just rates. -----------------------------------------------
create table if not exists wraps (
  meeting_id uuid primary key references meetings(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  next_book jsonb,
  next_at timestamptz,
  next_place text default '',
  next_address text default '',
  later boolean default false,
  status text not null default 'draft' check (status in ('draft', 'done')),
  history_id uuid references history(id),
  set_by uuid references profiles(id),
  updated_at timestamptz default now()
);

-- finish_wrap: one call, runs as a single transaction. ---------------------
-- If the wrap-up is already done it only records this person's rating.
create or replace function finish_wrap(
  p_meeting uuid, p_rating int, p_next_book jsonb, p_next_at timestamptz,
  p_place text, p_address text, p_later boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m meetings%rowtype; w wraps%rowtype; hid uuid; first_done boolean := false;
begin
  select * into m from meetings where id = p_meeting for update;   -- the lock that stops double-wraps
  if not found or not is_member(m.club_id) then raise exception 'not allowed'; end if;

  insert into wraps (meeting_id, club_id) values (p_meeting, m.club_id) on conflict do nothing;
  select * into w from wraps where meeting_id = p_meeting for update;

  if w.status = 'done' then
    hid := w.history_id;
  else
    first_done := true;
    insert into history (club_id, book, met_at, place, note, going, table_items, quotes, notes, discussed)
    select m.club_id, coalesce(m.book, c.book), m.starts_at, m.place, m.note,
           coalesce((select array_agg(user_id) from rsvps where meeting_id = m.id and status = 'yes'), '{}'),
           m.table_items,
           coalesce((select jsonb_agg(jsonb_build_object('author', author, 'text', body, 'page', page)) from notes where club_id = m.club_id and kind = 'quote'), '[]'),
           coalesce((select jsonb_agg(jsonb_build_object('author', author, 'text', body, 'page', page)) from notes where club_id = m.club_id and kind = 'note'), '[]'),
           coalesce((select jsonb_agg(question) from discussed where club_id = m.club_id), '[]')
    from clubs c where c.id = m.club_id
    returning id into hid;

    delete from notes where club_id = m.club_id;
    delete from discussed where club_id = m.club_id;
    update clubs set book = p_next_book, up_next = null where id = m.club_id;
    delete from suggestions where club_id = m.club_id and lower(book->>'title') = lower(p_next_book->>'title');
    delete from wishlist where club_id = m.club_id and lower(book->>'title') = lower(p_next_book->>'title');
    delete from meetings where id = m.id;
    if not p_later and p_next_at is not null then
      insert into meetings (club_id, starts_at, place, address, created_by)
      values (m.club_id, p_next_at, coalesce(nullif(p_place, ''), 'TBD'), coalesce(p_address, ''), auth.uid());
    end if;
    update wraps set status = 'done', history_id = hid, next_book = p_next_book, next_at = p_next_at,
      next_place = p_place, next_address = p_address, later = p_later, set_by = auth.uid(), updated_at = now()
    where meeting_id = p_meeting;
  end if;

  if p_rating between 1 and 5 then
    update history set ratings = ratings || jsonb_build_object(auth.uid()::text, p_rating) where id = hid;
  end if;
  return jsonb_build_object('first', first_done, 'history_id', hid);
end $$;

-- who can see and change what -------------------------------------------
alter table profiles enable row level security;
alter table clubs enable row level security;
alter table members enable row level security;
alter table meetings enable row level security;
alter table rsvps enable row level security;
alter table suggestions enable row level security;
alter table votes enable row level security;
alter table wishlist enable row level security;
alter table notes enable row level security;
alter table messages enable row level security;
alter table discussed enable row level security;
alter table history enable row level security;
alter table wraps enable row level security;

create policy "profiles readable by signed-in users" on profiles for select using (auth.uid() is not null);
create policy "edit own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "clubs: members read" on clubs for select using (is_member(id) or owner = auth.uid());
create policy "clubs: anyone signed in can create" on clubs for insert with check (owner = auth.uid());
create policy "clubs: members update" on clubs for update using (is_member(id));

create policy "members: see your clubs' members" on members for select using (is_member(club_id) or user_id = auth.uid());
create policy "members: join as yourself" on members for insert with check (user_id = auth.uid());
create policy "members: leave" on members for delete using (user_id = auth.uid());

-- these tables all follow the same rule: members of the club can read and write
do $$ declare t text; begin
  foreach t in array array['meetings','suggestions','wishlist','notes','messages','discussed','history','wraps'] loop
    execute format('create policy "%1$s: members all" on %1$s for all using (is_member(club_id)) with check (is_member(club_id))', t);
  end loop;
end $$;

create policy "rsvps: members read" on rsvps for select using (is_member((select club_id from meetings where id = meeting_id)));
create policy "rsvps: set your own" on rsvps for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "votes: members read" on votes for select using (is_member((select club_id from suggestions where id = suggestion_id)));
create policy "votes: set your own" on votes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- create a profile row automatically when someone signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, coalesce(new.email, '')) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- live updates for the tables people watch
alter publication supabase_realtime add table messages, meetings, rsvps, suggestions, votes, wraps, notes;
