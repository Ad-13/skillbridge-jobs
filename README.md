# Skillbridge — Jobs App

Next.js frontend **and** Backend-for-Frontend on Vercel, plus a separate
Express API on Render. Authentication is OpenID Connect against Auth0;
tokens never reach the browser.

Companion repository: **skillbridge-skills** (Angular + Express).

---

## Shape

```
browser ──> Next.js on Vercel
              ├── /                    React page
              ├── /auth/*              OIDC login, callback, logout
              ├── /api/me              session cookie
              ├── /api/jobs        ──> Express on Render   (Bearer + aud)
              └── /api/peer/skills ──> Skills App          (Bearer + aud)
```

The browser only ever talks to the Vercel origin, so the session cookie is
first-party and there is no CORS anywhere. Both outbound calls happen server
to server and carry the user's access token.

**Why the OIDC flow lives in Next and not in Express.** The login flow is a
chain of redirects. Proxying 3xx responses through `next.config` rewrites is
a known sharp edge — some proxies follow the redirect themselves instead of
handing it to the browser, and the cookie is lost. Keeping the flow in Route
Handlers avoids the question entirely.

**Why Express still exists.** It holds the business logic and the database.
A long-lived process keeps a normal connection pool, has no function
timeout when a language model takes twenty seconds to answer, and can run
background work. It is a *resource server*: it verifies bearer tokens and
owns no session and no cookie.

## Layout

```
web/src/lib/config.ts                 environment, lazy OIDC discovery, JWKS
web/src/lib/session.ts                encrypted (JWE) session cookies
web/src/app/auth/login/route.ts       start of login (PKCE, state, nonce)
web/src/app/auth/callback/route.ts    code exchange and token verification
web/src/app/auth/logout/route.ts      local and provider logout
web/src/app/api/me/route.ts           who is signed in
web/src/app/api/jobs/route.ts         calls our own Express API
web/src/app/api/peer/skills/route.ts  calls the other application's API
web/src/app/page.tsx                  the UI
api/src/config.js                     environment, OIDC discovery, JWKS
api/src/server.js                     bearer-protected /api/jobs
```

Note that `web/src/lib/config.ts` fetches the discovery document **lazily**,
while the Express services do it at startup. That is deliberate: Next
evaluates route modules during `next build`, and a top-level `await fetch`
would make the build depend on the provider being reachable.

## Auth0 setup

1. **Applications → Create Application → Regular Web Applications**, name it
   `Jobs App`.
2. In **Settings** (comma-separated lists):
   - Allowed Callback URLs: `http://jobs.localhost:3000/auth/callback`,
     `https://YOUR-APP.vercel.app/auth/callback`
   - Allowed Logout URLs: `http://jobs.localhost:3000`,
     `https://YOUR-APP.vercel.app`
   - Allowed Web Origins: the same two origins
3. The **Skillbridge API** (identifier `https://skillbridge-api`) is shared
   with the other repository — create it once, in either.

## Running locally

```bash
echo "127.0.0.1 skills.localhost jobs.localhost" | sudo tee -a /etc/hosts
```

```bash
cp web/.env.example web/.env.local     # fill in the Auth0 values
cp api/.env.example api/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm --prefix api install && npm --prefix api run dev     # port 4000
npm --prefix web install && npm --prefix web run dev     # port 3000
```

Open `http://jobs.localhost:3000`.

## Deploying

### Express API → Render

**New → Web Service**, region Frankfurt.

| Setting | Value |
| --- | --- |
| Root Directory | `api` |
| Build Command | `npm ci` |
| Start Command | `node src/server.js` |
| Instance Type | Free |

Environment variables: `OIDC_ISSUER`, `API_AUDIENCE`,
`NODE_ENV=production`. No client id, no secret, no session secret — this
service never signs anyone in.

### Next.js → Vercel

**Add New → Project**, import this repository.

| Setting | Value |
| --- | --- |
| Root Directory | `web` |
| Framework Preset | Next.js |

Environment variables: everything from `web/.env.example`, with
`BASE_URL` set to the deployed Vercel URL, `JOBS_API_URL` to the Render
service, and `SKILLS_API_URL` / `SKILLS_APP_URL` to the Skills App.

Deploy the Render service first — you need its URL for `JOBS_API_URL`.

Then add the Vercel URL to the Auth0 callback, logout and origin lists.

## Notes

- Vercel does not sleep; the free Render service does, after 15 minutes.
  Warm it before a demo.
- Job data lives in a `Map` in memory. This is the one deliberate
  simplification and becomes a database table keyed by `sub`.
- No refresh-token handling yet: the session lasts eight hours, after which
  the user signs in again. Adding it is one request to the token endpoint.
