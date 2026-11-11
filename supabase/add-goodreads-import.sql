-- Lets you import your Goodreads export file from inside the app.
-- Paste into Supabase > SQL Editor > New query, then Run. Run add-goodreads.sql first.
drop policy if exists "goodreads ratings: owner writes" on goodreads_ratings;
create policy "goodreads ratings: owner writes" on goodreads_ratings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "goodreads link: owner writes" on goodreads_links;
create policy "goodreads link: owner writes" on goodreads_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());
notify pgrst, 'reload schema';
