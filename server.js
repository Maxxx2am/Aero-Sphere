const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Optimized socket.io for low latency
const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 2000,
    pingTimeout: 5000,
    transports: ['websocket'], // websocket only — no polling fallback for speed
    perMessageDeflate: false   // disable compression for lower latency
});

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'leaderboard.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Global Leaderboard - Persistent storage
let leaderboards = { dribble: [], trials: [], rise: [] };

if (fs.existsSync(DB_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (Array.isArray(data)) {
            leaderboards.dribble = data;
        } else {
            leaderboards = { dribble: [], trials: [], rise: [], ...data };
        }
    } catch (e) { console.error("Error loading leaderboard:", e); }
}

function saveLeaderboard() {
    fs.writeFileSync(DB_FILE, JSON.stringify(leaderboards, null, 2));
}

app.get('/api/leaderboard', (req, res) => {
    res.json(leaderboards);
});

app.post('/api/leaderboard', (req, res) => {
    const { name, score, category } = req.body;
    let key = 'dribble';
    if (category === 'trials') key = 'trials';
    else if (category === 'rise') key = 'rise';

    if (!name || typeof score !== 'number') {
        return res.status(400).json({ error: "Invalid data" });
    }

    if (!leaderboards[key]) leaderboards[key] = [];
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
    console.log(`+ connect ${socket.id}`);

    socket.on('joinRoom', (roomID) => {
        socket.join(roomID);
        socketRooms[socket.id] = roomID;
        if (!rooms[roomID]) rooms[roomID] = new Set();
        rooms[roomID].add(socket.id);
        socket.to(roomID).emit('userJoined');
        console.log(`  ${socket.id} joined room ${roomID} (${rooms[roomID].size} players)`);
    });

    socket.on('getRooms', () => {
        const open = Object.entries(rooms)
            .filter(([, sockets]) => sockets.size === 1)
            .map(([id]) => id);
        socket.emit('roomsList', open);
    });

    // Input relay: host receives client inputs with minimal processing
    socket.on('playerInput', (data) => {
        socket.to(data.roomID).emit('remoteInput', data.keys);
    });

    // State sync: client receives full game state from host
    socket.on('syncGameState', (data) => {
        socket.to(data.roomID).emit('gameStateUpdate', data.state);
    });

    socket.on('goalScored', (data) => {
        socket.to(data.roomID).emit('playGoalAnimation', data);
    });

    socket.on('disconnect', () => {
        const roomID = socketRooms[socket.id];
        console.log(`- disconnect ${socket.id} (room: ${roomID})`);
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
    console.log(`Aero-Sphere Server on port ${PORT} [WebSocket-only, low-latency mode]`);
});