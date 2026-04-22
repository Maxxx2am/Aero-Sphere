const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
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
const DB_FILE = path.join(__dirname, 'leaderboard.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const socketRooms = {}; // Map: socketId -> roomID

// Global Leaderboard - Persistent storage
let globalLeaderboard = [];
if (fs.existsSync(DB_FILE)) {
    try {
        globalLeaderboard = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) { console.error("Error loading leaderboard:", e); }
}

function saveLeaderboard() {
    fs.writeFileSync(DB_FILE, JSON.stringify(globalLeaderboard, null, 2));
}

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

    const existingIndex = globalLeaderboard.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
    
    if (existingIndex !== -1) {
        if (score > globalLeaderboard[existingIndex].score) {
            globalLeaderboard[existingIndex].score = score;
        }
    } else {
        globalLeaderboard.push({ name, score });
    }

    globalLeaderboard.sort((a, b) => b.score - a.score);
    globalLeaderboard = globalLeaderboard.slice(0, 50);
    saveLeaderboard();

    res.json({ success: true, leaderboard: globalLeaderboard });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Multiplayer Socket Logic
io.on('connection', (socket) => {
    socket.on('joinRoom', (roomID) => {
        socket.join(roomID);
        socketRooms[socket.id] = roomID;
        socket.to(roomID).emit('userJoined', socket.id);
    });

    socket.on('syncGameState', (data) => {
        socket.to(data.roomID).emit('gameStateUpdate', data.state);
    });

    socket.on('playerInput', (data) => {
        socket.to(data.roomID).emit('remoteInput', data.keys);
    });

    socket.on('goalScored', (data) => {
        // Only send to the OTHER player to avoid double creation on Host
        socket.to(data.roomID).emit('playGoalAnimation', data);
    });

    socket.on('disconnect', () => {
        const roomID = socketRooms[socket.id];
        if (roomID) {
            socket.to(roomID).emit('opponentDisconnected');
            delete socketRooms[socket.id];
        }
    });
});

server.listen(PORT, () => {
    console.log(`Aero-Sphere V5 Server active on port ${PORT}`);
});