const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// MongoDB Connection
// Note: In a production environment, use process.env.MONGO_URI
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chat-app';
mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Member', enum: ['Member', 'Owner', 'Developer'] },
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// --- Auth Routes ---

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username or Email already taken' });
        }

        // Simple password storage (use bcrypt in production!)
        const newUser = new User({ username, email, password, isOnline: true });
        await newUser.save();

        res.json({ 
            success: true, 
            user: { username: newUser.username, role: newUser.role, email: newUser.email } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // identifier can be username or email
        
        const user = await User.findOne({ 
            $or: [{ username: identifier }, { email: identifier }],
            password: password 
        });

        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        user.isOnline = true;
        user.lastActive = Date.now();
        await user.save();

        res.json({ 
            success: true, 
            user: { username: user.username, role: user.role, email: user.email } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error during login' });
    }
});

// --- User Management Routes ---

// Get all users for the sidebar & admin panel
app.get('/api/users', async (req, res) => {
    try {
        // In a real app, we might filter isOnline recently or use WebSockets
        const users = await User.find({}, 'username role isOnline');
        res.json(users);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Error fetching users' });
    }
});

// Update Rank (Admin Only)
app.put('/api/admin/rank', async (req, res) => {
    try {
        const { adminUsername, targetUsername, newRole } = req.body;

        // Verify admin
        const admin = await User.findOne({ username: adminUsername });
        if (!admin || (admin.role !== 'Developer' && admin.role !== 'Owner')) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }

        const target = await User.findOneAndUpdate(
            { username: targetUsername },
            { role: newRole },
            { new: true }
        );

        if (!target) return res.status(404).json({ success: false, message: 'User not found' });

        res.json({ success: true, message: `Rank updated for ${targetUsername}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error updating rank' });
    }
});

// Delete User (Admin Only)
app.delete('/api/admin/users/:username', async (req, res) => {
    try {
        const { adminUsername } = req.query;
        const targetUsername = req.params.username;

        const admin = await User.findOne({ username: adminUsername });
        if (!admin || (admin.role !== 'Developer' && admin.role !== 'Owner')) {
            return res.status(403).json({ success: false, message: 'Insufficient permissions' });
        }

        await User.findOneAndDelete({ username: targetUsername });
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error deleting user' });
    }
});

// Serving the app
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
