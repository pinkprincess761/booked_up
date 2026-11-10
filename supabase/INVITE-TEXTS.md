# Automatic invite texts (Twilio + a Supabase Edge Function)

When someone adds a friend's phone number while creating a club, Booked Up can text that friend a link
by itself. The friend taps it, signs in with their phone number, and lands in the club.

If this is not set up, nothing breaks: the club page still has a "Text invite" button that opens Messages
on your own phone, and it shows a small note saying the automatic text did not go out.

## 1. A Twilio phone number that can text

Your sign-in codes use a Twilio *Verify* service. That cannot send a custom message, so invites need a
normal Twilio number.

1. Twilio Console → Phone Numbers → Manage → **Buy a number** (pick one with SMS). About $1 a month.
2. **US numbers must be registered before carriers will deliver texts from them.** Without this, messages
   are blocked. Pick one:
   - **Toll-free number + toll-free verification**: simplest for a small app. Twilio walks you through a short form.
   - **Local number + A2P 10DLC registration**: more steps (brand and campaign), a one-time fee, and a wait.
3. A free Twilio **trial** account can only text numbers you have verified in Twilio, and adds a
   "Sent from your Twilio trial account" line. Add credit to the account to text anyone.

Cost: roughly 1 cent per text in the US, plus the number each month. Check Twilio's pricing page.

## 2. Create the invites table

Supabase → SQL Editor → New query → paste the contents of `supabase/add-invites.sql` → Run.
(It records who was texted, so nobody gets the same invite twice.)

## 3. Add the function

1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `send-invite`.
3. Delete the sample code and paste in everything from `supabase/functions/send-invite/index.ts`.
4. Deploy. (Leave "Verify JWT" switched on.)

## 4. Add the secrets

Supabase → Project Settings → **Edge Functions** → **Secrets** (or the Secrets button on the function page). Add:

| Name | Value |
|---|---|
| `TWILIO_ACCOUNT_SID` | your Account SID (starts with `AC`) |
| `TWILIO_AUTH_TOKEN` | your Twilio Auth Token |
| `TWILIO_FROM` | the Twilio number you bought, like `+14155550123` |
| `APP_URL` | the address people open the app at, like `https://pinkprincess761.github.io/booked_up/` |

Type the token in the Supabase page only. Do not paste it into chat or into the code.

## 5. Try it

Create a club and add a friend's phone number (with a trial account, a number you verified in Twilio).
After the club is created the friend should get a text, and their row on the club page says "Invite sent".

If it fails, the club page shows the reason in red. Common ones:

- "Texting is not set up yet (missing secrets)": one of the four secrets is missing.
- "Twilio would not send the text" with a detail: the number is not verified (trial), the From number is not
  texting-enabled, or US registration is not finished.
- A message about the function not being found: the function is not deployed, or not named `send-invite`.

## Limits built in

- Only members of a club can send invites for it.
- Each phone number is texted once per club.
- At most 20 invites per person per hour.
- The link in the text is always your `APP_URL` plus the club's code. People cannot put their own links in.
