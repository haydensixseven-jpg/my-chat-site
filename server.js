const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json({ limit: '100mb' }));
app.use(cors());
app.use(express.static('public'));

// --- DB CONNECTION ---
const MONGO_URI = 'mongodb+srv://hayden:123password123@cluster0.kzhhujn.mongodb.net/nyatter?retryWrites=true&w=majority&appName=Cluster0'; 
mongoose.connect(MONGO_URI).then(() => console.log("✅ Nyatter Database Online"));

// --- SCHEMAS ---
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: { type: String },
    pfp: { type: String, default: "default.png" }, // Default PFP logic
    rank: { type: String, default: "Member" }, // mod, admin, superadmin, owner, dev
    joinedAt: { type: Number, default: Date.now }
}));

const Post = mongoose.model('Post', new mongoose.Schema({
    user: String,
    userPfp: String,
    userRank: String, // Store rank at time of post for display
    text: String,
    img: String,
    likes: { type: Array, default: [] },
    replies: [{
        user: String,
        userPfp: String,
        userRank: String,
        text: String,
        timestamp: { type: Number, default: Date.now }
    }],
    pinned: { type: Boolean, default: false },
    timestamp: { type: Number, default: Date.now }
}));

// --- ROUTES ---

// Promotion Route (Triggered by your console command)
app.post('/api/admin/promote', async (req, res) => {
    const { targetUser, rank, requester } = req.body;
    
    // Safety check: Only an 'owner' or 'dev' can promote others
    const admin = await User.findOne({ username: requester });
    if (!admin || !['owner', 'dev'].includes(admin.rank.toLowerCase())) {
        return res.status(403).json({ error: "Insufficient permissions to promote." });
    }

    const validRanks = ['mod', 'admin', 'superadmin', 'owner', 'dev', 'member'];
    if (!validRanks.includes(rank.toLowerCase())) {
        return res.status(400).json({ error: "Invalid rank specified." });
    }

    await User.updateOne({ username: targetUser }, { rank: rank });
    res.json({ success: true, message: `${targetUser} promoted to ${rank}` });
});

// Post Logic with Rank Support
app.post('/api/posts', async (req, res) => {
    const { user, text, img } = req.body;
    const userData = await User.findOne({ username: user });
    
    // Ensure default PFP if none exists
    const finalPfp = (userData.pfp && userData.pfp !== "") ? userData.pfp : "default.png";

    const post = new Post({ 
        user, 
        userPfp: finalPfp, 
        userRank: userData.rank, 
        text, 
        img 
    });
    await post.save();
    res.status(201).json(post);
});

// Signup with Default PFP Fallback
app.post('/api/signup', async (req, res) => {
    const { username, email, password, pfp } = req.body;
    const isFirstAccount = username === "HaydenDev";
    
    const newUser = new User({ 
        username, 
        email, 
        password, 
        pfp: pfp || "default.png", 
        rank: isFirstAccount ? "dev" : "Member" 
    });
    
    await newUser.save();
    res.json({ success: true, user: newUser });
});

app.post('/api/login', async (req, res) => {
    const { identifier, password } = req.body;
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier }] });
    if (!user || user.password !== password) return res.status(401).json({ error: "Invalid" });
    res.json({ success: true, user });
});

app.get('/api/posts', async (req, res) => {
    const posts = await Post.find().sort({ pinned: -1, timestamp: -1 });
    res.json(posts);
});

app.get('/api/users', async (req, res) => {
    const users = await User.find({}, 'username pfp rank');
    res.json(users);
});

// Optimized Admin Actions based on Rank
app.post('/api/admin/action', async (req, res) => {
    const { adminUser, action, targetId } = req.body;
    const user = await User.findOne({ username: adminUser });
    if (!user) return res.status(403).send("Denied");

    const r = user.rank.toLowerCase();

    if (action === 'DELETE_POST' && ['mod', 'admin', 'superadmin', 'owner', 'dev'].includes(r)) {
        await Post.findByIdAndDelete(targetId);
        return res.json({ success: true });
    }
    
    if (action === 'TOGGLE_PIN' && ['admin', 'superadmin', 'owner', 'dev'].includes(r)) {
        const p = await Post.findById(targetId);
        p.pinned = !p.pinned;
        await p.save();
        return res.json({ success: true });
    }

    if (action === 'WIPE_ALL' && ['owner', 'dev'].includes(r)) {
        await User.deleteMany({});
        await Post.deleteMany({});
        return res.json({ success: true });
    }

    res.status(403).json({ error: "Rank too low for this action." });
});

app.listen(3000, () => console.log("🚀 Server running on port 3000"));
