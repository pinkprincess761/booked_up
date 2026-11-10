-- Goodreads sync: where your feed link and your ratings are kept.
-- Paste into Supabase > SQL Editor > New query, then Run. Safe to run once.

-- your private Goodreads feed link (it contains a key, so only you can read it)
create table if not exists goodreads_links (
  user_id uuid primary key references profiles(id) on delete cascade,
  feed_url text not null,
  last_synced timestamptz,
  last_error text
);
alter table goodreads_links enable row level security;
drop policy if exists "goodreads link: owner reads" on goodreads_links;
create policy "goodreads link: owner reads" on goodreads_links for select using (user_id = auth.uid());
-- (the sync-goodreads function writes it with the service key)

-- your ratings and shelves, copied from the feed
create table if not exists goodreads_ratings (
  user_id uuid references profiles(id) on delete cascade,
  book_id text,
  title text,
  author text,
  isbn13 text,
  rating int default 0,
  shelf text,
  read_at date,
  pages int,
  avg_rating numeric,
  updated_at timestamptz default now(),
  primary key (user_id, book_id)
);
alter table goodreads_ratings enable row level security;
drop policy if exists "goodreads ratings: owner reads" on goodreads_ratings;
create policy "goodreads ratings: owner reads" on goodreads_ratings for select using (user_id = auth.uid());

notify pgrst, 'reload schema';
