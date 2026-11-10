// Sends the invite text for a Booked Up club through Twilio.
// Deploy as an Edge Function named "send-invite" (see supabase/INVITE-TEXTS.md).
//
// Secrets it needs (Supabase > Project Settings > Edge Functions > Secrets):
//   TWILIO_ACCOUNT_SID       starts with AC
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM              your Twilio phone number, like +14155550123   (or use TWILIO_MESSAGING_SERVICE_SID)
//   APP_URL                  the address people open the app at, like https://yourname.github.io/booked_up/
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_FROM");
    const msgService = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");
    const appUrl = Deno.env.get("APP_URL");
    if (!sid || !token || (!from && !msgService) || !appUrl) return json({ error: "Texting is not set up yet (missing secrets)" }, 500);

    // who is asking
    const userClient = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Sign in first" }, 401);
    const uid = u.user.id;

    const { club_id, phone } = await req.json();
    if (typeof club_id !== "string" || typeof phone !== "string" || !/^\+[1-9]\d{7,14}$/.test(phone)) return json({ error: "Bad request" }, 400);

    // only members of the club can invite to it
    const { data: mem } = await userClient.from("members").select("club_id").eq("club_id", club_id).eq("user_id", uid).maybeSingle();
    if (!mem) return json({ error: "You are not in that club" }, 403);

    const admin = createClient(url, service);

    // at most 20 invite texts per person per hour
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin.from("invites").select("id", { count: "exact", head: true }).eq("invited_by", uid).gte("created_at", since);
    if ((count ?? 0) >= 20) return json({ error: "Too many invites. Try again in a while." }, 429);

    // each number is texted once per club
    const { error: dup } = await admin.from("invites").insert({ club_id, phone, invited_by: uid });
    if (dup) return json({ ok: true, already: true });

    const { data: club } = await admin.from("clubs").select("name, invite_code").eq("id", club_id).single();
    const { data: me } = await admin.from("profiles").select("name").eq("id", uid).single();
    const who = (me?.name || "A friend").trim();
    const link = `${appUrl.replace(/\/?$/, "/")}#/join/${club!.invite_code}`;
    const body = `${who} invited you to ${club!.name} on Booked Up. Tap to join: ${link}`;

    const form = new URLSearchParams({ To: phone, Body: body });
    if (msgService) form.set("MessagingServiceSid", msgService); else form.set("From", from!);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: "Basic " + btoa(`${sid}:${token}`), "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      await admin.from("invites").delete().eq("club_id", club_id).eq("phone", phone);   // let them try again
      return json({ error: "Twilio would not send the text", detail: t?.message ?? res.status, code: t?.code }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
