const express = require('express');
const router = express.Router();

// Discover users
router.get('/discover', async (req, res) => {
    const db = req.db;
    const { role, skill } = req.query;

    try {
        let query = `
            SELECT u.id, u.username, p.role, p.bio FROM users u
            JOIN profiles p ON u.id = p.user_id
            WHERE u.id != ?
        `;
        const params = [req.session.userId];

        if (role) {
            query += ' AND p.role = ?';
            params.push(role);
        }

        if (skill) {
            query += `
                AND EXISTS (
                    SELECT 1 FROM user_skills us
                    JOIN skills s ON us.skill_id = s.id
                    WHERE us.user_id = u.id AND s.name = ?
                )
            `;
            params.push(skill);
        }

        const [results] = await db.execute(query, params);
        res.json(results);
    } catch (err) {
        res.status(500).send('Server error.');
    }
});

// Send mentorship request
router.post('/request', async (req, res) => {
    const db = req.db;
    const senderId = req.session.userId;
    const { receiverId } = req.body;

    try {
        if (senderId === receiverId) return res.status(400).send('Cannot request yourself.');

        await db.execute(`
            INSERT INTO mentorship_requests (sender_id, receiver_id)
            VALUES (?, ?)
        `, [senderId, receiverId]);

        res.send('Mentorship request sent.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).send('Request already sent.');
        } else {
            res.status(500).send('Server error.');
        }
    }
});

// Accept or decline request
router.post('/respond', async (req, res) => {
    const db = req.db;
    const userId = req.session.userId;
    const { requestId, action } = req.body;

    try {
        if (!['accepted', 'declined'].includes(action)) return res.status(400).send('Invalid action.');

        // Check ownership
        const [[request]] = await db.execute('SELECT * FROM mentorship_requests WHERE id = ?', [requestId]);
        if (!request || request.receiver_id !== userId) return res.status(403).send('Unauthorized.');

        await db.execute('UPDATE mentorship_requests SET status = ? WHERE id = ?', [action, requestId]);

        if (action === 'accepted') {
            const mentorId = request.sender_id;
            const menteeId = request.receiver_id;
            await db.execute('INSERT INTO connections (mentor_id, mentee_id) VALUES (?, ?)', [mentorId, menteeId]);
        }

        res.send('Response recorded.');
    } catch (err) {
        res.status(500).send('Server error.');
    }
});

module.exports = router;