const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const app = express();

// Handle large image data
app.use(express.json({ limit: '50mb' })); 
app.use(cors());
app.use(express.static('public'));

// --- CONNECT TO MONGODB ---
// Replace 'YOUR_MONGODB_URL' with the string from MongoDB Atlas
mongoose.connect('YOUR_MONGODB_URL')
    .then(() => console.log("Database Connected!"))
    .catch(err => console.error("Database Connection Error:", err));

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
    try {
        const newPost = new Post(req.body);
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: "Failed to post" });
    }
});

// Like/Reply routes... (Add these as needed)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
