const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const USERS_FILE = './users.json';
const MSGS_FILE = './messages.json';

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(MSGS_FILE)) fs.writeFileSync(MSGS_FILE, JSON.stringify([]));

app.use(express.static('public'));
app.use(express.json());

let onlineUsers = {};

// --- AUTH ROUTES ---
app.post('/auth', (req, res) => {
    const { username, password, email, dob, pfp, type } = req.body;
    let users = JSON.parse(fs.readFileSync(USERS_FILE));

    if (type === 'signup') {
        if (users[username]) return res.json({ success: false, message: "Username taken" });
        users[username] = { username, password, email, dob, profilePic: pfp || 'https://cdn-icons-png.flaticon.com/512/149/149071.png' };
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        return res.json({ success: true, user: users[username] });
    } 
    
    const user = users[username];
    if (user && user.password === password) {
        return res.json({ success: true, user });
    }
    res.json({ success: false, message: "Invalid Login" });
});

// --- SOCKET LOGIC ---
io.on('connection', (socket) => {
    // Load history from JSON file
    const history = JSON.parse(fs.readFileSync(MSGS_FILE));
    socket.emit('load-history', history.slice(-50));

    socket.on('join-chat', (userData) => {
        socket.user = userData;
        onlineUsers[socket.id] = userData;
        io.emit('update-user-list', Object.values(onlineUsers));
    });

    socket.on('chat-message', (msg) => {
        if (!socket.user) return;
        const newMsg = { 
            user: socket.user.username, 
            text: msg, 
            pfp: socket.user.profilePic,
            timestamp: new Date()
        };
        
        // Save to history file
        const history = JSON.parse(fs.readFileSync(MSGS_FILE));
        history.push(newMsg);
        fs.writeFileSync(MSGS_FILE, JSON.stringify(history.slice(-100), null, 2));

        io.emit('chat-message', newMsg);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-user-list', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`TikSnap Live (No Mongoose) on ${PORT}`));
