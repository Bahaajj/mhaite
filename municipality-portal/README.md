# Municipality Portal — starter project

A responsive Arabic RTL municipality website inspired by common features on the Ras El Matn Municipality website. This is a fresh implementation, not a copy of their source code, branding, photos, or private systems.

## Included

- Arabic RTL landing page, news section, services, contact details.
- Citizen service-request form and complaint/suggestion form.
- Optional PDF/JPG/PNG attachments (5 MB max each).
- Contact-message form.
- Supabase database and private file storage integration.
- Staff login, inbox for submissions/messages, status updates, and basic news publishing.
- Responsive layout for phones, tablets, and computers.

## Tech and cost

- HTML, CSS, vanilla JavaScript.
- Supabase for database, authentication, and file storage.
- Static hosting on Vercel or Netlify.
- These services have free tiers, but quotas and terms can change. Check current limits before launching. A free tier is not a guarantee of unlimited storage, traffic, or availability.

## Setup

1. Create a Supabase project at https://supabase.com/.
2. In Supabase, open **SQL Editor**, create a query, paste all of `supabase-setup.sql`, and run it.
3. Open **Project Settings → API** and copy the Project URL and anon/public key. Never put a `service_role` key in frontend code.
4. In `app.js` and `admin.js`, replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with those two public values.
5. Edit `SITE_CONFIG` in `app.js`: municipality name, address, phone, email. Replace placeholder contact details in the HTML if needed.
6. In Supabase **Authentication → Users**, create a staff account with a strong password. Copy its UUID.
7. In SQL Editor, run this after replacing the example UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('REPLACE-WITH-AUTH-USER-UUID');
   ```

8. Open `admin.html` and sign in using that staff account. Do not expose staff passwords or create public sign-up on the admin page.
9. Deploy the folder as a static site on Vercel or Netlify. For a real public launch, connect a custom domain, enable HTTPS, configure backups, and test every form and admin permission.

## Important launch checks

- **Attachments policy:** The starter permits anonymous uploads only into the private `request-files` bucket, with a 5 MB bucket limit and MIME type allowlist. Add rate limiting / abuse prevention (e.g. CAPTCHA or an edge function) before a public launch, and periodically clean up abandoned uploads.
- **Spam protection:** Public forms can be spammed. Add CAPTCHA or a server-side/edge-function rate limit before publishing the URL widely.
- **Privacy:** Requests and messages contain personal information. Only staff accounts added to `admin_users` can read them. Decide a retention policy, publish a privacy notice, use strong staff passwords/MFA, and limit staff access.
- **Email notifications:** This starter stores submissions in Supabase; it does not yet email staff or citizens. Add an Edge Function plus an email provider if email alerts are needed. Do not put email-provider secrets in frontend JS.
- **Tracking by reference number:** A reference number is generated, but there is no public tracking page yet. Add one only with a safe verification method so visitors cannot see another citizen's personal data.
- **Municipal approvals:** A submitted online form is not a permit or approval. Confirm the municipality's required documents, procedures, fees, and legal wording before using this for official transactions.
- **Test before launch:** Verify anonymous visitors can insert but cannot read submissions; a non-admin account cannot read admin data; and a listed admin can review submissions and update statuses.

## Folder map

- `index.html` — public-facing website and forms.
- `style.css` — visual styling and responsive layout.
- `app.js` — Supabase client and citizen forms.
- `admin.html` / `admin.js` — staff dashboard.
- `supabase-setup.sql` — tables, RLS policies, and private storage bucket.
