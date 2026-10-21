# LUDA.AI website

Bilingual static corporate website built with Astro 6.

## Local development

```sh
npm install
npm run dev
```

Quality checks and production output:

```sh
npm run build
npm run preview
```

## Content editing

Content is stored in:

- `src/content/pages/{en,sk}` for structured pages
- `src/content/insights/{en,sk}` for Markdown articles

Pages CMS reads `.pages.yml`. Connect the GitHub repository at
[app.pagescms.org](https://app.pagescms.org/), grant access to the repository,
and edit content from that external dashboard. Every save creates a Git commit
and triggers a new Cloudflare Pages deployment.

Keep matching EN/SK articles connected with the same `translationKey`.

## Cloudflare Pages

- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: `22`
- Primary custom domain: `ludasolutions.ai`
- Also connect `www.ludasolutions.ai`, `ludasolutions.eu`, and
  `www.ludasolutions.eu`

The contact form is protected by Cloudflare Turnstile. In the Cloudflare Pages
project settings, add `TURNSTILE_SECRET` as a secret and `TURNSTILE_HOSTNAMES`
as a comma-separated variable containing only the hostnames configured on the
widget for that deployment. Production values must not include `localhost` or
`127.0.0.1`. The expected action is `contact`.

For local Pages Function development, create an ignored `.dev.vars` file in the
repository root with the widget secret and local hostnames:

```dotenv
TURNSTILE_SECRET=your-widget-secret
TURNSTILE_HOSTNAMES=localhost,127.0.0.1
```

Do not commit the real secret. Run Pages Functions through Wrangler (for
example, `npx wrangler pages dev dist`) because `npm run dev` serves Astro
without the `/api/contact` Pages Function.

### Contact email delivery

`functions/api/contact.ts` validates the form and Turnstile, then calls the
private `luda-contact-mailer` Worker via a `CONTACT_MAILER` service binding.
The Worker has no public URL or routes. Its source and deployment configuration
are in `workers/contact-mailer/`.

In both Pages projects (`luda` and `ludaeu`), configure each environment:

- `CONTACT_TO`: one email address, set in Settings > Variables and Secrets.
  The recipient is read on the server and cannot be overridden by form fields.
- `CONTACT_MAILER`: service binding to `luda-contact-mailer`, production.
- Keep the existing `TURNSTILE_SECRET` and `TURNSTILE_HOSTNAMES` settings.

The mailer's `EMAIL` binding uses Cloudflare's native email service. Its default
binding permits verified destination addresses only. Verify the desired
recipient in Cloudflare Email Routing > Destination Addresses before use.
Changing recipients requires updating `CONTACT_TO` and redeploying Pages;
changing application source is unnecessary. Configure Preview independently
and use a test recipient there.

The mailer's `CONTACT_FROM` variable defaults to `forms@ludasolutions.ai` in its
Wrangler configuration. Visitor email is used only as `Reply-To`, never as the
sender. No auto-reply is sent to visitors. DNS/MX changes are not part of the
mailer deployment.

Deploy the private Worker before redeploying the Pages projects:

```sh
npx wrangler deploy --config workers/contact-mailer/wrangler.jsonc
```

For local development, start the mailer with `wrangler dev` using the same config
and start Pages with `npx wrangler pages dev dist --service CONTACT_MAILER=luda-contact-mailer`.
Set a verified test `CONTACT_TO` in your ignored `.dev.vars` file. A local email
binding simulates sending unless configured to use a remote resource.

Run `npm run test:contact` on Node 22.18+ or 24+ to check the Pages-to-mailer
contract with a simulated provider. These tests do not establish live delivery.
Successful API responses mean the mail service acknowledged the submission;
inbox/spam placement must be checked separately. Failed delivery returns 503,
and the browser preserves the message and resets Turnstile for a retry.

Create Cloudflare Redirect Rules for the secondary domain:

1. If hostname is `ludasolutions.eu` or `www.ludasolutions.eu`
2. Redirect with HTTP 301 to `https://ludasolutions.ai/sk/`
3. Preserve the query string

Create an additional rule redirecting `www.ludasolutions.ai` to
`https://ludasolutions.ai/$1`.

## Before launch

Replace the draft contact and legal details in `src/lib/site.ts` and review both
privacy pages. The current `hello@luda.ai` address is a working-content
placeholder until the company confirms its final mailbox.

The selected design reference is stored at
`src/assets/images/clear-counsel-reference.png`.
