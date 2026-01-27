import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github2'
import session from 'express-session'

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || ''
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || ''
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:8080/auth/github/callback'

// User store (in-memory for small team)
const users = new Map()

export function setupAuth(app) {
  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || 'gastown-dev-secret-change-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    }
  }))

  app.use(passport.initialize())
  app.use(passport.session())

  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user.id)
  })

  // Deserialize user from session
  passport.deserializeUser((id, done) => {
    const user = users.get(id)
    done(null, user || null)
  })

  // GitHub OAuth Strategy
  if (GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
      clientID: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      callbackURL: CALLBACK_URL
    }, (accessToken, refreshToken, profile, done) => {
      // Create/update user
      const user = {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName || profile.username,
        avatar: profile.photos?.[0]?.value || null,
        accessToken
      }
      users.set(profile.id, user)
      done(null, user)
    }))
  }

  // Auth routes
  app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }))

  app.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login?error=auth_failed' }),
    (req, res) => {
      res.redirect('/')
    }
  )

  app.get('/auth/logout', (req, res) => {
    req.logout(() => {
      res.redirect('/')
    })
  })

  // Current user endpoint
  app.get('/api/me', (req, res) => {
    if (req.isAuthenticated()) {
      res.json({
        id: req.user.id,
        username: req.user.username,
        displayName: req.user.displayName,
        avatar: req.user.avatar
      })
    } else {
      res.status(401).json({ error: 'Not authenticated' })
    }
  })

  // Dev mode: allow anonymous users
  app.post('/auth/dev-login', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Dev login not allowed in production' })
    }

    const { username } = req.body
    if (!username) {
      return res.status(400).json({ error: 'Username required' })
    }

    const devUser = {
      id: `dev-${username}`,
      username,
      displayName: username,
      avatar: null
    }
    users.set(devUser.id, devUser)

    req.login(devUser, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed' })
      }
      res.json(devUser)
    })
  })

  return { users }
}

export function requireAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({ error: 'Authentication required' })
}

export function getSessionMiddleware() {
  return session({
    secret: process.env.SESSION_SECRET || 'gastown-dev-secret-change-in-prod',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
}
