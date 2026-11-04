# Booked Up: make the sign-up email clear and make the link land in the app

These are settings in your Supabase dashboard (I can't change them from the code).

## 1. Where the confirmation link goes

Supabase dashboard → **Authentication → URL Configuration**

- **Site URL**: the address you open Booked Up at, for example `https://yourname.github.io/booked_up/`
  (no `localhost`, and include the trailing slash).
- **Redirect URLs**: add the same address, plus `https://yourname.github.io/booked_up/**`.

The app now asks Supabase to send people back to the exact page they signed up from. If that page is not on
the Redirect URLs list, Supabase falls back to the Site URL, so keep both set.

## 2. What the email says

Supabase dashboard → **Authentication → Emails → Confirm signup** (older dashboards: Email Templates)

**Subject**

```
Confirm your Booked Up account
```

**Body** (paste as HTML)

```html
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:440px;margin:0 auto;padding:28px 20px;color:#1f2328">
  <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#1f7f7c;margin:0 0 18px"><b>Booked Up</b> &middot; book clubs</p>
  <h1 style="font-size:26px;line-height:1.15;margin:0 0 12px">Welcome to Booked Up</h1>
  <p style="font-size:16px;line-height:1.5;margin:0 0 22px">Thanks for signing up. Tap the button to confirm your email and open the app, where your book clubs are waiting.</p>
  <p style="margin:0 0 26px"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1f2328;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:999px;font-weight:600;font-size:16px">Confirm and open Booked Up</a></p>
  <p style="font-size:13px;line-height:1.5;color:#6a7178;margin:0">If you didn't create a Booked Up account, you can ignore this email.</p>
</div>
```

## 3. Who it appears to be from

By default the email comes from "Supabase Auth". To show "Booked Up" as the sender, you need your own email
sending service (SMTP):

Supabase dashboard → **Authentication → Emails → SMTP Settings** → turn on custom SMTP.

- Free options: Resend, Brevo, or Mailgun (each has a free tier).
- **Sender name**: `Booked Up`
- **Sender email**: an address on a domain you own (for example `hello@yourdomain.com`), after verifying the domain with the provider.

Without a domain of your own, the sender will still say Supabase, but the subject and body above make it clear
the email is about Booked Up. (Supabase's built-in sender is also limited to a few emails per hour, so custom
SMTP is worth setting up before real people use the app.)
