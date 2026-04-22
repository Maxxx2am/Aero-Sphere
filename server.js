const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Global Leaderboard - Starts fresh and shared for everyone
let globalLeaderboard = [];

// API to get all scores
app.get('/api/leaderboard', (req, res) => {
    res.json(globalLeaderboard);
});

// API to submit a new score
app.post('/api/leaderboard', (req, res) => {
    const { name, score } = req.body;
    
    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: "Invalid data" });
    }

    // Merge logic: only keep personal best for each name
    const existingIndex = globalLeaderboard.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
    
    if (existingIndex !== -1) {
        if (score > globalLeaderboard[existingIndex].score) {
            globalLeaderboard[existingIndex].score = score;
        }
    } else {
        globalLeaderboard.push({ name, score });
    }

    // Sort: highest to lowest
    globalLeaderboard.sort((a, b) => b.score - a.score);
    globalLeaderboard = globalLeaderboard.slice(0, 50); // Keep top 50 global records

    res.json({ success: true, leaderboard: globalLeaderboard });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Global Hall of Fame active on port ${PORT}`);
});