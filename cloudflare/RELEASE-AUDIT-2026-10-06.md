# Release audit — 6 October 2026

Status: blocked for production; local checks pass. Do not merge or deploy until preview acceptance and owner verification are complete.

## Verified deployment drift

Read-only Cloudflare API inspection found the production script `bryant-construction-leads` with compatibility date `2026-10-01` and **zero bindings**. The primary domain's `/api/*` route targets this script. Both GET and a POST with an empty JSON object to `/api/send-lead` returned an empty 404. No genuine customer enquiry was sent.

The existing preview script has D1, R2 and an export-token binding, but its sender is Bryant Group Holdings, and it lacks the Resend secret and the repository's Access team/audience variables. Do not assume this preview is the tested version or overwrite it without reconciling its purpose.

The public homepage and sampled service HTML match main apart from Cloudflare email obfuscation. HTTPS and www-to-root redirect work. HTTP serves 200 rather than redirecting to HTTPS.

## Required release steps

1. Reconcile the deployed production/preview script history with the owner. Restore the intended Construction configuration in an isolated preview using `cloudflare/wrangler.toml`, the intended D1 and R2 resources and migrations. Keep production untouched during verification.
2. Provision the Construction `RESEND_API_KEY` and `LEADS_EXPORT_TOKEN` through encrypted secret storage; verify the sender domain. Secret plaintext must never enter source or logs. Both production and preview declare required secrets.
3. Confirm Cloudflare Access application paths and JWT issuer/audiences match the configured account. Verify unauthorized dashboard and export requests are refused, and the owner can access the intended dashboard.
4. Send one clearly marked TEST enquiry in the approved preview, verify exactly one D1 lead, actual inbox delivery and any attachment download, then test an intentional provider failure safely. Local mocked success is not inbox confirmation.
5. Verify interaction/attribution events in preview D1; primary success must still reach the customer if secondary reporting fails. Alerts `lead-delivery-status-write-failed`, `lead-conversion-write-failed` and `lead-service-request-failed` deliberately exclude personal data.
6. Enable the primary domain's HTTP-to-HTTPS redirect in Cloudflare and verify paths/query strings survive it. Check legacy-domain redirects separately before altering them.
7. Only after authorization and complete preview QA, merge the website branch and deploy the intended Worker together. Repeat a single marked TEST and read-only smoke checks on production.
8. Open Search Console using the account with access to the existing property. Confirm sitemap, canonical/indexing reports, device performance, manual actions and security reports. The current Safari Google session opens the welcome page without an available property. Do not create a replacement property merely to bypass missing access.

Existing attachment links remain bearer links. Retention, restoration and monitoring decisions described in OPERATIONS.md remain outstanding. Do not delete customer data to resolve them.
