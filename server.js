const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

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

// Multiplayer Socket Logic
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', (roomID) => {
        socket.join(roomID);
        console.log(`User ${socket.id} joined room ${roomID}`);
        
        // Notify the room that someone joined
        socket.to(roomID).emit('userJoined', socket.id);
    });

    // Simple "screen share" style sync: broadcast state to others in room
    socket.on('syncGameState', (data) => {
        // data contains ball/player positions, scores, etc.
        socket.to(data.roomID).emit('gameStateUpdate', data.state);
    });

    // Broadcast inputs to others to simulate shared control
    socket.on('playerInput', (data) => {
        socket.to(data.roomID).emit('remoteInput', data.keys);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Aero-Sphere V5 Server active on port ${PORT}`);
});