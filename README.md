# Bryant Construction Group

Static marketing site for Bryant Construction Group, built as a plain HTML/CSS/JavaScript site and deployed via GitHub Pages.

Live domain: [bryantconstructiongroup.co.uk](https://bryantconstructiongroup.co.uk)

## Stack

- HTML pages for each service and content section
- Shared styling in `styles.css`
- Shared client-side behavior in `site-20260624-3.js`
- Static assets in `assets/`
- GitHub Pages hosting with a custom domain set in `CNAME`

There is no build step, package manager, or framework in this repo. Changes are made directly in source files.

## Project Structure

```text
.
├── index.html
├── about.html
├── areas-we-cover.html
├── contact.html
├── faqs.html
├── gallery.html
├── general-building.html
├── repairs-maintenance.html
├── carpentry-joinery.html
├── decorating.html
├── plastering-finishing.html
├── quality-workmanship.html
├── services.html
├── privacy.html
├── styles.css
├── site-20260624-3.js
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── CNAME
└── assets/
```

## Main Pages

- `index.html`: homepage with hero, lead form, services, projects, FAQs, reviews
- `services.html`: services overview
- `general-building.html`: general building service page
- `repairs-maintenance.html`: repairs and maintenance service page
- `carpentry-joinery.html`: carpentry and joinery service page
- `decorating.html`: decorating service page
- `plastering-finishing.html`: plastering and finishing service page
- `quality-workmanship.html`: quality/trust page
- `gallery.html`: project gallery
- `about.html`: company overview
- `areas-we-cover.html`: location coverage page
- `faqs.html`: FAQs
- `contact.html`: quote/contact page
- `privacy.html`: privacy policy

## Local Preview

Because the site is static, the easiest local preview is a simple web server:

```bash
cd bryant-construction-group
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Avoid opening files directly with `file://` when testing navigation, forms, or relative assets.

## Editing Guidelines

## Content changes

- Most copy updates happen directly in the relevant `.html` file.
- Keep page titles, meta descriptions, canonical tags, and headings aligned with page content.
- When adding a new page, update navigation where needed and add the page to `sitemap.xml`.

## Styling

- Shared styles live in `styles.css`.
- Reuse existing utility and component classes where possible before adding new patterns.
- Test both desktop and mobile after layout changes.

## JavaScript

- Shared interactions live in `site-20260624-3.js`.
- Current behaviors include:
  - mobile navigation toggle
  - dropdown handling
  - quote form submission
  - homepage chat assistant
- Keep JavaScript framework-free unless there is a strong reason to change the site architecture.

## Images and assets

- Main brand assets live in `assets/`.
- Gallery images live in `assets/constructiongallery/`.
- Prefer compressed `.webp` assets for new gallery additions.
- Keep image names predictable and consistent with the existing `bryant-project-##` convention if extending the current gallery.

## Lead Form

The quote form is handled by `site-20260624-3.js`, which posts to the Cloudflare Worker endpoint at `/api/send-lead`. The Worker in `cloudflare/worker.js` sends the email through Resend without exposing the API key to website visitors.

If you change the form:

- update field names in both HTML and JavaScript
- verify success and fallback behavior
- confirm email destinations are correct
- keep spam protection enabled

### Cloudflare Worker setup

Deploy the Worker from the `cloudflare/` directory and store the Resend key as a secret:

```bash
cd cloudflare
wrangler secret put RESEND_API_KEY
wrangler deploy
```

The Worker routes are `bryantconstructiongroup.co.uk/api/*` (primary), `bryantconstruct.co.uk/api/*`, and `bryantconstruct.com/api/*` (compatibility). The Resend domain must be verified for `bryantconstructiongroup.co.uk`, and the sender is `info@bryantconstructiongroup.co.uk`.

## SEO and Domain Notes

This repo uses `CNAME` for the custom domain:

```text
bryantconstructiongroup.co.uk
```

Important: keep all domain references aligned with the live domain.

When updating metadata, make sure these stay in sync:

- canonical URLs
- Open Graph URLs
- Twitter image URLs
- JSON-LD schema URLs
- `robots.txt`
- `sitemap.xml`

If any of those point to an old or unused domain, the site can lose trust and indexing quality.

## Deployment

Deployment is intended for GitHub Pages.

Typical workflow:

```bash
git checkout main
git pull
# make edits
git add .
git commit -m "Update site content"
git push
```

After push:

- GitHub Pages serves the site from the published branch
- `CNAME` preserves the custom domain
- DNS and TLS must remain correctly configured outside the repo

## Maintenance Checklist

Before shipping a change:

- Run `node scripts/check-site.js`
- Check the edited page on desktop and mobile
- Test main navigation links
- Test `tel:`, `mailto:`, and WhatsApp links if touched
- Test the quote form if form code or fields changed
- Confirm canonical/meta/schema URLs match `https://bryantconstructiongroup.co.uk`
- Update `sitemap.xml` if pages are added, removed, or renamed

## Known Maintenance Risks

- Static metadata is repeated across pages, so domain or brand changes must be updated in multiple files
- `robots.txt`, `sitemap.xml`, and page-level canonical tags can drift if changed manually
- Large hero or gallery images can hurt performance if not compressed
- Contact and form settings are easy to break if email targets are changed without testing

## Suggested Next Improvements

- Consolidate repeated metadata patterns across pages
- Replace oversized image assets with optimized WebP or AVIF versions
- Standardize project titles and captions in the gallery for stronger SEO
- Keep structured data and sitemap aligned with the live domain
- Consider moving form handling to a branded backend instead of a client-side third-party form flow
