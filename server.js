const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer'); // Added for file uploads

const app = express();
const PORT = process.env.PORT || 10000;

// --- STORAGE CONFIGURATION ---
// This saves uploaded videos into a folder named 'uploads'
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
// Allow the browser to access the uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- DATABASE CONNECTION ---
const mongoURI = process.env.MONGODB_URI;
mongoose.connect(mongoURI)
    .then(() => console.log("🚀 SUCCESS: VikVok Database Connected"))
    .catch(err => console.error("❌ CONNECTION FAILED:", err.message));

// --- DATA MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    followers: { type: Array, default: [] }, // Store usernames of followers
    following: { type: Array, default: [] }, // Store usernames of following
    totalLikes: { type: Number, default: 0 },
    bio: { type: String, default: "Entering the flow state. ✨" }
});

const NotificationSchema = new mongoose.Schema({
    toUser: String,
    fromUser: String,
    type: String, // "follow" or "like"
    message: String,
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const VideoSchema = new mongoose.Schema({
    username: String,
    videoUrl: String,
    caption: String,
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Video = mongoose.model('Video', VideoSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- API ROUTES ---

// 1. Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. File Upload Route (Replaces URL link upload)
app.post('/api/upload', upload.single('videoFile'), async (req, res) => {
    try {
        const { username, caption } = req.body;
        const videoUrl = `/uploads/${req.file.filename}`; // Path to the saved file
        const newVideo = new Video({ username, videoUrl, caption });
        await newVideo.save();
        res.status(201).json(newVideo);
    } catch (err) {
        res.status(500).json({ error: "Upload failed: " + err.message });
    }
});

// 3. Follow System & Notifications
app.post('/api/follow', async (req, res) => {
    const { currentUser, targetUser } = req.body;
    try {
        // Update Following list for current user
        await User.findOneAndUpdate({ username: currentUser }, { $addToSet: { following: targetUser } });
        // Update Followers list for target user
        await User.findOneAndUpdate({ username: targetUser }, { $addToSet: { followers: currentUser } });

        // Create Notification
        const notif = new Notification({
            toUser: targetUser,
            fromUser: currentUser,
            type: "follow",
            message: `${currentUser} has followed you!`
        });
        await notif.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Follow failed" });
    }
});

// 4. Fetch Notifications
app.get('/api/notifications/:username', async (req, res) => {
    const notifs = await Notification.find({ toUser: req.params.username }).sort({ createdAt: -1 });
    res.json(notifs);
});

// 5. Standard Routes (Login/Signup/Feed/Profile same as before)
app.post('/api/signup', async (req, res) => { /* Same logic */ });
app.post('/api/login', async (req, res) => { /* Same logic */ });
app.get('/api/videos', async (req, res) => { /* Same logic */ });
app.get('/api/profile/:username', async (req, res) => { /* Same logic */ });

app.listen(PORT, () => console.log(`📡 Server online at port ${PORT}`));
