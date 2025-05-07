const express = require('express');
const router = express.Router();
const db = require('../db');

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