const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- GAME DATA & CONFIGURATION ---
const WORDS = [
    "ASTRONAUT", "AVOCADO", "BACKPACK", "BALLOON", "BAMBOO", "BANANA", "BBQ", "BEACH", "BEAVER", "BEETLE", "BICYCLE", "BISCUIT", "BLANKET", "BLENDER", "BLIZZARD", "BLUEBERRY", "BOAT", "BOOT", "BOTTLE", "BOWL", "BRAIN", "BRIDGE", "BROCCOLI", "BROOM", "BUBBLE", "BUCKET", "BULLDOZER", "BURRITO", "BUTTERFLY", "CABIN", "CACTUS", "CAGE", "CAKE", "CALCULATOR", "CALENDAR", "CAMERA", "CAMPFIRE", "CANDLE", "CANNON", "CAPTAIN", "CARROT", "CASTLE", "CAT", "CATERPILLAR", "CAVE", "CELLO", "CHAINSAW", "CHAIR", "CHEESE", "CHEETAH", "CHERRY", "CHESS", "CHICKEN", "CHIMNEY", "CHOCOLATE", "CHURCH", "CIRCUS", "CLOCK", "CLOUD", "COFFEE", "COFFIN", "COMET", "COMPASS", "COMPUTER", "COOKIE", "CORN", "COWBOY", "CRAB", "CRAYON", "CROCODILE", "CROWN", "CRYSTAL", "CUPCAKE", "CURTAIN", "CYCLOPS", "DAGGER", "DAISY", "DENTIST", "DESERT", "DETECTIVE", "DIAMOND", "DINOSAUR", "DISCO", "DOCTOR", "DOG", "DOLPHIN", "DONUT", "DOOR", "DRAGON", "DRUM", "DUCK", "DYNAMITE", "EAGLE", "EARTH", "EGGPLANT", "EGYPT", "EINSTEIN", "ELEPHANT", "ELEVATOR", "EMERALD", "ENGINE", "ENVELOPE", "ERASER", "EXPLOSION", "EYE", "FACTORY", "FAIRY", "FAN", "FEATHER", "FENCE", "FIRE", "FIREWORKS", "FISH", "FLAG", "FLAMINGO", "FLASHLIGHT", "FLOWER", "FLUTE", "FOREST", "FORTRESS", "FOSSIL", "FOUNTAIN", "FOX", "FROG", "GALAXY", "GARAGE", "GARDEN", "GARLIC", "GENIE", "GHOST", "GIRAFFE", "GLACIER", "GLASSES", "GLOVE", "GOAT", "GOBLIN", "GOLD", "GOLF", "GORILLA", "GRAPE", "GRASS", "GRAVITY", "GREENHOUSE", "GUITAR", "HAMBURGER", "HAMMER", "HAMSTER", "HAND", "HARP", "HAT", "HELICOPTER", "HELMET", "HIPPO", "HONEY", "HORSE", "HOSPITAL", "HOT DOG", "HOUSE", "HURRICANE", "ICE CREAM", "ICEBERG", "IGLOO", "ISLAND", "JACKET", "JAIL", "JELLYFISH", "JET", "JOKER", "JOYSTICK", "JUNGLE", "KANGAROO", "KEY", "KEYBOARD", "KITE", "KITTEN", "KIWI", "KNIFE", "KNIGHT", "KOALA", "LADDER", "LAMP", "LANTERN", "LAPTOP", "LASER", "LAVA", "LEAF", "LEMON", "LEOPARD", "LIGHTBULB", "LIGHTHOUSE", "LIGHTNING", "LION", "LIPSTICK", "LIZARD", "LOBSTER", "LOLLIPOP", "LOTUS", "MAGNET", "MAGNIFYING GLASS", "MAILBOX", "MAP", "MARS", "MASK", "MAZE", "MECHANIC", "METEOR", "MICROSCOPE", "MICROWAVE", "MILK", "MILKSHAKE", "MIRROR", "MISSILE", "MONKEY", "MONSTER", "MOON", "MOSQUITO", "MOTORCYCLE", "MOUNTAIN", "MOUSE", "MOUTH", "MOVIE", "MUMMY", "MUSHROOM", "MUSIC", "NAIL", "NECKLACE", "NEEDLE", "NEST", "NET", "NEWSPAPER", "NIGHT", "NINJA", "NOSE", "NOTEBOOK", "NURSE", "NUT", "OCEAN", "OCTOPUS", "OFFICE", "OIL", "OLIVE", "ONION", "ORANGE", "ORCHESTRA", "OWL", "OYSTER", "PAINT", "PAINTER", "PAJAMAS", "PALACE", "PALM TREE", "PAN", "PANCAKE", "PANDA", "PAPER", "PARACHUTE", "PARK", "PARROT", "PARTY", "PASSPORT", "PASTA", "PEACOCK", "PEANUT", "PEAR", "PEN", "PENCIL", "PENGUIN", "PERFUME", "PERSON", "PHONE", "PIANO", "PICKAXE", "PICNIC", "PIE", "PIG", "PILLOW", "PILOT", "PINEAPPLE", "PING PONG", "PIPE", "PIRATE", "PIZZA", "PLANE", "PLANET", "PLANT", "PLATE", "PLATYPUS", "PLUM", "PLUMBER", "POCKET", "POISON", "POLICE", "POOL", "POPCORN", "POSTCARD", "POTATO", "POTION", "PRETZEL", "PRINTER", "PRISON", "PROJECTOR", "PUMPKIN", "PUPPY", "PYRAMID", "QUEEN", "RABBIT", "RACCOON", "RADIO", "RAIN", "RAINBOW", "RAT", "RAZOR", "REFRIGERATOR", "REMOTE", "RHINO", "RIBBON", "RING", "RIVER", "ROBOT", "ROCK", "ROCKET", "ROLLER COASTER", "ROOF", "ROOM", "ROOSTER", "ROPE", "ROSE", "RUBBER DUCK", "RUG", "RULER", "RUN", "SACK", "SAILBOAT", "SALAD", "SALAMANDER", "SALMON", "SAND", "SANDAL", "SANDCASTLE", "SANDWICH", "SATELLITE", "SATURN", "SAUSAGE", "SAXOPHONE", "SCARECROW", "SCARF", "SCHOOL", "SCISSORS", "SCORPION", "SCREEN", "SCREW", "SCREWDRIVER", "SEA", "SEAHORSE", "SEAL", "SEARCH", "SEASHELL", "SEED", "SHADOW", "SHAMPOO", "SHARK", "SHEEP", "SHELL", "SHIP", "SHIRT", "SHOE", "SHOP", "SHORTS", "SHOVEL", "SHOWER", "SHRIMP", "SKATEBOARD", "SKELETON", "SKI", "SKIRT", "SKULL", "SKUNK", "SKY", "SKYSCRAPER", "SLED", "SLEEP", "SLIDE", "SLOTH", "SLUG", "SNAIL", "SNAKE", "SNEAKER", "SNOW", "SNOWBALL", "SNOWFLAKE", "SNOWMAN", "SOAP", "SOCCER", "SOCK", "SODA", "SOFA", "SOLDIER", "SOUND", "SOUP", "SPACE", "SPACESHIP", "SPADE", "SPAGHETTI", "SPEAKER", "SPEAR", "SPECTACLES", "SPIDER", "SPONGE", "SPOON", "SPOTLIGHT", "SPRING", "SPY", "SQUARE", "SQUIRREL", "STADIUM", "STAGE", "STAIRS", "STAR", "STARFISH", "STATUE", "STEAK", "STEAM", "STEERING WHEEL", "STETHOSCOPE", "STICKER", "STOP LIGHT", "STOP SIGN", "STORM", "STOVE", "STRAW", "STRAWBERRY", "STREET", "STRING", "SUBMARINE", "SUGAR", "SUITCASE", "SUN", "SUNFLOWER", "SUNGLASSES", "SUPERHERO", "SURFBOARD", "SUSHI", "SWAMP", "SWAN", "SWEATER", "SWIMMING", "SWING", "SWORD", "SYRINGE", "TABLE", "TABLET", "TACO", "TADPOLE", "TAIL", "TANK", "TAPE", "TARGET", "TAXI", "TEA", "TEACHER", "TEAPOT", "TEAR", "TEDDY BEAR", "TEETH", "TELESCOPE", "TELEVISION", "TENNIS", "TENT", "THERMOMETER", "THIEF", "THUNDER", "TICKET", "TIE", "TIGER", "TIME", "TIRE", "TOAST", "TOASTER", "TOE", "TOILET", "TOMATO", "TONGUE", "TOOTH", "TOOTHBRUSH", "TORNADO", "TORTOISE", "TOWEL", "TOWER", "TOY", "TRACTOR", "TRAFFIC", "TRAIN", "TRASH CAN", "TREASURE", "TREE", "TRIANGLE", "TRICYCLE", "TROPHY", "TRUCK", "TRUMPET", "TSUNAMI", "TUB", "TULIP", "TUNA", "TURKEY", "TURTLE", "TV", "UMBRELLA", "UNICORN", "UNICYCLE", "UNIVERSE", "VACUUM", "VAMPIRE", "VAN", "VASE", "VEGETABLE", "VEST", "VIDEO GAME", "VINE", "VIOLIN", "VOLCANO", "VOLLEYBALL", "WAFFLE", "WAGON", "WALL", "WALLET", "WALRUS", "WAND", "WATCH", "WATER", "WATERFALL", "WATERMELON", "WAVE", "WEB", "WEDDING", "WELL", "WHALE", "WHEEL", "WHISTLE", "WIG", "WIND", "WINDMILL", "WINDOW", "WINE", "WING", "WINTER", "WIRE", "WITCH", "WIZARD", "WOLF", "WOOD", "WOODPECKER", "WORLD", "WORM", "WRENCH", "WRIST", "X-RAY", "XYLOPHONE", "YACHT", "YAK", "YARD", "YARN", "YETI", "YOGA", "YOGURT", "YOYO", "ZEBRA", "ZERO", "ZEUS", "ZIPPER", "ZOMBIE", "ZOO"
];

const ROUND_TIME = 60;
const SELECTION_TIME = 15;
const MAX_ROUNDS = 10;
const INTERMISSION_TIME = 8; // Longer intermission for leaderboard show

// --- STATE MANAGEMENT ---
let players = {}; // { socketId: { name, base, accessory, score, wins, totalPoints, rank } }
let drawerQueue = [];
let gameState = {
    status: 'waiting', // waiting, selecting, active, intermission, game_over
    round: 1,
    currentWord: '',
    wordChoices: [],
    drawerId: null,
    timer: ROUND_TIME,
    winners: []
};
let timerInterval = null;

// Ranking definitions
const RANK_THRESHOLDS = [
    { name: "NOVICE", minWins: 0 },
    { name: "ROOKIE", minWins: 5 },
    { name: "SKETCH ARTIST", minWins: 15 },
    { name: "INK MASTER", minWins: 40 },
    { name: "ILLUSTRATOR", minWins: 100 },
    { name: "GALLERY GOD", minWins: 250 }
];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // --- PLAYER JOIN & DATA SYNC ---
    socket.on('join_game', (userData) => {
        // Here we simulate the persistence logic
        // In a full build, this would load from a database based on a unique ID
        players[socket.id] = {
            ...userData,
            id: socket.id,
            score: 0, // Current session score
            wins: userData.wins || 0, // Persistent wins
            totalPoints: userData.totalPoints || 0, // Persistent total points
            hasGuessed: false,
            rank: calculateRank(userData.wins || 0)
        };
        
        console.log(`${userData.name} joined with ${userData.wins} wins. Rank: ${players[socket.id].rank}`);
        
        io.emit('player_list_update', Object.values(players));
        socket.emit('game_state_update', gameState);

        if (Object.keys(players).length >= 2 && gameState.status === 'waiting') {
            startNextRound();
        }
    });

    // --- WORD SELECTION ---
    socket.on('word_selected', (word) => {
        if (socket.id === gameState.drawerId && gameState.status === 'selecting') {
            gameState.currentWord = word;
            gameState.status = 'active';
            gameState.timer = ROUND_TIME;
            io.emit('game_state_update', gameState);
            startTimer();
        }
    });

    // --- DRAWING ---
    socket.on('draw_stroke', (data) => {
        if (socket.id === gameState.drawerId && gameState.status === 'active') {
            socket.broadcast.emit('remote_draw', data);
        }
    });

    socket.on('clear_canvas', () => {
        if (socket.id === gameState.drawerId && gameState.status === 'active') {
            io.emit('remote_clear');
        }
    });

    // --- CHAT & GUESSING ---
    socket.on('send_message', (text) => {
        const player = players[socket.id];
        if (!player || gameState.status !== 'active') return;

        if (socket.id === gameState.drawerId) return;
        if (gameState.winners.includes(socket.id)) return;

        const guess = text.trim().toUpperCase();
        
        if (guess === gameState.currentWord) {
            const rank = gameState.winners.length + 1;
            let points = 0;
            
            if (rank === 1) points += 250;
            else if (rank === 2) points += 150;
            else if (rank === 3) points += 100;
            else points += 50;

            points += Math.floor(gameState.timer * 3);

            player.score += points;
            player.totalPoints += points; // Increment persistent points
            player.hasGuessed = true;
            gameState.winners.push(socket.id);

            // Drawer gets points for correct guesses
            if (players[gameState.drawerId]) {
                players[gameState.drawerId].score += 75;
                players[gameState.drawerId].totalPoints += 75;
            }

            io.emit('player_list_update', Object.values(players));
            io.emit('correct_guess', { playerName: player.name, playerId: socket.id });

            const totalGuessers = Object.keys(players).length - 1;
            if (gameState.winners.length >= totalGuessers) {
                endRound();
            }
        } else {
            io.emit('new_message', {
                user: player.name,
                text: text,
                type: 'chat'
            });
        }
    });

    // --- DISCONNECT ---
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`${players[socket.id].name} left.`);
            delete players[socket.id];
        }
        drawerQueue = drawerQueue.filter(id => id !== socket.id);
        io.emit('player_list_update', Object.values(players));

        if (socket.id === gameState.drawerId) endRound();
        if (Object.keys(players).length < 2) resetGame();
    });
});

// --- HELPER LOGIC ---

function calculateRank(wins) {
    let currentRank = RANK_THRESHOLDS[0].name;
    for (const r of RANK_THRESHOLDS) {
        if (wins >= r.minWins) currentRank = r.name;
    }
    return currentRank;
}

// --- GAME LOOP ---

function startNextRound() {
    clearInterval(timerInterval);

    if (drawerQueue.length === 0) {
        const ids = Object.keys(players);
        if (ids.length < 2) {
            resetGame();
            return;
        }
        drawerQueue = [...ids].sort(() => Math.random() - 0.5);
        if (gameState.status !== 'waiting') gameState.round++;
    }

    if (gameState.round > MAX_ROUNDS) {
        endGame();
        return;
    }

    gameState.drawerId = drawerQueue.shift();
    gameState.status = 'selecting';
    gameState.timer = SELECTION_TIME;
    gameState.currentWord = '';
    gameState.winners = [];
    
    gameState.wordChoices = [];
    for(let i=0; i<3; i++) {
        gameState.wordChoices.push(WORDS[Math.floor(Math.random() * WORDS.length)]);
    }

    Object.values(players).forEach(p => p.hasGuessed = false);

    io.emit('player_list_update', Object.values(players));
    io.emit('game_state_update', gameState);
    io.emit('remote_clear');

    timerInterval = setInterval(() => {
        gameState.timer--;
        io.emit('timer_update', gameState.timer);

        if (gameState.timer <= 0) {
            if (gameState.status === 'selecting') {
                gameState.currentWord = gameState.wordChoices[0];
                gameState.status = 'active';
                gameState.timer = ROUND_TIME;
                io.emit('game_state_update', gameState);
                startTimer();
            } else if (gameState.status === 'active') {
                endRound();
            }
        }
    }, 1000);
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        gameState.timer--;
        io.emit('timer_update', gameState.timer);
        if (gameState.timer <= 0) endRound();
    }, 1000);
}

function endRound() {
    clearInterval(timerInterval);
    gameState.status = 'intermission';
    io.emit('game_state_update', gameState);

    setTimeout(() => {
        if (Object.keys(players).length >= 2) startNextRound();
        else resetGame();
    }, INTERMISSION_TIME * 1000);
}

function endGame() {
    gameState.status = 'game_over';
    
    const sortedPlayers = Object.values(players).sort((a,b) => b.score - a.score);
    if(sortedPlayers.length > 0) {
        const winner = sortedPlayers[0];
        winner.wins += 1; // Persistent Win
        winner.rank = calculateRank(winner.wins);
        io.emit('game_win', winner.id);
        console.log(`Game Over! ${winner.name} wins. Total wins: ${winner.wins}`);
    }
    
    io.emit('game_state_update', gameState);
    io.emit('player_list_update', Object.values(players));

    setTimeout(() => resetGame(), 15000);
}

function resetGame() {
    clearInterval(timerInterval);
    drawerQueue = [];
    gameState = {
        status: 'waiting',
        round: 1,
        currentWord: '',
        wordChoices: [],
        drawerId: null,
        timer: ROUND_TIME,
        winners: []
    };
    Object.values(players).forEach(p => { p.score = 0; p.hasGuessed = false; });
    io.emit('player_list_update', Object.values(players));
    io.emit('game_state_update', gameState);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SketchDash PRO Server running on port ${PORT}`);
});
