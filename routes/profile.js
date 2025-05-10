const express = require('express');
const router = express.Router();
const db = require('../db');
// const {isAuthenticated} = require("../middleware.js")

// GET: View Profile
router.get('/', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    try {
        // Fetch profile + user's name in one query
        const [[profile]] = await db.execute(`
            SELECT p.*, u.first_name, u.last_name
            FROM profiles p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
        `, [req.session.userId]);

        if (!profile) return res.redirect('/profile/setup');

        // Get skills
        const [skills] = await db.execute(`
            SELECT s.name FROM skills s
            JOIN user_skills us ON s.id = us.skill_id
            WHERE us.user_id = ?
        `, [req.session.userId]);

        // Get interests
        const [interests] = await db.execute(`
            SELECT i.name FROM interests i
            JOIN user_interests ui ON i.id = ui.interest_id
            WHERE ui.user_id = ?
        `, [req.session.userId]);

        res.render('profile', {
            profile,
            fullName: `${profile.first_name} ${profile.last_name}`,
            skills: skills.map(s => s.name),
            interests: interests.map(i => i.name)
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading profile');
    }
});


// GET: Delete Profile
router.get('/delete', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    try {
        // Delete everything
        await db.execute('DELETE FROM user_skills WHERE user_id = ?', [req.session.userId]);
        await db.execute('DELETE FROM user_interests WHERE user_id = ?', [req.session.userId]);
        await db.execute('DELETE FROM profiles WHERE user_id = ?', [req.session.userId]);
        await db.execute('DELETE FROM users WHERE id = ?', [req.session.userId]);

        res.send('Profile deleted successfully. <a href="/profile/setup">Create again</a>');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error deleting profile');
    }
});


// GET: Profile Setup Form
router.get('/setup', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    const [rows] = await db.execute('SELECT * FROM profiles WHERE user_id = ?', [req.session.userId]);
    const profile = rows[0] || null;
    res.render('profile', { profile });
});

// POST: Save Profile with Skills and Interests
router.post('/setup', async (req, res) => {
    if (!req.session.userId) return res.redirect('/auth/login');

    const { role, skills, interests, bio } = req.body;
    const skillList = skills.split(',').map(s => s.trim().toLowerCase());
    const interestList = interests.split(',').map(i => i.trim().toLowerCase());

    try {
        // Insert or update profile
        const [existing] = await db.execute('SELECT * FROM profiles WHERE user_id = ?', [req.session.userId]);

        if (existing.length > 0) {
            await db.execute('UPDATE profiles SET role = ?, bio = ? WHERE user_id = ?', [role, bio, req.session.userId]);
        } else {
            await db.execute('INSERT INTO profiles (user_id, role, bio) VALUES (?, ?, ?)', [req.session.userId, role, bio]);
        }

        // Clear existing skills/interests
        await db.execute('DELETE FROM user_skills WHERE user_id = ?', [req.session.userId]);
        await db.execute('DELETE FROM user_interests WHERE user_id = ?', [req.session.userId]);

        // Insert new skills
        for (let skill of skillList) {
            if (!skill) continue;
            const [skillRows] = await db.execute('SELECT id FROM skills WHERE name = ?', [skill]);
            let skillId;
            if (skillRows.length > 0) {
                skillId = skillRows[0].id;
            } else {
                const [result] = await db.execute('INSERT INTO skills (name) VALUES (?)', [skill]);
                skillId = result.insertId;
            }
            await db.execute('INSERT IGNORE INTO user_skills (user_id, skill_id) VALUES (?, ?)', [req.session.userId, skillId]);
        }

        // Insert new interests
        for (let interest of interestList) {
            if (!interest) continue;
            const [interestRows] = await db.execute('SELECT id FROM interests WHERE name = ?', [interest]);
            let interestId;
            if (interestRows.length > 0) {
                interestId = interestRows[0].id;
            } else {
                const [result] = await db.execute('INSERT INTO interests (name) VALUES (?)', [interest]);
                interestId = result.insertId;
            }
            await db.execute('INSERT IGNORE INTO user_interests (user_id, interest_id) VALUES (?, ?)', [req.session.userId, interestId]);
        }

        res.send('Profile saved successfully!');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error saving profile');
    }
});

module.exports = router;