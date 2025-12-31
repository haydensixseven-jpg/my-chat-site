/**
 * SKETCHDASH PRO - BACKEND ENGINE
 * A high-performance Socket.io server for multiplayer drawing combat.
 * * Features: 
 * - Automated Room Scaling
 * - Game State Management
 * - Scoring & Economy Persistence (Simulated)
 * - Anti-Cheat Guess Validation
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// --- CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_PER_ROOM = 8;
const ROUND_TIME = 60; // Seconds
const SELECTION_TIME = 15;
const RESULT_TIME = 8;
const WORDS_DATABASE = [
    "APPLE", "GUITAR", "ELEPHANT", "PIZZA", "BICYCLE", "AIRPLANE", "DRAGON", "CHESS", 
    "VOLCANO", "LIGHTHOUSE", "PENGUIN", "SUBMARINE", "EINSTEIN", "SKYSCRAPER", "MEDUSA", 
    "FIREWORKS", "ASTRONAUT", "CAVE", "ZEBRA", "DIAMOND", "SANDWICH", "WIZARD", "CASTLE"
];

// --- GAME STATE STORAGE ---
// Key: Room ID, Value: Room Object
const rooms = new Map();

/**
 * Game Room Class
 * Manages the lifecycle of a single game instance
 */
class GameRoom {
    constructor(id) {
        this.id = id;
        this.players = [];
        this.state = 'WAITING'; // WAITING, STARTING, PICKING, DRAWING, RESULTS
        this.timer = 0;
        this.timerInterval = null;
        this.currentRound = 0;
        this.totalRounds = 5;
        this.currentWord = "";
        this.drawerIndex = -1;
        this.winnersThisRound = [];
        this.canvasData = []; // To sync new joiners
    }

    addPlayer(socket, username, profile) {
        const player = {
            id: socket.id,
            username: username || `Artist_${Math.floor(Math.random() * 9000)}`,
            score: 0,
            inkEarned: 0,
            profile: profile || { avatar: '🐱', accessory: '👑' },
            hasGuessed: false
        };
        this.players.push(player);
        return player;
    }

    removePlayer(socketId) {
        const index = this.players.findIndex(p => p.id === socketId);
        if (index !== -1) {
            const wasDrawer = (index === this.drawerIndex);
            this.players.splice(index, 1);
            
            // Adjust drawer index if needed
            if (index < this.drawerIndex) this.drawerIndex--;
            
            if (this.players.length < 2 && this.state !== 'WAITING') {
                this.resetToLobby("Not enough players left.");
            } else if (wasDrawer && this.state === 'DRAWING') {
                this.nextTurn();
            }
        }
    }

    broadcast(event, data) {
        io.to(this.id).emit(event, data);
    }

    start() {
        if (this.players.length < 2) return;
        this.state = 'STARTING';
        this.currentRound = 1;
        this.broadcast('game_starting', { rounds: this.totalRounds });
        setTimeout(() => this.nextTurn(), 3000);
    }

    nextTurn() {
        this.winnersThisRound = [];
        this.players.forEach(p => p.hasGuessed = false);
        this.drawerIndex = (this.drawerIndex + 1) % this.players.length;
        
        const drawer = this.players[this.drawerIndex];
        this.state = 'PICKING';
        this.canvasData = [];
        this.broadcast('clear_canvas');
        
        // Pick 3 random words
        const choices = [...WORDS_DATABASE].sort(() => 0.5 - Math.random()).slice(0, 3);
        
        this.broadcast('new_turn', {
            drawerId: drawer.id,
            drawerName: drawer.username,
            round: this.currentRound
        });

        io.to(drawer.id).emit('pick_word', { choices });
        this.startTimer(SELECTION_TIME, () => {
            if (this.state === 'PICKING') {
                this.beginDrawing(choices[0]); // Auto-pick first word
            }
        });
    }

    beginDrawing(word) {
        this.currentWord = word.toUpperCase();
        this.state = 'DRAWING';
        this.broadcast('drawing_started', {
            wordLength: word.length,
            hint: "Starting soon..." 
        });

        this.startTimer(ROUND_TIME, () => this.endRound());
    }

    handleGuess(socketId, text) {
        if (this.state !== 'DRAWING') return;
        const player = this.players.find(p => p.id === socketId);
        if (!player || player.hasGuessed || this.players[this.drawerIndex].id === socketId) return;

        if (text.toUpperCase() === this.currentWord) {
            player.hasGuessed = true;
            
            // Scoring logic: earlier guesses get more points
            const timeBonus = Math.ceil((this.timer / ROUND_TIME) * 500);
            const score = 100 + timeBonus;
            player.score += score;
            player.inkEarned += Math.floor(score / 10);
            
            this.winnersThisRound.push({
                username: player.username,
                score: score
            });

            this.broadcast('correct_guess', { 
                userId: socketId, 
                username: player.username 
            });

            // Check if everyone has guessed
            const guessers = this.players.filter((p, idx) => idx !== this.drawerIndex);
            if (guessers.every(p => p.hasGuessed)) {
                this.endRound();
            }
        } else {
            this.broadcast('chat_msg', { 
                user: player.username, 
                text: text, 
                type: 'user' 
            });
        }
    }

    endRound() {
        clearInterval(this.timerInterval);
        this.state = 'RESULTS';
        
        // Award drawer points if people guessed
        if (this.winnersThisRound.length > 0) {
            const drawer = this.players[this.drawerIndex];
            const drawerBonus = this.winnersThisRound.length * 50;
            drawer.score += drawerBonus;
            drawer.inkEarned += Math.floor(drawerBonus / 10);
        }

        this.broadcast('round_results', {
            word: this.currentWord,
            winners: this.winnersThisRound,
            scores: this.players.map(p => ({ id: p.id, score: p.score }))
        });

        setTimeout(() => {
            if (this.currentRound >= this.totalRounds) {
                this.endGame();
            } else {
                this.currentRound++;
                this.nextTurn();
            }
        }, RESULT_TIME * 1000);
    }

    endGame() {
        const sorted = [...this.players].sort((a, b) => b.score - a.score);
        this.broadcast('game_over', { 
            podium: sorted.slice(0, 3) 
        });
        
        setTimeout(() => this.resetToLobby(), 10000);
    }

    resetToLobby(reason) {
        clearInterval(this.timerInterval);
        this.state = 'WAITING';
        this.currentRound = 0;
        this.drawerIndex = -1;
        this.players.forEach(p => p.score = 0);
        this.broadcast('lobby_return', { message: reason });
    }

    startTimer(seconds, callback) {
        clearInterval(this.timerInterval);
        this.timer = seconds;
        this.broadcast('timer_sync', { seconds: this.timer });
        
        this.timerInterval = setInterval(() => {
            this.timer--;
            this.broadcast('timer_sync', { seconds: this.timer });
            
            if (this.timer <= 0) {
                clearInterval(this.timerInterval);
                callback();
            }
        }, 1000);
    }
}

// --- SOCKET HANDLERS ---
io.on('connection', (socket) => {
    console.log(`[CONN] New client connected: ${socket.id}`);

    socket.on('join_game', ({ username, profile }) => {
        let roomToJoin = null;

        // Simple matchmaking: find an existing room with space
        for (const [id, room] of rooms) {
            if (room.players.length < MAX_PLAYERS_PER_ROOM && room.state === 'WAITING') {
                roomToJoin = room;
                break;
            }
        }

        // Or create a new one
        if (!roomToJoin) {
            const roomId = `ROOM_${Math.random().toString(36).substr(2, 9)}`;
            roomToJoin = new GameRoom(roomId);
            rooms.set(roomId, roomToJoin);
        }

        socket.join(roomToJoin.id);
        const player = roomToJoin.addPlayer(socket, username, profile);
        
        socket.emit('joined_room', { 
            roomId: roomToJoin.id, 
            players: roomToJoin.players,
            state: roomToJoin.state
        });

        socket.to(roomToJoin.id).emit('player_joined', player);

        // If enough players, start the game
        if (roomToJoin.players.length >= 2 && roomToJoin.state === 'WAITING') {
            roomToJoin.start();
        }
    });

    socket.on('draw_op', (data) => {
        const roomId = Array.from(socket.rooms)[1];
        if (roomId) {
            socket.to(roomId).emit('draw_op', data);
        }
    });

    socket.on('clear_canvas', () => {
        const roomId = Array.from(socket.rooms)[1];
        if (roomId) socket.to(roomId).emit('clear_canvas');
    });

    socket.on('chat_msg', (text) => {
        const roomId = Array.from(socket.rooms)[1];
        const room = rooms.get(roomId);
        if (room) {
            room.handleGuess(socket.id, text);
        }
    });

    socket.on('word_selected', ({ word }) => {
        const roomId = Array.from(socket.rooms)[1];
        const room = rooms.get(roomId);
        if (room && room.state === 'PICKING') {
            room.beginDrawing(word);
        }
    });

    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            const room = rooms.get(roomId);
            if (room) {
                room.removePlayer(socket.id);
                socket.to(roomId).emit('player_left', { id: socket.id });
                
                // Cleanup empty rooms
                if (room.players.length === 0) {
                    rooms.delete(roomId);
                }
            }
        }
    });
});

// Serve static assets if in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static('client/build'));
    app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
    });
}

server.listen(PORT, () => {
    console.log(`
    ===========================================
    SKETCHDASH PRO SERVER RUNNING
    Port: ${PORT}
    Status: Online & Healthy
    ===========================================
    `);
});
