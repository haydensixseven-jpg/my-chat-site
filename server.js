const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connect DB Linked'))
    .catch(err => console.error(err));

const UserSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    profilePic: { type: String, default: () => `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}` },
    bio: { type: String, default: "Exploring the world of Connect." }
});

const MessageSchema = new mongoose.Schema({
    user: String, text: String, pfp: String, email: String, timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

app.use(express.static('public'));
app.use(express.json());

// Authentication Endpoints
app.post('/auth', async (req, res) => {
    const { email, password, firstName, lastName, type } = req.body;
    try {
        if (type === 'signup') {
            const exists = await User.findOne({ email });
            if (exists) return res.json({ success: false, message: "Email already registered." });
            const user = await User.create({ email, password, firstName, lastName });
            return res.json({ success: true, user });
        }
        const user = await User.findOne({ email, password });
        if (user) return res.json({ success: true, user });
        res.json({ success: false, message: "Invalid email or password." });
    } catch (e) { res.json({ success: false, message: "Server Error" }); }
});

let onlineUsers = {};
io.on('connection', async (socket) => {
    const history = await Message.find().sort({ _id: -1 }).limit(50);
    socket.emit('load-history', history.reverse());

    socket.on('join-chat', (user) => {
        socket.user = user;
        onlineUsers[socket.id] = user;
        io.emit('update-users', Object.values(onlineUsers));
    });

    socket.on('chat-msg', async (text) => {
        if (!socket.user) return;
        const msg = await Message.create({
            user: `${socket.user.firstName} ${socket.user.lastName}`,
            text, pfp: socket.user.profilePic, email: socket.user.email
        });
        io.emit('chat-msg', msg);
    });

    socket.on('disconnect', () => {
        delete onlineUsers[socket.id];
        io.emit('update-users', Object.values(onlineUsers));
    });
});

server.listen(process.env.PORT || 3000);
