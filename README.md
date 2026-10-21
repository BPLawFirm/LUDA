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
