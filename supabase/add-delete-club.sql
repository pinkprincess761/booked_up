-- Lets the owner of a club delete it (and everything in it) for everyone.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run once.
drop policy if exists "clubs: owner deletes" on clubs;
create policy "clubs: owner deletes" on clubs for delete using (owner = auth.uid());
