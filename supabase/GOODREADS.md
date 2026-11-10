# Goodreads sync setup

Booked Up copies your Goodreads ratings from your personal Goodreads RSS feed and keeps them up to date on its own.
Goodreads closed its official API in 2020, so this uses the feed Goodreads still gives every member. It is unofficial and Goodreads could change it.

## 1. Add the tables
Supabase > SQL Editor > New query, paste `supabase/add-goodreads.sql`, Run.

## 2. Deploy the function
Supabase > Edge Functions > Deploy a new function, name it exactly `sync-goodreads`, paste `supabase/functions/sync-goodreads/index.ts`, Deploy.
It needs no secrets of its own (Supabase supplies the keys it uses).

## 3. Connect in the app
1. On Goodreads open My Books, scroll to the bottom left and click the orange RSS link.
2. Copy the address of the page it opens.
3. In Booked Up open Settings > Goodreads, paste it, and tap Connect Goodreads.

Your ratings show on book pages and past meetings, and Browse recommendations use them.
The app re-syncs when you open it (at most every 6 hours). Sync now forces a refresh.

## Notes
- The link holds a private key. Only you can read it in the database.
- Disconnect deletes your copied ratings and the link.
- If Goodreads stops serving the feed, export your library as a CSV from Goodreads (My Books > Import and export) as a fallback.
