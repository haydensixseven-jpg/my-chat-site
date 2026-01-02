const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/live-chat';
mongoose.connect(mongoURI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// --- Database Schemas ---

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Member' }, // Roles: Member, Owner, Developer
    lastSeen: { type: Date, default: Date.now }
});

const messageSchema = new mongoose.Schema({
    user: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});

// New Schema for Secret Messages
const secretSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    recipient: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    revealed: { type: Boolean, default: false },
    revealRequestPending: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);
const Secret = mongoose.model('Secret', secretSchema);

// --- AUTHENTICATION ROUTES ---

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const userCount = await User.countDocuments();
        const role = userCount === 0 ? 'Developer' : 'Member';
        const newUser = new User({ username, email, password, role });
        await newUser.save();
        res.json({ success: true, user: { username, role } });
    } catch (err) {
        res.status(400).json({ success: false, message: "Username or Email already exists" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }],
            password: password 
        });
        if (user) {
            user.lastSeen = new Date();
            await user.save();
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// --- SECRET MESSAGING ROUTES ---

// Send a secret message
app.post('/api/secrets', async (req, res) => {
    try {
        const { sender, recipient, message } = req.body;
        const target = await User.findOne({ username: recipient });
        if (!target) return res.status(404).json({ success: false, message: "Recipient not found." });

        const newSecret = new Secret({ sender, recipient, message });
        await newSecret.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// Get inbox for a user
app.get('/api/secrets/inbox', async (req, res) => {
    try {
        const { username } = req.query;
        const secrets = await Secret.find({ recipient: username }).sort({ timestamp: -1 });
        res.json(secrets);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Request to reveal identity
app.post('/api/secrets/reveal-request', async (req, res) => {
    try {
        const { secretId } = req.body;
        await Secret.findByIdAndUpdate(secretId, { revealRequestPending: true });
        res.json({ success: true, message: "Reveal request sent to sender." });
    } catch (err) {
        res.status(500).send(err);
    }
});

// Check for any pending reveal requests (Polled by all tabs)
app.get('/api/secrets/check-requests', async (req, res) => {
    try {
        const { username } = req.query;
        const pending = await Secret.findOne({ sender: username, revealRequestPending: true, revealed: false });
        if (pending) {
            res.json({ 
                pendingRequest: true, 
                secretId: pending._id, 
                requester: pending.recipient, 
                message: pending.message 
            });
        } else {
            res.json({ pendingRequest: false });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// Respond to a reveal request
app.post('/api/secrets/respond-reveal', async (req, res) => {
    try {
        const { secretId, approved } = req.body;
        if (approved) {
            await Secret.findByIdAndUpdate(secretId, { revealed: true, revealRequestPending: false });
        } else {
            await Secret.findByIdAndUpdate(secretId, { revealRequestPending: false });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).send(err);
    }
});

// --- CHAT & USER STATUS ROUTES ---

app.get('/api/messages', async (req, res) => {
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(50);
        res.json(messages);
    } catch (err) {
        res.status(500).send(err);
    }
});

app.post('/api/messages', async (req, res) => {
    try {
        const newMessage = new Message(req.body);
        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (err) {
        res.status(400).send(err);
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username role lastSeen');
        const now = Date.now();
        const statusUsers = users.map(u => ({
            username: u.username,
            role: u.role,
            isOnline: (now - new Date(u.lastSeen).getTime()) < 30000
        }));
        res.json(statusUsers);
    } catch (err) {
        res.status(500).send(err);
    }
});

// Admin Rank Update
app.put('/api/admin/rank', async (req, res) => {
    try {
        const { adminUsername, targetUsername, newRole } = req.body;
        const admin = await User.findOne({ username: adminUsername });
        if (!admin || (admin.role !== 'Developer' && admin.role !== 'Owner')) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }
        const target = await User.findOneAndUpdate({ username: targetUsername }, { role: newRole }, { new: true });
        res.json({ success: true, user: { username: target.username, role: target.role } });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});

// --- PAGE ROUTING ---
app.get('/themes', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'themes.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/secret', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'secret.html'));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
