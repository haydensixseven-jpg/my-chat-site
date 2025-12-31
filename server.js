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

// --- DATA SCHEMA ---
const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: { type: Array, default: [] },
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// --- ROUTES ---
app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    res.json(posts);
});

app.post('/api/posts', async (req, res) => {
    const newPost = new Post(req.body);
    await newPost.save();
    res.status(201).json(newPost);
});

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
    res.json(post);
});

// DELETE ROUTE: Only Owner or HaydenDev
app.post('/api/posts/delete', async (req, res) => {
    const { id, user } = req.body;
    const post = await Post.findById(id);
    if (post.user === user || user === "HaydenDev") {
        await Post.findByIdAndDelete(id);
        res.json({ success: true });
    } else {
        res.status(403).send("Unauthorized");
    }
});

// PIN ROUTE: HaydenDev only
app.post('/api/posts/pin', async (req, res) => {
    const { id, user } = req.body;
    if (user !== "HaydenDev") return res.status(403).send("Unauthorized");
    const post = await Post.findById(id);
    post.pinned = !post.pinned;
    await post.save();
    res.json(post);
});

app.listen(process.env.PORT || 3000);
