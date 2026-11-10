// Reads a person's Goodreads shelves from their RSS feed and keeps their ratings up to date.
// Deploy as an Edge Function named "sync-goodreads" (see supabase/GOODREADS.md). Needs no extra secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// only real Goodreads feed links are accepted (so this cannot be pointed at other sites)
const FEED = /^https:\/\/www\.goodreads\.com\/review\/list_rss\/\d+(\?[^#\s]*)?$/;

const decode = (t: string) =>
  t.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (s: string, t: string) => { const m = s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ""; };

export function parseFeed(xml: string) {
  const items = xml.split("<item>").slice(1).map((x) => x.split("</item>")[0]);
  return items.map((it) => {
    const read = tag(it, "user_read_at");
    const d = read ? new Date(read) : null;
    return {
      book_id: tag(it, "book_id"),
      title: tag(it, "title"),
      author: tag(it, "author_name"),
      isbn13: tag(it, "isbn13") || tag(it, "isbn"),
      rating: parseInt(tag(it, "user_rating")) || 0,
      shelf: tag(it, "user_shelves") || "",
      read_at: d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null,
      pages: parseInt(tag(it, "num_pages")) || null,
      avg_rating: parseFloat(tag(it, "average_rating")) || null,
    };
  }).filter((r) => r.book_id && r.title);
}

if (import.meta.main) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
      const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
      const { data: u } = await userClient.auth.getUser();
      if (!u?.user) return json({ error: "Sign in first" }, 401);
      const uid = u.user.id;
      const admin = createClient(url, service);
      const { action, feed } = await req.json();

      if (action === "unlink") {
        await admin.from("goodreads_ratings").delete().eq("user_id", uid);
        await admin.from("goodreads_links").delete().eq("user_id", uid);
        return json({ ok: true });
      }
      if (action === "link") {
        if (typeof feed !== "string" || !FEED.test(feed.trim())) return json({ error: "That does not look like a Goodreads RSS link" }, 400);
        await admin.from("goodreads_links").upsert({ user_id: uid, feed_url: feed.trim(), last_synced: null, last_error: null });
      }

      const { data: link } = await admin.from("goodreads_links").select("feed_url,last_synced").eq("user_id", uid).maybeSingle();
      if (!link) return json({ error: "Connect Goodreads first" }, 400);
      if (action === "sync" && link.last_synced && Date.now() - new Date(link.last_synced).getTime() < 120_000) return json({ ok: true, throttled: true });

      const base = new URL(link.feed_url);
      base.searchParams.set("shelf", "#ALL#");
      base.searchParams.set("per_page", "200");
      let all: ReturnType<typeof parseFeed> = [];
      for (let page = 1; page <= 10; page++) {
        base.searchParams.set("page", String(page));
        const res = await fetch(base.toString(), { headers: { "User-Agent": "BookedUp/1.0" } });
        if (!res.ok) { await admin.from("goodreads_links").update({ last_error: `Goodreads answered ${res.status}` }).eq("user_id", uid); return json({ error: `Goodreads answered ${res.status}. Check that the link is right and your profile allows it.` }, 502); }
        const rows = parseFeed(await res.text());
        all = all.concat(rows);
        if (rows.length < 200) break;
      }
      if (all.length) {
        const rows = all.map((r) => ({ ...r, user_id: uid, updated_at: new Date().toISOString() }));
        for (let i = 0; i < rows.length; i += 200) await admin.from("goodreads_ratings").upsert(rows.slice(i, i + 200), { onConflict: "user_id,book_id" });
      }
      await admin.from("goodreads_links").update({ last_synced: new Date().toISOString(), last_error: null }).eq("user_id", uid);
      return json({ ok: true, count: all.length, rated: all.filter((r) => r.rating > 0).length });
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e) }, 500);
    }
  });
}
