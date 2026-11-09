-- Booked Up database (version 2). Paste this whole file into Supabase > SQL Editor > New query, then Run.
-- It replaces the first version: it drops the old club tables (they were empty) and recreates them.

drop table if exists club_docs, wraps, history, discussed, messages, notes, wishlist, votes, suggestions, rsvps, meetings, members, clubs cascade;
drop function if exists finish_wrap(uuid, int, jsonb, timestamptz, text, text, boolean);
drop function if exists is_member(uuid);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text default '',
  phone text default '',
  color text default '',
  photo text default '',
  created_at timestamptz default now()
);

-- a club: who belongs, plus one shared document holding everything else
create table clubs (
  id text primary key,
  name text not null,
  invite_code text unique not null,
  owner uuid references profiles(id),
  created_at timestamptz default now()
);

create table members (
  club_id text references clubs(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (club_id, user_id)
);

create or replace function is_member(cid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where club_id = cid and user_id = auth.uid());
$$;

-- the club's meetings, list, votes, notes, chat and history, as one document.
-- rev goes up by one on every save so two people saving at once can be merged, not overwritten.
create table club_docs (
  club_id text primary key references clubs(id) on delete cascade,
  doc jsonb not null default '{}'::jsonb,
  rev int not null default 1,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
alter table clubs enable row level security;
alter table members enable row level security;
alter table club_docs enable row level security;

drop policy if exists "profiles readable by signed-in users" on profiles;
drop policy if exists "edit own profile" on profiles;
create policy "profiles readable by signed-in users" on profiles for select using (auth.uid() is not null);
create policy "edit own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy "clubs: members read" on clubs for select using (is_member(id) or owner = auth.uid());
create policy "clubs: create as yourself" on clubs for insert with check (owner = auth.uid());
create policy "clubs: owner updates" on clubs for update using (owner = auth.uid());
create policy "clubs: owner deletes" on clubs for delete using (owner = auth.uid());

create policy "members: see members of your clubs" on members for select using (is_member(club_id) or user_id = auth.uid());
create policy "members: the owner adds themselves" on members for insert
  with check (user_id = auth.uid() and exists (select 1 from clubs where id = club_id and owner = auth.uid()));
create policy "members: leave" on members for delete using (user_id = auth.uid());

create policy "docs: members read" on club_docs for select using (is_member(club_id));
create policy "docs: owner creates" on club_docs for insert
  with check (exists (select 1 from clubs where id = club_id and owner = auth.uid()));
create policy "docs: members update" on club_docs for update using (is_member(club_id)) with check (is_member(club_id));

-- joining with an invite code (the code is the only way in)
create or replace function join_club(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare cid text;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select id into cid from clubs where upper(invite_code) = upper(trim(p_code));
  if cid is null then raise exception 'no club with that code'; end if;
  insert into members (club_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

-- make a profile row when someone signs up
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email) values (new.id, coalesce(new.email, '')) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- live updates when a club's document changes
alter publication supabase_realtime add table club_docs;

-- make the API pick up the new tables and functions right away
notify pgrst, 'reload schema';
