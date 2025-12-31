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
    destination: (req, file, cb) => { cb(null, 'public/uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
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
    likes: { type: Array, default: [] }, // Changed to Array to store usernames of people who liked
    comments: [{
        username: String,
        text: String,
        createdAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
    toUser: String,
    fromUser: String,
    type: String, // "follow", "like", "comment"
    message: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Video = mongoose.model('Video', VideoSchema);
const Notification = mongoose.model('Notification', NotificationSchema);

// --- ROUTES ---

// 1. Upload Video
app.post('/api/upload', upload.single('videoFile'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file" });
        const { username, caption } = req.body;
        const newVideo = new Video({ username, videoUrl: `/uploads/${req.file.filename}`, caption });
        await newVideo.save();
        res.status(201).json(newVideo);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Like/Unlike Video
app.post('/api/videos/:id/like', async (req, res) => {
    try {
        const { username } = req.body;
        const video = await Video.findById(req.params.id);
        const videoOwner = video.username;

        if (video.likes.includes(username)) {
            // UNLIKE
            video.likes = video.likes.filter(name => name !== username);
            await User.findOneAndUpdate({ username: videoOwner }, { $inc: { totalLikes: -1 } });
        } else {
            // LIKE
            video.likes.push(username);
            await User.findOneAndUpdate({ username: videoOwner }, { $inc: { totalLikes: 1 } });
            
            // Notification
            if (username !== videoOwner) {
                const notif = new Notification({
                    toUser: videoOwner,
                    fromUser: username,
                    type: "like",
                    message: `${username} liked your video!`
                });
                await notif.save();
            }
        }
        await video.save();
        res.json({ likes: video.likes.length, isLiked: video.likes.includes(username) });
    } catch (err) { res.status(500).json({ error: "Like failed" }); }
});

// 3. Comment on Video
app.post('/api/videos/:id/comment', async (req, res) => {
    try {
        const { username, text } = req.body;
        const video = await Video.findById(req.params.id);
        
        const newComment = { username, text };
        video.comments.push(newComment);
        await video.save();

        if (username !== video.username) {
            const notif = new Notification({
                toUser: video.username,
                fromUser: username,
                type: "comment",
                message: `${username} commented: ${text.substring(0, 20)}...`
            });
            await notif.save();
        }
        res.json(video.comments);
    } catch (err) { res.status(500).json({ error: "Comment failed" }); }
});

// 4. Profile Fetch
app.get('/api/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        const videos = await Video.find({ username: req.params.username }).sort({ createdAt: -1 });
        res.json({ user, videos });
    } catch (err) { res.status(500).json({ error: "Profile error" }); }
});

// 5. Follow System
app.post('/api/follow', async (req, res) => {
    try {
        const { currentUser, targetUser } = req.body;
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
    } catch (err) { res.status(500).json({ error: "Follow error" }); }
} );

// 6. Standard Auth/Feed
app.post('/api/signup', async (req, res) => {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({ user: { username: newUser.username } });
});

app.post('/api/login', async (req, res) => {
    const user = await User.findOne({ email: req.body.email, password: req.body.password });
    if (user) res.json({ username: user.username });
    else res.status(401).json({ error: "Invalid" });
});

app.get('/api/videos', async (req, res) => {
    const videos = await Video.find().sort({ createdAt: -1 });
    res.json(videos);
});

app.get('/api/notifications/:username', async (req, res) => {
    const notifs = await Notification.find({ toUser: req.params.username }).sort({ createdAt: -1 });
    res.json(notifs);
});

app.listen(PORT, () => console.log(`📡 VikVok Live on Port ${PORT}`));
