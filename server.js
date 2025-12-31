const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

// --- ENSURE UPLOADS DIRECTORY EXISTS ---
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// --- FILE STORAGE CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        // Keeps original extension and adds a timestamp to prevent overwriting
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
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
    followers: { type: Array, default: [] },
    following: { type: Array, default: [] },
    totalLikes: { type: Number, default: 0 },
    bio: { type: String, default: "Entering the flow state. ✨" }
});

const VideoSchema = new mongoose.Schema({
    username: String,
    videoUrl: String,
    caption: String,
    likes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
    toUser: String,
    fromUser: String,
    type: String,
    message: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Video = mongoose.model('Video', VideoSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- ROUTES ---

// 1. Upload Video (Handles the actual file)
app.post('/api/upload', upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });
        
        const { username, caption } = req.body;
        const videoUrl = `/uploads/${req.file.filename}`;
        
        const newVideo = new Video({ username, videoUrl, caption });
        await newVideo.save();
        res.status(201).json(newVideo);
    } catch (err) {
        res.status(500).json({ error: "Upload logic failed: " + err.message });
    }
});

// 2. Profile Fetch (Crucial for profile.html)
app.get('/api/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) return res.status(404).json({ error: "User not found" });

        const videos = await Video.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json({ user, videos });
    } catch (err) {
        res.status(500).json({ error: "Database error fetching profile" });
    }
});

// 3. Follow System
app.post('/api/follow', async (req, res) => {
    try {
        const { currentUser, targetUser } = req.body;
        if (currentUser === targetUser) return res.status(400).json({ error: "Self-follow blocked" });

        await User.findOneAndUpdate({ username: currentUser }, { $addToSet: { following: targetUser } });
        await User.findOneAndUpdate({ username: targetUser }, { $addToSet: { followers: currentUser } });

        const notif = new Notification({
            toUser: targetUser,
            fromUser: currentUser,
            type: "follow",
            message: `${currentUser} started following you!`
        });
        await notif.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Follow system error" });
    }
});

// 4. Other Standard Routes
app.post('/api/signup', async (req, res) => {
    try {
        const newUser = new User(req.body);
        await newUser.save();
        res.status(201).json({ user: { username: newUser.username } });
    } catch (err) { res.status(400).json({ error: "Signup error" }); }
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json({ username: user.username });
    else res.status(401).json({ error: "Invalid login" });
});

app.get('/api/videos', async (req, res) => {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
});

app.listen(PORT, () => console.log(`📡 VikVok Live on Port ${PORT}`));
