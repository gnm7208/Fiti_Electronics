import { createHash, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import express from 'express';
import { config, adminConfigured } from './config.js';

const COOKIE_NAME = 'fiti_admin_token';
const TOKEN_TTL = '12h';
const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Fixed-length digests before timingSafeEqual - comparing raw variable-length
// strings directly either throws (length mismatch) or leaks length via the
// exception path/timing before the constant-time comparison ever runs.
function safeStringsEqual(a, b) {
    const digestA = createHash('sha256').update(String(a)).digest();
    const digestB = createHash('sha256').update(String(b)).digest();
    return timingSafeEqual(digestA, digestB);
}

function cookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: COOKIE_MAX_AGE_MS,
    };
}

/** Protects /api/admin/* routes - requires a valid admin JWT cookie. */
export function requireAdminAuth(req, res, next) {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    try {
        jwt.verify(token, config.admin.jwtSecret);
        next();
    } catch {
        res.status(401).json({ error: 'Session expired or invalid' });
    }
}

export function createAdminAuthRouter() {
    const router = express.Router();

    router.post('/login', (req, res) => {
        if (!adminConfigured()) {
            res.status(503).json({ error: 'Admin login is not configured on this server' });
            return;
        }
        const { username, password } = req.body || {};
        const validUsername = typeof username === 'string' && safeStringsEqual(username, config.admin.username);
        const validPassword = typeof password === 'string' && safeStringsEqual(password, config.admin.password);
        if (!validUsername || !validPassword) {
            res.status(401).json({ error: 'Invalid username or password' });
            return;
        }
        const token = jwt.sign({ role: 'admin' }, config.admin.jwtSecret, { expiresIn: TOKEN_TTL });
        res.cookie(COOKIE_NAME, token, cookieOptions());
        res.json({ ok: true });
    });

    router.post('/logout', (_req, res) => {
        res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
        res.json({ ok: true });
    });

    router.get('/me', (req, res) => {
        const token = req.cookies?.[COOKIE_NAME];
        if (!token) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        try {
            jwt.verify(token, config.admin.jwtSecret);
            res.json({ authenticated: true });
        } catch {
            res.status(401).json({ error: 'Session expired or invalid' });
        }
    });

    return router;
}
