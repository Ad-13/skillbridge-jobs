'use client'

import { useCallback, useEffect, useState } from 'react'

interface CurrentUser {
  sub: string
  name: string
  email: string | null
  skillsAppUrl: string
}

interface Job {
  id: number
  title: string
  company: string
  missing: string[]
}

interface Skill {
  id: number
  name: string
  level: string
}

export default function Page() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState<Job[]>([])
  const [peerSkills, setPeerSkills] = useState<Skill[] | null>(null)
  const [peerLoading, setPeerLoading] = useState(false)
  const [peerError, setPeerError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    const response = await fetch('/api/jobs', { credentials: 'include' })
    if (response.ok) {
      const data = (await response.json()) as { jobs: Job[] }
      setJobs(data.jobs)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        // credentials: 'include' attaches the session cookie. Omitting it
        // is the classic way to lose an hour on a backend that works.
        const response = await fetch('/api/me', { credentials: 'include' })
        if (response.ok) {
          setUser((await response.json()) as CurrentUser)
          await loadJobs()
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [loadJobs])

  const loadPeerSkills = async () => {
    setPeerError(null)
    setPeerLoading(true)
    try {
      const response = await fetch('/api/peer/skills', { credentials: 'include' })
      if (!response.ok) {
        setPeerError(`Request failed with ${response.status}`)
        return
      }
      const data = (await response.json()) as { skills: Skill[] }
      setPeerSkills(data.skills)
    } finally {
      setPeerLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="head">
        <span className="badge">React · Next.js</span>
        <h1>Jobs App</h1>
        <p className="sub">Job posting analysis</p>
      </header>

      {!user ? (
        <section className="card">
          <p>You are not signed in.</p>
          <a className="button" href="/auth/login">
            Sign in
          </a>
        </section>
      ) : (
        <>
          <section className="card">
            <p className="label">Signed in as</p>
            <p className="name">{user.name}</p>
            <p className="label">Subject id — the key shared with the other application</p>
            <code className="sub-id">{user.sub}</code>
          </section>

          <section className="card">
            <h2>Analysed postings</h2>
            <p className="label">From this application&apos;s own Express API</p>
            <ul className="list">
              {jobs.map((job) => (
                <li key={job.id}>
                  <span className="skill-name">
                    {job.title} · {job.company}
                  </span>
                  <span className="pill">missing: {job.missing.join(', ')}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Skills from the other application</h2>
            <p className="label">
              Fetched server to server from the Skills API with an audience-scoped token
            </p>

            <button className="button" onClick={loadPeerSkills} disabled={peerLoading}>
              {peerLoading ? 'Loading…' : 'Load my skills'}
            </button>

            {peerError && <p className="error">{peerError}</p>}

            {peerSkills && (
              <ul className="list">
                {peerSkills.map((skill) => (
                  <li key={skill.id}>
                    <span className="skill-name">{skill.name}</span>
                    <span className="pill">{skill.level}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <a className="link" href="/auth/logout">
            Sign out
          </a>
        </>
      )}

      <footer className="foot">
        <a href={user?.skillsAppUrl ?? '#'}>Open Skills App →</a>
      </footer>
    </main>
  )
}
