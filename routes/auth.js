const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const db = require('../db');

// GET: Register Page
router.get('/register', (req, res) => {
    res.render('register');
});

// POST: Register New User
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const [existing] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.send('Email already registered');
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await db.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [
            username,
            email,
            hashedPassword,
        ]);

        res.redirect('/auth/login');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error registering user');
    }
});

// GET: Login Page
router.get('/login', (req, res) => {
    res.render('login');
});

// POST: Login User
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];
        if (!user) return res.send('Invalid email or password');

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.send('Invalid email or password');

        req.session.userId = user.id;
        res.redirect('/profile/setup');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error logging in');
    }
});

// GET: Logout
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/auth/login');
    });
});

module.exports = router;