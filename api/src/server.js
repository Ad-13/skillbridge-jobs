import express from 'express'
import { jwtVerify } from 'jose'
import { PORT, ISSUER, API_AUDIENCE, JWKS, IS_PRODUCTION } from './config.js'

// Demo storage. In the real project this becomes a database table keyed
// by `sub`. Note that this service holds no session and no cookie: it is
// a resource server, not a login surface.
const jobsBySub = new Map()

const jobsFor = (sub) => {
  if (!jobsBySub.has(sub)) {
    jobsBySub.set(sub, [
      {
        id: 1,
        title: 'Frontend Developer',
        company: 'Rheinwerk GmbH',
        missing: ['Docker', 'GraphQL'],
      },
      {
        id: 2,
        title: 'Full Stack Engineer',
        company: 'Nordlicht AG',
        missing: ['AWS'],
      },
      {
        id: 3,
        title: 'Angular Developer',
        company: 'Kleve Systems',
        missing: ['RxJS testing'],
      },
    ])
  }
  return jobsBySub.get(sub)
}

// Bearer-token authentication. Identical in shape to the Skills API:
// one mechanism, used the same way everywhere in the project.
const requireBearer = async (req, res, next) => {
  const header = req.get('authorization') ?? ''

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_bearer_token' })
  }

  try {
    // Signature, issuer, audience and expiry are all checked here.
    // The audience check is what stops a token minted for a different
    // API of the same tenant from being replayed against this one.
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: ISSUER,
      audience: API_AUDIENCE,
    })

    req.user = { sub: payload.sub }
    next()
  } catch (error) {
    res.status(401).json({ error: 'invalid_token', detail: error.message })
  }
}

const app = express()

// Render terminates TLS in front of this process.
app.set('trust proxy', 1)

app.get('/health', (req, res) => res.json({ ok: true, service: 'jobs-api' }))

app.get('/api/jobs', requireBearer, (req, res) => {
  res.json({
    sub: req.user.sub,
    jobs: jobsFor(req.user.sub),
    servedBy: 'jobs-api',
  })
})

app.use((error, req, res, _next) => {
  console.error('[jobs-api] unhandled error:', error)
  res.status(500).json({ error: 'internal_error' })
})

app.listen(PORT, () => {
  console.log(`[jobs-api] listening on port ${PORT} (production: ${IS_PRODUCTION})`)
})
