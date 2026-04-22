const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Global Leaderboard Data (In-memory for now)
let globalLeaderboard = [
    { name: "Maxxx", score: 30.00 },
    { name: "ProDribbler", score: 25.50 },
    { name: "AeroKing", score: 20.20 }
];

// Get leaderboard
app.get('/api/leaderboard', (req, res) => {
    res.json(globalLeaderboard);
});

// Submit score
app.post('/api/leaderboard', (req, res) => {
    const { name, score } = req.body;
    
    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: "Invalid data" });
    }

    // Check if player already exists
    const existingIndex = globalLeaderboard.findIndex(e => e.name === name);
    
    if (existingIndex !== -1) {
        // Only update if it's a new personal best
        if (score > globalLeaderboard[existingIndex].score) {
            globalLeaderboard[existingIndex].score = score;
        }
    } else {
        // New player
        globalLeaderboard.push({ name, score });
    }

    // Sort and keep top 50
    globalLeaderboard.sort((a, b) => b.score - a.score);
    globalLeaderboard = globalLeaderboard.slice(0, 50);

    res.json({ success: true, leaderboard: globalLeaderboard });
});

// Serve the game
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});