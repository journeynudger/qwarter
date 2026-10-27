# Moving qwarter.com to Vercel

## Prepared on 2026-10-27

- Project: `journeynudgers-projects/qwarter`, owned by Lorenzo (`lorenzo@qwarter.com`).
- Production follows `journeynudger/qwarter` on `main`.
- Both `qwarter.com` and `www.qwarter.com` are attached and ownership-verified in Vercel. Root is primary; www redirects to root with HTTP 308.
- DNS stays on Cloudflare: `marge.ns.cloudflare.com` and `rodney.ns.cloudflare.com`.
- Before cutover: apex A `208.87.133.155`, proxied; www CNAME `qwarter.com`, proxied.
- Google Workspace handles email. Its five MX records, SPF, DMARC and verification TXT records stay unchanged.
- The complete 16-record DNS backup is outside Git: `../work/cutover-2026-10-27/cloudflare-before.txt`. Original download: `~/Downloads/qwarter.com.txt`.
- No Cloudflare Worker routes were configured when inspected. Rules inspection remains pending.
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

## Remaining cutover

1. Confirm the Pro plan for the commercial launch and the Ready production deployment with migration fixes.
2. Preserve ancillary hostnames: change ftp CNAME target to `ipv4.qwarter.com`; change the two SRV targets (`_imaps._tcp` and `_pop3s._tcp`) to `mail.qwarter.com`, retaining priority, weight and ports. Both target hosts already point to the old server.
3. Recheck Vercel's project DNS recommendations. On 2026-10-27 the CLI explicitly accepts apex A `76.76.21.21`. The configuration API additionally lists `216.198.79.1` and `64.29.17.1` at rank 1. Project CNAME: `cc26d3f37336a52a.vercel-dns-017.com`.
4. Update the apex A and www CNAME in Cloudflare to Vercel, DNS only. Leave nameservers and unrelated records alone.
5. Set Production-only `NEXT_PUBLIC_SITE_URL=https://qwarter.com` and `ALLOW_INDEXING=1`, then redeploy. Variables are read at build time.
6. Verify DNS, TLS, root/www, HTTP→HTTPS, redirects, 410s, PDF, robots, sitemap, canonicals and current pages. Compare MX/TXT with the backup.
7. Submit `https://qwarter.com/sitemap.xml` to Search Console when access is available. Keep the old hosting through the rollback window.

## Rollback

Restore apex A `208.87.133.155` (proxied) and www CNAME `qwarter.com` (proxied).
FTP and mail-discovery records can remain pinned to the old server. Do not delete WordPress, its databases,
mailboxes or the Cloudflare zone. Leave `ALLOW_INDEXING` unset if cutover is postponed.
