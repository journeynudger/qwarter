# Moving qwarter.com to Vercel

## Completed on 2026-10-27

- Project: `journeynudgers-projects/qwarter`, owned by Lorenzo (`lorenzo@qwarter.com`).
- Production follows `journeynudger/qwarter` on `main`.
- Both `qwarter.com` and `www.qwarter.com` are attached and ownership-verified in Vercel. Root is primary; www redirects to root with HTTP 308.
- DNS stays on Cloudflare: `marge.ns.cloudflare.com` and `rodney.ns.cloudflare.com`.
- Before cutover: apex A `208.87.133.155`, proxied; www CNAME `qwarter.com`, proxied.
- Google Workspace handles email. Its five MX records, SPF, DMARC and verification TXT records stay unchanged.
- The complete 16-record DNS backup is outside Git: `../work/cutover-2026-10-27/cloudflare-before.txt`. Original download: `~/Downloads/qwarter.com.txt`.
- No Cloudflare Worker routes were configured when inspected. No Cloudflare rules were changed.
- Lorenzo upgraded the team to Pro; the Vercel API confirms Pro, active, on 2026-10-27.

## Website migration

Generate `content/redirects.json` with `python3 scripts/port/redirects.py` using the WordPress snapshot
at `.port-cache/qwarter/` (snapshot commit `1a4b5cf66f76dc2202215708c08f2de3a8a6fe9b`, branch `captures-wp`).
`content/route-map.json` records the decisions.

- 35 permanent path redirects and 19 WordPress page-ID redirects.
- Current projects land on matching case studies; projects no longer in the catalogue land on Portfolio.
- About Us → Approach; Blog and category archives → Stories; Portfolio → Work.
- Lorenzo explicitly retired the 21 old articles on 2026-10-27. Their paths and IDs return 410 with links to the current site. Ten obsolete WordPress test projects are also retired.
- The original Pineapple Club PDF is preserved under `public/legacy-assets/`, with a redirect from its original uploads URL.
- Removed the blanket uploads redirect that previously pointed at nonexistent `/media/YYYY/...` files.
- Vercel page aliases receive `X-Robots-Tag: noindex, nofollow`, including after production indexing is enabled. Drafts and excerpts remain excluded from indexing and the sitemap.

## Existing form workers

The universal-middleware workers still read Qwarter's Gravity Forms entries. The original
`/wp-json/gf/v2/*` URLs remain available with their existing authentication through
`lib/legacy-origin.ts`. It connects directly to `208.87.133.155` using `qwarter.com` for the
certificate identity, SNI and Host, with normal certificate verification enabled. It never
uses the new apex DNS to find WordPress or accepts a caller-selected destination.
Responses are private and never cached.

The original `/.well-known/acme-challenge/*` paths are preserved for certificate renewal.
Keep WordPress and the hosting running while the workers depend on its entries.
The origin's HTTPS API index returns 200; unauthenticated entry access returns 401.

## Live configuration and verification

- Apex A: `216.198.79.1`, DNS only.
- www CNAME: `cc26d3f37336a52a.vercel-dns-017.com`, DNS only.
- FTP CNAME: `ipv4.qwarter.com`. Both IMAPS and POP3S SRV targets now use `mail.qwarter.com`, retaining priority, weight and ports.
- Vercel confirms both website records are correctly configured. Root and www have valid HTTPS certificates; www redirects to root with 308.
- Production commit `29ec98a74542ae2c86683bccef9095cf12befdf2`, deployment `dpl_GLEzzUxxQEJBvaCXuQSj7JQ8jn6e`, was Ready before the DNS switch.
- `NEXT_PUBLIC_SITE_URL=https://qwarter.com` and `ALLOW_INDEXING=1` are active. The live canonical is `https://qwarter.com/`; robots allows indexing and the sitemap contains 66 canonical URLs.
- Authoritative DNS comparisons confirm nameservers, Google MX/TXT and the old mail/IPv4 hosts are unchanged.
- All 102 combined Qwarter/Journey live HTTP checks passed, including redirects, all retired Qwarter routes, HTTPS, form API authentication, preserved Journey reports/contact cards and form pages. The verification report is outside Git at `../work/cutover-2026-10-27/live-verification.json`.
- Both repositories passed 53 unit tests each, lint and production builds. No real form entries, emails or texts were created during verification.
- Submit `https://qwarter.com/sitemap.xml` to Search Console when access is available. Keep the old hosting while form workers depend on it.

## Rollback

Restore apex A `208.87.133.155` (proxied) and www CNAME `qwarter.com` (proxied).
FTP and mail-discovery records can remain pinned to the old server. Do not delete WordPress, its databases,
mailboxes or the Cloudflare zone. Vercel aliases are excluded from indexing by their response headers.
