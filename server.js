const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// --- MONGODB CONNECTION ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected")).catch(err => console.log(err));

// --- DATA SCHEMAS ---
const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    joinedAt: { type: Number, default: Date.now }
}));

const Notification = mongoose.model('Notification', new mongoose.Schema({
    toUser: String,
    fromUser: String,
    type: { type: String, default: 'tag' },
    read: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// --- HELPERS ---
const handleTags = async (text, fromUser) => {
    const tags = text.match(/@(\w+)/g);
    if (tags) {
        for (let tag of tags) {
            const toUser = tag.replace('@', '');
            if (toUser !== fromUser) {
                await new Notification({ toUser, fromUser }).save();
            }
        }
    }
};

// --- ROUTES ---

// Auth & Users
app.post('/api/signup', async (req, res) => {
    try {
        const { username } = req.body;
        const user = new User({ username });
        await user.save();
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: "User exists" }); }
});

app.get('/api/users', async (req, res) => {
    const users = await User.find().sort({ joinedAt: -1 });
    res.json(users);
});

// Posts
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    const newPost = new Post(req.body);
    await newPost.save();
    await handleTags(req.body.text, req.body.user);
    res.status(201).json(newPost);
});

// Notifications
app.get('/api/notifications/:user', async (req, res) => {
    const notifs = await Notification.find({ toUser: req.params.user, read: false });
    res.json(notifs);
});

app.post('/api/notifications/clear', async (req, res) => {
    await Notification.findByIdAndDelete(req.body.id);
    res.json({ success: true });
});

// Social Actions
app.post('/api/posts/like', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    post.likes.includes(user) ? post.likes = post.likes.filter(u => u !== user) : post.likes.push(user);
    await post.save();
    res.json(post);
});

app.post('/api/posts/reply', async (req, res) => {
    const { id, user, text } = req.body;
    const post = await Post.findById(id);
    post.replies.push({ user, text });
    await post.save();
    await handleTags(text, user);
    res.json(post);
});

// Dev Controls
app.post('/api/posts/delete', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if (post.user === user || user === "HaydenDev") {
        await Post.findByIdAndDelete(id);
        res.json({ success: true });
    } else { res.status(403).send("Unauthorized"); }
});

app.post('/api/posts/pin', async (req, res) => {
    const { id, user } = req.body;
    if (user !== "HaydenDev") return res.status(403).send("Unauthorized");
    const post = await Post.findById(id);
    post.pinned = !post.pinned;
    await post.save();
    res.json(post);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Nyatter Core Live on ${PORT}`));
