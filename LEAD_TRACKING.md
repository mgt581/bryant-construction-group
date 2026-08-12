# Lead tracking integration

The site records first-touch attribution, page views, contact-link clicks and quote-form leads in Cloudflare D1. The existing `/api/send-lead` flow remains the only email-delivery path, including its current Resend and FormSubmit fallback behavior.

## Architecture

- `site-config.js` contains public, non-secret browser configuration.
- `lead-tracking.js` records first-touch attribution and supported interaction events.
- `site-20260624-3.js` adds attribution to the existing quote submission without changing its form UI or validation.
- `cloudflare/worker.js` continues to own attachments and email delivery and now stores leads before delivery.
- `cloudflare/lead-tracking.js` contains D1, reporting, export and administration helpers.
- `dashboard.html` is the private administration view. It must not be exposed without Cloudflare Access.

## Preview resources

The `preview` Wrangler environment uses isolated resources:

- Worker: `bryant-construction-leads-preview`
- D1: `bryant-construction-leads-preview`
- R2: `contact-us-form-image-upload-construction-preview`

Apply migrations with:

```sh
wrangler d1 migrations apply LEADS_DB --env preview --remote
```

Deploy only the preview Worker with:

```sh
wrangler deploy --env preview
```

## Production requirements

Do not deploy the Worker changes until all of the following are complete:

1. Confirm the prepared `bryant-construction-leads` D1 binding and applied migration are present in the intended Cloudflare account.
2. Create a Cloudflare Access self-hosted application covering:
   - `/dashboard*`
   - `/api/dashboard`
   - `/api/leads/*`
   - `/api/lead-events/export`
3. Configure these Worker values for the Access application:
   - `CLOUDFLARE_ACCESS_ENABLED=true`
   - `CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://YOUR-TEAM.cloudflareaccess.com`
   - `CLOUDFLARE_ACCESS_AUD=YOUR-APPLICATION-AUDIENCE`
4. Store `LEADS_EXPORT_TOKEN` as an encrypted Worker secret for controlled API fallback use. Never place it in the dashboard, URLs, source, logs or GitHub settings visible to the browser.
5. Review the privacy notice and retention procedure for attribution data, interaction events, first-party browser storage and hashed IP addresses.

The Worker validates the Access JWT signature, issuer, audience and expiry. Merely supplying an Access-looking header is not sufficient.

## Preview acceptance checks

- Tracker loads once on every public HTML page and not on `dashboard.html`.
- First-touch UTM/click IDs and stable session/client IDs persist during navigation.
- Page views and phone, WhatsApp, email and quote CTA events reach D1.
- Each quote submission stores exactly one lead and sends exactly one email through the existing delivery flow.
- A failed email remains visible with `delivery_status=failed`.
- Unauthenticated administration routes return `401`.
- All eight pipeline states and non-negative pence values can be saved.
- Both CSV exports require authorization.
- No secret is present in browser assets, repository history, URLs or logs.

Do not promote to production until every check passes on an Access-protected preview.
