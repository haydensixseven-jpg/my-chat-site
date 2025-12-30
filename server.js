const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONNECT TO DATABASE ---
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('TikSnap DB Connected Successfully'))
    .catch(err => console.error('DB Connection Error:', err));

// --- DATABASE MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    email: String,
    dob: String,
    profilePic: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' }
});

const MessageSchema = new mongoose.Schema({
    user: String,
    text: String,
    pfp: String,
    timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static('public'));
app.use(express.json());

let onlineUsers = {}; 

// --- AUTHENTICATION ---
app.post('/auth', async (req, res) => {
    const { username, password, email, dob, pfp, type } = req.body;
    try {
        if (type === 'signup') {
            const existing = await User.findOne({ username });
            if (existing) return res.json({ success: false, message: "Username taken" });
            const newUser = await User.create({ username, password, email, dob, profilePic: pfp || undefined });
            return res.json({ success: true, user: newUser });
        } 
        const user = await User.findOne({ username, password });
        if (user) return res.json({ success: true, user });
        res.json({ success: false, message: "Invalid Login Credentials" });
    } catch (err) { 
        res.json({ success: false, message: "Database Error" }); 
    }
});

// --- REAL-TIME CHAT ---
io.on('connection', async (socket) => {
    // This part sends the last 50 messages to the user when they join
    const history = await Message.find().sort({ _id: -1 }).limit(50);
    socket.emit('load-history', history.reverse());

    socket.on('join-chat', (userData) => {
        socket.user = userData;
        onlineUsers[socket.id] = userData;
        io.emit('update-user-list', Object.values(onlineUsers));
    });

    socket.on('chat-message', async (msg) => {
        if (!socket.user) return;
        const newMsg = await Message.create({ 
            user: socket.user.username, 
            text: msg, 
            pfp: socket.user.profilePic 
        });
        io.emit('chat-message', newMsg);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-user-list', Object.values(onlineUsers));
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
