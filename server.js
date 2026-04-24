const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'leaderboard.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Global Leaderboard - Persistent storage
let leaderboards = {
    dribble: [],
    trials: []
};

if (fs.existsSync(DB_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (Array.isArray(data)) {
            leaderboards.dribble = data;
        } else {
            leaderboards = { ...leaderboards, ...data };
        }
    } catch (e) { console.error("Error loading leaderboard:", e); }
}

function saveLeaderboard() {
    fs.writeFileSync(DB_FILE, JSON.stringify(leaderboards, null, 2));
}

// API to get all scores
app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboards);
});

// API to submit a new score
app.post('/api/leaderboard', (req, res) => {
    const { name, score, category } = req.body;
    const key = category === 'trials' ? 'trials' : 'dribble';
    
    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: "Invalid data" });
    }

    const currentBoard = leaderboards[key];
    const existingIndex = currentBoard.findIndex(e => e.name.toLowerCase() === name.toLowerCase());
    
    if (existingIndex !== -1) {
        if (score > currentBoard[existingIndex].score) {
            currentBoard[existingIndex].score = score;
        }
    } else {
        currentBoard.push({ name, score });
    }

    currentBoard.sort((a, b) => b.score - a.score);
    leaderboards[key] = currentBoard.slice(0, 50);
    saveLeaderboard();

    res.json({ success: true, leaderboards });
});

let socketRooms = {};
let rooms = {};

io.on('connection', (socket) => {
    socket.on('joinRoom', (roomID) => {
        socket.join(roomID);
        socketRooms[socket.id] = roomID;
        if (!rooms[roomID]) rooms[roomID] = new Set();
        rooms[roomID].add(socket.id);
        socket.to(roomID).emit('userJoined');
    });

    socket.on('getRooms', () => {
        const open = Object.entries(rooms)
            .filter(([, sockets]) => sockets.size === 1)
            .map(([id]) => id);
        socket.emit('roomsList', open);
    });

    socket.on('playerInput', (data) => {
        socket.to(data.roomID).emit('remoteInput', data.keys);
    });

    socket.on('syncGameState', (data) => {
        socket.to(data.roomID).emit('gameStateUpdate', data.state);
    });

    socket.on('goalScored', (data) => {
        socket.to(data.roomID).emit('playGoalAnimation', data);
    });

    socket.on('disconnect', () => {
        const roomID = socketRooms[socket.id];
        if (roomID) {
            socket.to(roomID).emit('opponentDisconnected');
            delete socketRooms[socket.id];
            if (rooms[roomID]) {
                rooms[roomID].delete(socket.id);
                if (rooms[roomID].size === 0) delete rooms[roomID];
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Aero-Sphere V5 Server active on port ${PORT}`);
});
