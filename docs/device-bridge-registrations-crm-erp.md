<!--
LEEWAY HEADER — DO NOT REMOVE
REGION: LEEWAY.CRM_ERP.DEVICE_BRIDGE_CUSTOMER_BUSINESS
TAG: LEEWAY.CREATOR_BUSINESS.INVITES_ACCOUNTS_CRM_ERP_V1
5WH:
WHAT = Define Creator-owned CRM/ERP business projection for invited LeeWay customers and per-device enrollment.
WHY = Creator must see actual registrations, verified emails, devices, permissioned messaging and trustworthy business adoption counts in the Tablet.
WHO = Original Runtime/Zitadel, LeeWay CRM/ERP owners, Creator business operator, invited customer data subjects.
WHERE = docs/device-bridge-registrations-crm-erp.md in 4citeB4U/Leeway-Agentic-CRM-ERP.
WHEN = 2026-11-24.
HOW = Consume only authenticated Runtime internal registration events, atomic contact/account upsert and private Creator readback.
LICENSE = Existing repository terms; no private customer data granted for public posting.
-->
# Device Bridge invitations → LeeWay customer CRM + ERP

**Current state: SOURCE CONTRACT ONLY.** Public CRM GitHub Pages remains browser-local; signed-in Creator CRM/ERP server data and cross-device Tablet visibility are NOT QUALIFIED. Do not create a second CRM database, identity registry, telemetry service, campaign sender, or public customer-list endpoint.

## Original service owners and exact source

- **Public front door**: `4citeB4U/Leeway-Device-Extension`, draft PR #6, `docs/install/` and original secure `join/index.html` + `join/join.js`. GitHub Pages later serves the original join client at the repo's project `/join/` path. Original join client expects protected `/api/join/bootstrap` and `/api/join/begin`; GitHub Pages CANNOT implement those same-origin routes. It must remain blocked until a supported original Runtime API origin or approved reverse proxy is bound.
- **Invitation and identity authority**: `4citeB4U/Leeway-Runtime-Fabric`, [PR #198](https://github.com/4citeB4U/Leeway-Runtime-Fabric/pull/198) has `customer-invitations.mjs` (Creator-issued random single-use 72h default invitations, hash-custody, consumed only after verified customer sign-in), `customer-onboarding-engine.mjs` (provider-driven account setup), `customer-privacy-telemetry.mjs` (30-day aggregate signup metric; no personal tracking). New `customer-crm-registration-event.mjs` uses those original providers to publish internal `customer.registration.verified` from redeemed invitation + verified Zitadel email + registered customer tenant, not a page hit.
- **CRM/ERP business projection**: current PR in `Leeway-Agentic-CRM-ERP`, `modules/runtime-onboarding-projection.mjs`. Only trusted original event reference is accepted. Durable tenant-scoped CRM contact and ERP account must be committed **atomically** by original approved CRM/ERP service and read back; synthetic code fixtures are NOT real customer writes.
- **Creator Tablet**: existing ERP/CRM app surface is present in `Leeway-Agent-Virtual-Tablet`, but cross-app signed session and the protected Creator business dashboard adapter are NOT bound to original backend. The Tablet is not the database.

## Records, ownership, and what the Creator sees

| Canonical owner | Business entity | Fields or metrics | Claim boundary |
|---|---|---|---|
| Original Creator invitation store | Invitation | Issued timestamp, invitation ID, edition, expiry, accepted/expired/revoked state, referring Creator | A link view is NOT a signup |
| Original Zitadel/Runtime | Verified customer identity | Original subject reference, verified email status, account state | One unique customer subject per tenant; no copied Creator identity |
| Creator tenant CRM | Contact | Stable contact ID, **verified customer email**, name, account creation timestamp, source, optional marketing opt-in and consent evidence | Creator-scoped only, not published in GitHub nor browser storage |
| Customer-owned ERP account / Creator commerce ERP | Customer account and entitlement | Account ID, tenant, edition/plan, lifecycle state, subscription only if verified | Creating a contact cannot claim revenue or payment |
| Original Device Bridge registry | Enrolled physical devices | Device identity, OS, owner, reachable/offline state, last verified health | One account may have multiple devices; no increment for browser opens |
| Creator business dashboard | Adoption metrics | Invites issued/redeemed, distinct verified customers, distinct active accounts, contacts, verified enrolled devices, explicit marketing opt-ins | All-time unique accounts from durable account store; 30-day feature usage is separate optional aggregate |

**Default privacy:** Registration email is used for account/service communications subject to the published privacy notice. Optional marketing email requires separate, affirmative, recorded permission and an available opt-out/unsubscribe mechanism. If revoked/unsubscribed, marketing must stop even if a prior opt-in is present. No automatic mailing campaign is activated by registration.

**Tenant isolation:** The Creator can access the authorized business contact list under a distinct original Creator business tenant scope. Customers' private workspace data remains under each customer's separate tenant; registration never exposes the Digital Brain, local computer files or the Creator's private data to other customers.

**Counts are not equivalent:** invitation sent != invitation opened != invitation redeemed != verified signup != physically enrolled device != active user != paying subscription. Count each separately with idempotent original references. Do NOT inflate leads with replays or browser visits. Existing `signup.verified` is an original 30-day aggregate telemetry signal, not the durable lifetime customer ledger.

## Blocked live wiring and acceptance

1. Publish the true invite-only front door and original `/join/` path; bind original Runtime OIDC PKCE/CSRF API, terms, profile email verification and invitation issuer. The GitHub Pages static site cannot collect protected customer data by itself.
2. Deliver Creator invitation through an authorized, opted-in email workflow; keep token hash only with original Runtime store and token in the recipient's private URL fragment. Never commit tokens or customer email to a public repo.
3. Original Runtime emits readback-verified internal customer registration event, with tenant mapping and separate marketing choice. Atomically project to trusted CRM/ERP store. Replays must be idempotent.
4. Add protected Creator business list and adoption counts in the existing ERP/CRM application inside the Tablet after authenticating `CRM_ERP_CREATOR_BUSINESS_READ`. Do not expose a public unauthenticated CRM endpoint.
5. Implement consent update, unsubscribe/opt-out, access export/deletion as applicable, audit controls, retention, delivery-only-after-explicit-authorization, privacy review and rollback. Distinguish transactional from marketing email.
6. Qualify live positive/negative cases: invite expiry/replay/revocation, account email not verified, Creator role spoof, two devices one account, two customer tenants isolated, duplicate event delivery, CRM and ERP readback mismatch, unsubscribed mail deny, revenue not inferred, Creator Tablet display. Independent Veritas/Receipt Authority eligibility must be validated where required.

**Release:** DRAFT source only; original Runtime/CRM/ERP identity and durable store not bound; NO real customer/marketing registration or protected email storage performed by this PR.
