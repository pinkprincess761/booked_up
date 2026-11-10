-- Keeps track of who has been texted an invite, so nobody is texted twice for the same club.
-- Paste into Supabase > SQL Editor > New query, then Run.
create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  club_id text not null references clubs(id) on delete cascade,
  phone text not null,
  invited_by uuid references profiles(id),
  created_at timestamptz default now(),
  unique (club_id, phone)
);
alter table invites enable row level security;
drop policy if exists "invites: members read" on invites;
create policy "invites: members read" on invites for select using (is_member(club_id));
-- (rows are written only by the send-invite function, which runs with the service key)
notify pgrst, 'reload schema';
