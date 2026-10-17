# Vercel and the move of qwarter.com

The site deploys from **Lorenzo's personal Vercel account, lorenzo@qwarter.com**: not the Valerin team,
and not development@valerin-group.com. qwarter.com keeps pointing at WordPress until step 3.

## Status (2026-10-17)

- **Connected.** Lorenzo imported `journeynudger/qwarter` into his personal Vercel account on 2026-10-17.
  Pushes to `main` deploy Production; every other branch, the port's pull request included, gets a preview.
- `main` holds only the README until the port's pull request is merged, so Production has nothing to build yet.
- The site has no pages until both sites are captured (CLAUDE.md, "Doing the port"): until then a preview
  answers every URL with "Page not found".

## 1. Connect the repository (once, about two minutes)

1. Sign in at https://vercel.com as **lorenzo@qwarter.com**. Check the scope switcher (top left) shows the
   personal account, not a team.
2. **Add New → Project → Import Git Repository**, choose `journeynudger/qwarter`.
   If it is not in the list: **Adjust GitHub App Permissions** and grant Vercel access to that repository
   (the Vercel GitHub App only sees the repositories it was given).
3. Framework preset: Next.js (also declared in `vercel.json`). Build settings: leave the defaults.
   No environment variables are needed to build.
4. Deploy. From then on every push to `main` deploys to Production and every other branch gets a preview URL.

Commits are authored as `journeynudger <117860681+journeynudger@users.noreply.github.com>` (as in
journeysite), so Vercel attributes each build to the GitHub account that owns the repository. A deployment
stuck at "Blocked" with no build log means a commit author Vercel does not recognise; the reason is only in
the deployment's API record (`readyStateReason`).

Until the content is in (CLAUDE.md, "Doing the port"), a deployment builds a site with no pages: every URL
answers 404. Connect it anyway; previews of the port branch then appear on their own.

## 2. Settings for Production (Vercel → qwarter → Settings → Environment Variables)

| Variable | Value | When |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://qwarter.com` | always (canonical URLs, sitemap, social cards) |
| `ALLOW_INDEXING` | `1` | only once qwarter.com points at Vercel; leave unset before, so the `*.vercel.app` copy stays out of search |

## 3. Point qwarter.com at Vercel

1. Vercel → qwarter → Settings → **Domains**: add `qwarter.com` and `www.qwarter.com` (redirect one to the
   other the way WordPress does today; the capture of qwarter.com records which).
2. At the DNS host, change the records Vercel shows. If the DNS is on Cloudflare, keep the proxy **off**
   (grey cloud) for those records, or Vercel cannot issue the certificate.
3. Set `ALLOW_INDEXING=1` and redeploy.

## 4. After the switch

- Spot-check every page, an old WordPress link (`/?p=<id>` → its page, `/wp-content/uploads/…` → `/media/…`),
  `/sitemap.xml`, `/robots.txt`, and a URL that does not exist (404).
- Search Console: submit `https://qwarter.com/sitemap.xml`.
- WordPress can be switched off once nothing points at it: qwarter.com has no forms ported yet (if it has
  a contact form, CLAUDE.md lists it as a question).
