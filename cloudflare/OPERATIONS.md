# Lead service release and operations checks

The review adds request-size bounds, an off-screen quote spam trap, atomic D1 rate counters and download-only attachment responses. Deploy the Worker together with both updated quote forms after reviewing the branch. Existing secrets, routes and D1/R2 bindings remain required; never commit credentials.

## Release verification
1. Run `node --test tests/request-safety.test.mjs` and the static site check before release.
2. Use preview bindings first. Verify optional email, postcode storage, attachments, successful delivery and failure handling against preview services.
3. Confirm persistent rate-limit table creation works with the configured D1 database. Counters expire at their fixed-window boundary; repeated requests must return 429 after the configured quota. Production Cloudflare requests supply CF-Connecting-IP.
4. Confirm unauthenticated dashboard and export requests remain protected by Cloudflare Access.
5. After authorised production deployment, submit one clearly marked test enquiry, verify one stored lead, email delivery and attachment download. Avoid repeated real delivery tests.

## Open operational decisions
- Inbox and authenticated dashboard verification remain required; an HTTP 200 alone does not establish end-to-end delivery.
- Agree lead/upload/event retention periods before implementing deletion. Confirm the D1 backup recovery window and rehearse restoration to a separate database; maintain the associated R2 recovery plan.
- Configure Worker error/delivery-failure alerts and an external availability check using the owner's chosen accounts. Do not put tokens into monitoring URLs or logs.
- Existing UUID attachment URLs are bearer links. This change forces downloads and blocks executable same-origin rendering; it does not add expiry or authentication. Plan a migration that preserves authorised access to previously emailed attachments.
- Monitor rate-limit rejects for legitimate shared-IP customers and adjust quotas based on observed traffic.
