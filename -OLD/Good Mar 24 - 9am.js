//
//                        ███████
//                        ███████
//                        ███████
//                   █████████████████
//                       █████████   
//                          ███
//      ███████████████████████████████████████████
//  
//      █████████████       ███    ████████████████
//      ███         ███     ███          ███
//      █████████████       ███          ███
//      ███         ███     ███          ███
//      █████████████       ███          ███
//  
//      ██████  █████  █    █  ██  █  █████  █    █
//      █       █      █    █  █ █ █  █      ██████
//      ██████  █      ██████  █  ██  █████  █    █
//
//      ███████████████████████████████████████████
//  
//      BitCrunch - A binary falling block game
//      (C) 2025 Nathan Pizar
//      nathan@piar.net
//


// ====================
// SETUP
// ====================

// Create the canvas and context, add it to the document
const canvas = document.getElementById("gameCanvas"); // Named in the HTML
canvas.oncontextmenu = function () {return false;};
const ctx = canvas.getContext("2d");

// Set canvas dimensions (optional, since CSS also controls it)
canvas.width = 400;
canvas.height = 720;

let myFont = new FontFace(
  "Silkscreen",
  "url(https://fonts.gstatic.com/s/silkscreen/v4/m8JXjfVPf62XiF7kO-i9YLNla0GA1dM.woff2)"
);
myFont.load().then((font) => {
  document.fonts.add(font);
});


// Game variables
const BLOCK_WIDTH = 100;
const BLOCK_HEIGHT = 60;
const REFRESH_RATE = 1000; // Update how many times per second
const DROP_SPEED = 10; // Drop speed, in pixels per refresh
const DROP_INTERVAL = 5; // Drop framerate
const MERGE_DELAY = 200; // Milliseconds pause between landing and merging
const COUNTDOWN_SPEED = 1000 // Miliseconds each number of the countdown is on screen
const NUMERIC_BLOCK_COUNT = 9; // This includes 1 through 256
const DEV_KEYS_ENABLED = true; // Allow us to manually set the block type for testing
const DEFAULT_BLASTER_SHOTS = 5; // Change to desired limit
const INFINITY_BLASTER_SHOTS = true; // Toggle unlimited mode
const LASER_DURATION = 100; // Duration of laser beem in ms

// Status variables
let gameRunning = false;
let gameOver = false; // delete later
let gamePaused = false;
let dropInProgress = false; // Track if a drop is already happening
let isHoveringPlayButton = false; // For mouseover hover status on main Play button
let isClickingPlayButton = false; // For click status on main Play button

// Tracking variables
let blocks = []; // Keep track of all the blocks on the grid
let activeBlock = null; // Track the active falling block
let score = 0; // Current player score
let highScore = 0; // Highest score of all time
let countdown = null; // Forgot what I use this for
let countdownValue = 3; // Count down from 3 to start the game
let animationFrameId = null; // Helps keep draw sync
let blasterShotsRemaining = Infinity;  // Global counter
let activeLaser = null;
let laserVisuals = []; // Stores active laser visuals with timers

// Game Options variables
let gravity = 1; // Falling speed, in pixels per refresh
let showGhostBlock = true;
let allowSpecialBlocks = true;
let drawRowNumbers = false;
let drawScorebar = true;


// Check if localStorage is available and retrieve high score
if (typeof localStorage !== "undefined") {
    const storedHighScore = localStorage.getItem("bitCrunchHighScore");
    if (storedHighScore !== null) {
        highScore = parseInt(storedHighScore, 10);
    }
}


// Load our sprite sheet image files
const spriteSheet = new Image();
spriteSheet.src = "graphics/BitCrunch-Sprite-Sheet.png";

const logoSprite = new Image();
logoSprite.src = "graphics/Bit-Crunch-Logo.png";

// Misc graphics sprites
const logo = { x: 0, y: 0, width: 400, height: 400 }
const gameGrid = { x: 0, y: 0, width: 400, height: 720 };
const scoreBoard = { x: 300, y: 720, width: 300, height: 240 };
const scoreBar = { x: 300, y: 960, width: 300, height: 42 };
const playButton = { x: 0, y: 720, width: 300, height: 120 };
const playButtonHighlight = { x: 0, y: 840, width: 300, height: 120 };
const boom1 = { x: 500, y: 420, width: 100, height: 60 };
const boom2 = { x: 500, y: 480, width: 100, height: 60 };
const boom3 = { x: 500, y: 540, width: 100, height: 60 };
const laser = { x: 500, y: 660, width: 100, height: 60 };

// Block type sprite definitions
const blockTypes = [
    { type: "1", value: 1, x: 400, y: 0, width: 100, height: 60, enabled: true },
    { type: "2", value: 2, x: 400, y: 60, width: 100, height: 60, enabled: true },
    { type: "4", value: 4, x: 400, y: 120, width: 100, height: 60, enabled: true },
    { type: "8", value: 8, x: 400, y: 180, width: 100, height: 60, enabled: true },
    { type: "16", value: 16, x: 400, y: 240, width: 100, height: 60, enabled: true },
    { type: "32", value: 32, x: 400, y: 300, width: 100, height: 60, enabled: true },
    { type: "64", value: 64, x: 400, y: 360, width: 100, height: 60, enabled: true },
    { type: "128", value: 128, x: 400, y: 420, width: 100, height: 60, enabled: true },
    { type: "256", value: 256, x: 400, y: 480, width: 100, height: 60, enabled: true },
 
    { type: "Wild", value: null, x: 500, y: 0, width: 100, height: 60, enabled: true },
    { type: "Swap", value: null, x: 500, y: 60, width: 100, height: 60, enabled: true },
    { type: "Bomb", value: null, x: 500, y: 120, width: 100, height: 60, enabled: true },
    { type: "Magnet", value: null, x: 500, y: 180, width: 100, height: 60, enabled: true},
    { type: "Zap", value: null, x: 500, y: 240, width: 100, height: 60, enabled: true },
    { type: "Bug", value: null, x: 500, y: 300, width: 100, height: 60, enabled: true },
    { type: "Nuke", value: null, x: 500, y: 360, width: 100, height: 60, enabled: true },
    { type: "Blaster", value: null, x: 500, y: 600, width: 100, height: 60, enabled: true },

    { type: "Orange", value: null, x: 400, y: 540, width: 100, height: 60 },
    { type: "Peach", value: null, x: 400, y: 600, width: 100, height: 60 },
    { type: "Teal", value: null, x: 400, y: 660, width: 100, height: 60 },
];

// Define our sound effect files
const welcomeSound = new Audio("audio/sfx/welcomeSound.mp3");
const startSound = new Audio("audio/sfx/startSound.mp3");
const leftSound = new Audio("audio/sfx/leftSound.mp3");
const rightSound = new Audio("audio/sfx/rightSound.mp3");
const dropSound = new Audio("audio/sfx/dropSound.mp3");
const placeSound = new Audio("audio/sfx/placeSound.mp3");
const mergeSound = new Audio("audio/sfx/mergeSound.mp3");
const pauseSound = new Audio("audio/sfx/pauseSound.mp3");
const gameOverSound = new Audio("audio/sfx/gameOverSound.mp3");

const wildSound = new Audio("audio/sfx/wildSound.mp3");
const swapSound = new Audio("audio/sfx/swapSound.mp3");
const bombSound = new Audio("audio/sfx/bombSound.mp3");
const magnetSound = new Audio("audio/sfx/magnetSound.mp3");
const zapSound = new Audio("audio/sfx/zapSound.mp3");
const nukeSound = new Audio("audio/sfx/nukeSound.mp3");
const bugSound = new Audio("audio/sfx/bugSound.mp3");
const laserSound = new Audio("audio/sfx/laserSound.mp3");
const failSound = new Audio("audio/sfx/failSound.mp3");

// Define our music files
const musicA = new Audio("audio/music/music-a.mp3");
const musicB = new Audio("audio/music/music-b.mp3");
const musicC = new Audio("audio/music/music-c.mp3");
const musicD = new Audio("audio/music/music-d.mp3");
const musicE = new Audio("audio/music/music-e.mp3");
const musicF = new Audio("audio/music/music-f.mp3");

// Make a playlist so we can cycle through music tracks
const playlist = [musicB, musicC, musicD, musicE, musicF];

// Start with a random song from the playlist.
//let currentTrackIndex = Math.floor(Math.random() * playlist.length);
let currentTrackIndex = 0;
let backgroundmusic = playlist[currentTrackIndex];

let welcomemusic = musicA;
let scoreboardmusic = musicA;

scoreboardmusic.loop = true;
scoreboardmusic.volume = 0.5;

// Set music looping and volume options, play next song after end
playlist.forEach(track => {
    track.loop = false;
    track.volume = 0.2;
    track.addEventListener("ended", () => {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
        backgroundmusic = playlist[currentTrackIndex];
        backgroundmusic.play();
    });
});


// ====================
// Object Definition
// ====================

class Block {
    constructor(x, y, spriteIndex) {
        if (
            typeof spriteIndex !== "number" ||
            spriteIndex < 0 ||
            spriteIndex >= blockTypes.length
        ) {
            console.error("Invalid spriteIndex:", spriteIndex);
            spriteIndex = 0; // fallback to first block type, a "1" block
        }

        const typeDef = blockTypes[spriteIndex];
        if (!typeDef) {
            console.error("Sprite definition not found for index", spriteIndex);
        }

        this.x = x;
        this.y = y;
        this.dy = gravity;
        this.spriteIndex = spriteIndex;
        this.type = typeDef.type;
        this.value = typeDef.value;
        this.sprite = typeDef; // full sprite info
    }
} // class Block



// ====================
// Main Functions
// ====================


// Sprite lookup for a given block type
function getBlockSprite(type) {
    return blockTypes.find(b => b.type === type);
} // getBlockSprite


// Clear everything and give us a fresh start
function resetGame() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null; // Ensure no duplicate loops
    }

    gameRunning = false;
    gameOver = false;
    gamePaused = false;
    score = 0;
    blocks = [];
    activeBlock = null;
    countdown = null;
    countdownValue = 3;

    startMusic();
    startCountdown();
    console.log("New game");
} // resetGame


// Main game loop, things we do every cycle
function gameLoop() {
    if (!gameRunning || gamePaused || gameOver) return;
    
    if (animationFrameId !== null) {
        console.warn("WARNING: A second game loop is attempting to start!");
        return; // Prevent multiple loops
    }

    function loop() {
        if (!gameRunning || gamePaused || gameOver) {
            animationFrameId = null;
            return;
        }

        updateBlocks();
        drawGame();
        animationFrameId = requestAnimationFrame(loop);
    }

    animationFrameId = requestAnimationFrame(loop);
}  // gameLoop

// Spawwn a new block
function createBlock() {
    if (activeBlock) return;

    // Assign the block a weighted randum number, or assign it a special type
    const index = getWeightedBlockValue();

    // Pick a random spawn location
    const xPos = Math.floor(Math.random() * (canvas.width / BLOCK_WIDTH)) * BLOCK_WIDTH;

    // End the game if there's a collision on creation
    if (blocks.some(b => b.x === xPos && b.y === 0)) {
        endGame();
        return;
    }

    activeBlock = new Block(xPos, 0, index);
    
    console.log("New block");

} // createBlock


// Update the details about every block on the grid
function updateBlocks() {
    if (!gameRunning || gamePaused || !activeBlock) return;

    // Move the active block downward
    let nextY = activeBlock.y + gravity;

    // Check if the active block can fall further
    if (nextY + BLOCK_HEIGHT > canvas.height || checkCollision(activeBlock)) {
        if (!activeBlock) return;

        // The block has landed, finalize its position
        activeBlock.y = Math.floor(activeBlock.y / BLOCK_HEIGHT) * BLOCK_HEIGHT;
        let placedBlock = { ...activeBlock }; // Clone before nullifying
        blocks.push(placedBlock);

        // Report what row it landed in
        let landedRow = 12 - Math.floor(placedBlock.y / BLOCK_HEIGHT);
        console.log("Placed in row ", 12 - (placedBlock.y / BLOCK_HEIGHT));

        // Prevent further movement until a new block spawns
        activeBlock = null;

        // Sound effect for when the block lands
        placeSound.play();

        // Delay merging to ensure proper placement
        setTimeout(() => {
            mergeBlocks(placedBlock, () => {
                // Create a new block only after all merges are done
                if (!activeBlock && gameRunning) {
                    createBlock();
                }
            });
        }, MERGE_DELAY);
    } else {
        // Move the active block down naturally
        activeBlock.y = nextY;
    }
} // updateBlocks


// Start the intro countdown
function startCountdown() {

    startSound.play(); // Play the countdown sound effect
    countdownValue = 3; // Reset countdown value
    drawGame(); // Immediately draw the countdown at 3

    countdown = setInterval(() => {
        countdownValue--;
        drawGame(); // Ensure screen updates

        if (countdownValue <= 0) {
            clearInterval(countdown);
            countdown = null;
            gameRunning = true;
            createBlock();
            drawGame(); // Force redraw to show the game state
            if (animationFrameId === null) gameLoop(); // Ensure game loop only starts once
            startMusic();
        }
    }, COUNTDOWN_SPEED); // How long each number of the countdown is on screen
} // startCountdown


// Change the block type
// FOR DEV TESTING PURPOSES ONLY!
function setActiveBlockByIndex(index) {
    const typeDef = blockTypes[index];
    if (!typeDef) {
        console.warn("Invalid spriteIndex");
        return;
    }

    // Preserve current X and Y if possible
    const x = activeBlock?.x ?? 0;
    const y = activeBlock?.y ?? 0;

    activeBlock = new Block(x, y, index);

    console.log("Block set to: " + typeDef.type);
} // setActiveBlockByIndex


// ====================
// Drawing Functions
// ====================


// Draw the game
function drawGame() {

    // Start with a blank canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Run the corresponding function to draw the appropriate part of the game
    if (!gameRunning && countdown === null) {
        drawWelcomeScreen();
    } else if (!gameRunning && countdown !== null && countdownValue > 0) {
        drawCountdownScreen();
    } else if (gameOver) {
        drawScoreboardScreen();
    } else {
        drawGameScreen();
    }
} // drawGame


// Draw the Welcome Screen
function drawWelcomeScreen() {
    // Background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background grid
    ctx.drawImage(
        spriteSheet,
        gameGrid.x, gameGrid.y,
        gameGrid.width, gameGrid.height,
        0, 0, canvas.width, canvas.height
    );

    dropShadow(true);

    // Main Logo
    ctx.drawImage(logoSprite, logo.x, logo.y, logo.width, logo.height);

    // Play Button with hover and click effects
    let buttonScale = isClickingPlayButton ? 0.95 : 1.0;
    let buttonSprite = isHoveringPlayButton ? playButtonHighlight : playButton;
    let buttonWidth = buttonSprite.width * buttonScale;
    let buttonHeight = buttonSprite.height * buttonScale;
    let buttonX = 50 + (300 - buttonWidth) / 2;
    let buttonY = 450 + (120 - buttonHeight) / 2;
    ctx.drawImage(spriteSheet, 
        buttonSprite.x, buttonSprite.y, 
        buttonSprite.width, buttonSprite.height,
        buttonX, buttonY,
        buttonWidth, buttonHeight
    );

    dropShadow(false);

} // drawWelcomeScreen


// Draw the Countdown Screen
function drawCountdownScreen() {

    // Background grid
    ctx.drawImage(
        spriteSheet,
        gameGrid.x, gameGrid.y,
        gameGrid.width, gameGrid.height,
        0, 0, canvas.width, canvas.height
    );

    // Countdown text
    ctx.fillStyle = "#f16d01"; // Orange
    ctx.font = "100px Silkscreen";
    ctx.textAlign = "center";

    dropShadow(true);

    ctx.fillText(countdownValue > 0 ? countdownValue : "GO!", 200, 390);

    dropShadow(false);
    
} // drawCountdownScreen


// Draw the main Game Screen
function drawGameScreen() {
    // Background grid
    ctx.drawImage(
        spriteSheet,
        gameGrid.x, gameGrid.y,
        gameGrid.width, gameGrid.height,
        0, 0, canvas.width, canvas.height
    );

    // Draw all settled blocks
    blocks.forEach(block => {
        const sprite = blockTypes[block.spriteIndex];
        if (sprite) {
            ctx.drawImage(
                spriteSheet,
                sprite.x, sprite.y, sprite.width, sprite.height,
                block.x, block.y, BLOCK_WIDTH, BLOCK_HEIGHT
            );
        } else {
            console.warn("Block has no sprite:", block);
        }
    });

    // Draw the ghost block, if enabled
    if (activeBlock && showGhostBlock) {
        const ghostPos = getGhostPosition();
        if (ghostPos) {
            ctx.lineWidth = 3;
            ctx.fillStyle = "rgba(173, 216, 230, 0.1)";
            ctx.strokeStyle = "rgba(241, 109, 1, 0.25)";
            ctx.shadowColor = "rgba(241, 109, 1, 0.5)";
            ctx.shadowBlur = 16;
            ctx.fillRect(ghostPos.x, ghostPos.y, BLOCK_WIDTH, BLOCK_HEIGHT);
            ctx.strokeRect(ghostPos.x, ghostPos.y, BLOCK_WIDTH, BLOCK_HEIGHT);
            ctx.shadowBlur = 0;
        }
    }

    // Draw laser beam if active
    if (activeLaser) {
        const ghostPos = getGhostPosition();
        // Include block height to have the laser cover the ghost space
        drawLaserBeam(activeBlock.x, activeBlock.y + BLOCK_HEIGHT, ghostPos.y + BLOCK_HEIGHT);
    }

    // Draw the active falling block LAST
    if (activeBlock) {
        const sprite = blockTypes[activeBlock.spriteIndex];
        if (sprite) {
            ctx.drawImage(
                spriteSheet,
                sprite.x, sprite.y, sprite.width, sprite.height,
                activeBlock.x, activeBlock.y, BLOCK_WIDTH, BLOCK_HEIGHT
            );
        } else {
            console.warn("Active block has no sprite:", activeBlock);
        }
    }

    // Draw row number overlay, if enabled
    if (drawRowNumbers) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "16px Silkscreen";
        ctx.textAlign = "left";

        for (let i = 0; i < 12; i++) {
            let rowNumber = 12 - i;
            let y = i * BLOCK_HEIGHT + BLOCK_HEIGHT / 2 + 5;
            ctx.fillText(rowNumber, 5, y);
        }
    }

    // Score bar
    if (drawScorebar) {
        dropShadow(true);
        ctx.drawImage(
            spriteSheet,
            scoreBar.x, scoreBar.y,
            scoreBar.width, scoreBar.height,
            50, 10,
            300, 42
        );
        dropShadow(false);

        ctx.fillStyle = "white";
        ctx.font = "24px Silkscreen";
        ctx.textAlign = "right";
        ctx.fillText(score, 310, 38);
        ctx.textAlign = "left";
        ctx.fillText(currentTrackIndex + 1, 20, 38);
    }
} // drawGameScreen


// Draw the pause screen
function drawPauseScreen() {
    const tealSprite = getBlockSprite("Teal");

    if (!tealSprite) {
        return;
    }

    fillGrid(getBlockByType("Teal"), 5, drawPauseText);

    function drawPauseText() {
        ctx.fillStyle = "#f16d01"; // Orange
        ctx.font = "60px Silkscreen";
        ctx.textAlign = "center";

        dropShadow(true);

        ctx.fillText("PAUSED", 200, 380);

        dropShadow(false);
    }

} // drawPauseScreen


// Scoreboard screen
function drawScoreboardScreen() {
    gameOverSound.play();

    // Clean slate
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background Grid
    ctx.drawImage(
        spriteSheet,
        gameGrid.x, gameGrid.y,
        gameGrid.width, gameGrid.height,
        0, 0,
        canvas.width, canvas.height
    );

    // Fill the ggame grid with the orange block
    fillGrid(getBlockSprite("Orange"), 20, drawFinalScore);

    function drawFinalScore() {
        dropShadow(true);
    
        // Draw the scoreboard graphic
        ctx.drawImage(
            spriteSheet,
            scoreBoard.x, scoreBoard.y,
            scoreBoard.width, scoreBoard.height,
            50, 150,
            300, 240
        );
    
        dropShadow(false);
    
        // Draw current and high scores text
        ctx.fillStyle = "white";
        ctx.font = "38px Silkscreen";
        ctx.textAlign = "center";
        ctx.fillText(score, 200, 290);
        ctx.fillText(highScore, 200, 366);
    
    } // drawFinalScores

} // drawScoreboardScreen


// Draw an individual block
function drawBlock(block) {
    ctx.drawImage(
        spriteSheet,
        block.sprite.x, block.sprite.y,
        block.sprite.width, block.sprite.height,
        block.x, block.y,
        BLOCK_WIDTH, BLOCK_HEIGHT
    );
}

function drawLaserBeam(fromX, fromY, toY) {
    const laserSprite = laser;
    if (!laserSprite) return;

    const beamHeight = toY - fromY;
    if (beamHeight <= 0) return;

    ctx.drawImage(
        spriteSheet,
        laserSprite.x, laserSprite.y,
        laserSprite.width, laserSprite.height,
        fromX, fromY,
        BLOCK_WIDTH, beamHeight // Stretch sprite vertically
    );
}
 // drawLaserBeam


// Sequentially fill the game grid with a specified block sprite
function fillGrid(blockType, speed, callback = null) {

    let yStart = canvas.height - BLOCK_HEIGHT;
    let xStart = 0;
    let gridFilling = true;

    function drawNextBlock() {
        if (!gridFilling) return;

        if (yStart < 0) {
            gridFilling = false;
            if (callback) callback();
            return;
        }

        // Check that blockType has the necessary sprite data
        if (!blockType || typeof blockType.x === "undefined") {
            console.warn("fillGrid received invalid blockType:", blockType);
            gridFilling = false;
            if (callback) callback();
            return;
        }

        // Draw the block's sprite
        ctx.drawImage(
            spriteSheet,
            blockType.x, blockType.y,
            blockType.width, blockType.height,
            xStart, yStart,
            BLOCK_WIDTH, BLOCK_HEIGHT
        );

        xStart += BLOCK_WIDTH;
        if (xStart >= canvas.width) {
            xStart = 0;
            yStart -= BLOCK_HEIGHT;
        }

        setTimeout(drawNextBlock, speed);
    }

    drawNextBlock();
    
} // fillGrid


// Animate a block shrinking before it disappears
function animateBlockRemoval(block, options = {}, callback = null) {

    const {
        duration = 300, // Total duration in ms
        scaleFrom = 1,
        scaleTo = 0,
        tintColor = null,
        outline = false,
        overlaySprite = null,
    } = options;

    const startTime = performance.now();
    const startScale = scaleFrom;
    const scaleDiff = scaleTo - scaleFrom;

    function animateFrame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const currentScale = startScale + progress * scaleDiff;

        // Clear and redraw the entire screen for consistency
        drawGame(); // Ensures a clean slate before redrawing the block

        // Draw the shrinking block
        const sprite = getBlockSprite(block);
        if (!sprite) return;

        const centerX = block.x + BLOCK_WIDTH / 2;
        const centerY = block.y + BLOCK_HEIGHT / 2;
        const drawWidth = BLOCK_WIDTH * currentScale;
        const drawHeight = BLOCK_HEIGHT * currentScale;

        const drawX = centerX - drawWidth / 2;
        const drawY = centerY - drawHeight / 2;

        // Optional tint background
        if (tintColor) {
            ctx.fillStyle = tintColor;
            ctx.fillRect(drawX, drawY, drawWidth, drawHeight);
        }

        // Draw main block sprite
        ctx.drawImage(
            spriteSheet, 
            sprite.x, sprite.y, 
            sprite.width, sprite.height, 
            drawX, drawY, 
            drawWidth, drawHeight
        );

        // Optional overlay
        if (overlaySprite) {
            ctx.drawImage(
                spriteSheet, 
                overlaySprite.x, overlaySprite.y, 
                overlaySprite.width, overlaySprite.height,
                drawX, drawY,
                drawWidth, drawHeight
            );
        }

        // Optional outline
        if (outline) {
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(drawX, drawY, drawWidth, drawHeight);
        }

        if (progress < 1) {
            requestAnimationFrame(animateFrame);
        } else {
            if (callback) callback();
        }
    }

    // Refresh the screen
    requestAnimationFrame(animateFrame);

} // animateBlockRemoval


// ====================
// Utility Functions
// ====================


function getBlockByType(type) {
    return blockTypes.find(b => b.type === type);
} // getBlocyByType


function getBlockAt(x, y) {
    return blocks.find(b => b.x === x && b.y === y) || null;
} // getBlockAt


// Return the block below the passed block object
function getBlockBelow(block) {
    return getBlockAt(block.x, block.y + BLOCK_HEIGHT);
} // getBlockBelow


// Remove a block from the board
function removeBlock(block) {
    const index = blocks.indexOf(block);
    if (index !== -1) {
        blocks.splice(index, 1);
    }
} // removeBlock


function checkCollision(block) {
    const nextY = block.y + gravity;

    // Bottom boundary check
    if (nextY + BLOCK_HEIGHT > canvas.height) {
        return true;
    }

    // Check for overlapping with settled blocks
    return blocks.some(other => {
        const sameColumn = block.x === other.x;
        const overlapY = nextY + BLOCK_HEIGHT > other.y && block.y < other.y;

        return sameColumn && overlapY;
    });
} // checkCollision


// Fire the blaster Block instead of dropping it
function fireBlaster(x, y) {
    laserSound.play();

    // Find the bottom of the laser path
    const columnBlocks = blocks
        .filter(b => b.x === x)
        .sort((a, b) => a.y - b.y);

    const targetBlock = columnBlocks.find(b => b.y > y);
    if (targetBlock) {
        removeBlock(targetBlock); // destroy topmost block in column
    }

    // Store laser visuals so we can draw the beam
    const laserBottom = targetBlock ? targetBlock.y : canvas.height;

    activeLaser = {
        x,
        y1: y + BLOCK_HEIGHT,
        y2: laserBottom
    };

    setTimeout(() => {
        activeLaser = null;
    }, LASER_DURATION);
} // fireBlaster


// Handle the Swap special block
function handleSwapBlock(block, callback) {
    const above = getBlockBelow(block); // block below the Swap

    if (!above) {
        removeBlock(block);
        failSound.play();
        return callback?.();
    }

    const below = getBlockBelow(above); // block below that one
    if (!below) {
        removeBlock(block);
        return callback?.();
    }

    // Swap positions
    const tempY = above.y;
    above.y = below.y;
    below.y = tempY;

    // Remove the Swap block
    removeBlock(block);
    swapSound.play();

    // Trigger merges on swapped blocks
    mergeBlocks(above, () => {
        mergeBlocks(below, callback);
    });
    
} //handleSwapBlock


// Handle the Bomb special block
function handleBombBlock(block, callback) {
    const x = block.x;
    const y = block.y;

    const blockBelowIndex = blocks.findIndex(b => b.x === x && b.y === y + BLOCK_HEIGHT);

    // Remove the bomb block from play
    const index = blocks.indexOf(block);
    if (index !== -1) {
        blocks.splice(index, 1);
    }

    // If there’s a block below, destroy it
    if (blockBelowIndex !== -1) {
        const removedBlock = blocks.splice(blockBelowIndex, 1)[0];
        console.log("Bomb destroyed "+ blockTypes[removedBlock.spriteIndex].type);

        // Play bomb sound effect
        bombSound.play();
    } else {
        // Play fizzle unsuccessful "nope" sound effect
        failSound.play();
    }

    // Continue the game
    if (typeof callback === "function") {
        callback();
    }
} // handleBombBlock


// Handle the Magnet special block
function handleMagnetBlock(block, callback) {
    // Play sound
    magnetSound.play();

    // Preserve original behavior (commented out for reference)
    /*
    const blockBelow = getBlockAt(block.x, block.y + BLOCK_HEIGHT);
    if (!blockBelow || blockTypes[blockBelow.spriteIndex].value === null) {
        removeBlock(block); // Nothing to scramble, just remove magnet
        return callback?.();
    }

    const numericBlocks = blockTypes.filter(bt => bt.value !== null);
    let scrambleCount = 6;
    let scrambleIndex = 0;

    const scrambleInterval = setInterval(() => {
        if (scrambleIndex >= scrambleCount) {
            clearInterval(scrambleInterval);
            removeBlock(block); // Remove magnet
            return callback?.();
        }

        const randomType = numericBlocks[Math.floor(Math.random() * numericBlocks.length)];
        blockBelow.spriteIndex = blockTypes.findIndex(bt => bt.type === randomType.type);
        scrambleIndex++;
    }, 80);

    return;
    */

    // New functionality: scramble all numeric blocks in the same column
    // Get all numeric blocks in the same column
    const colX = block.x;
    const colBlocks = blocks
        .filter(b => b.x === colX && b !== block)
        .sort((a, b) => a.y - b.y); // Top to bottom

    if (colBlocks.length === 0) {
        removeBlock(block); // Nothing to do
        return callback?.();
    }

    // Create a shuffled version of the current spriteIndexes
    const originalIndexes = colBlocks.map(b => b.spriteIndex);
    const shuffledIndexes = [...originalIndexes];
    for (let i = shuffledIndexes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledIndexes[i], shuffledIndexes[j]] = [shuffledIndexes[j], shuffledIndexes[i]];
    }

    // Flicker animation (randomize sprites temporarily)
    let flickerCount = 0;
    const maxFlickers = 6;
    const flickerInterval = setInterval(() => {
        if (flickerCount < maxFlickers) {
            colBlocks.forEach(b => {
                const randomIndex = originalIndexes[Math.floor(Math.random() * originalIndexes.length)];
                b.spriteIndex = randomIndex;
            });
            flickerCount++;
        } else {
            clearInterval(flickerInterval);

            // Apply final shuffled spriteIndexes
            colBlocks.forEach((b, i) => {
                b.spriteIndex = shuffledIndexes[i];
            });

            // Remove the magnet block itself
            removeBlock(block);

            // Attempt merges top-down
            let mergeIndex = 0;
            function mergeNext() {
                if (mergeIndex < colBlocks.length) {
                    mergeBlocks(colBlocks[mergeIndex], () => {
                        mergeIndex++;
                        mergeNext();
                    });
                } else {
                    callback?.();
                }
            }

            mergeNext();
        }
    }, 80);
} // handleMagnetBlock


// Handle the Zap special block
function handleZapBlock(block, callback = null) {
    zapSound.play();

    const targetY = block.y + BLOCK_HEIGHT; // Row below the zap block
    const centerX = block.x;
    const positionsToZap = [];
    const step = BLOCK_WIDTH;

    // Check if there's anything to zap at all
    const blockBelow = getBlockAt(centerX, targetY);
    if (!blockBelow) {
        removeBlock(block); // No blocks to zap, just remove the zap block
        return callback?.();
    }

    // Start with the block directly below
    positionsToZap.push({ x: centerX, y: targetY });

    // Spread left
    for (let x = centerX - step; x >= 0; x -= step) {
        const b = getBlockAt(x, targetY);
        if (b) {
            positionsToZap.push({ x, y: targetY });
        } else {
            break; // Stop at empty space
        }
    }

    // Spread right
    for (let x = centerX + step; x < canvas.width; x += step) {
        const b = getBlockAt(x, targetY);
        if (b) {
            positionsToZap.push({ x, y: targetY });
        } else {
            break; // Stop at empty space
        }
    }

    // Animate zap removals outward from center
    let index = 0;
    function zapNext() {
        if (index < positionsToZap.length) {
            const { x, y } = positionsToZap[index];
            const target = getBlockAt(x, y);
            if (target) removeBlock(target);
            index++;
            setTimeout(zapNext, 100); // Adjust speed of zap animation here
        } else {
            removeBlock(block); // Remove the zap block itself
            if (callback) callback();
        }
    }

    zapNext();
} // handleZapBlock


// Handle the Nuke special block
function handleNukeBlock(block, callback) {
    removeBlock(block);
    nukeSound.play();

    removeColumnCascade(block.x, 100, callback);

    function removeColumnCascade(columnX, delay = 200, callback = null) {
        const columnBlocks = blocks
            .filter(b => b.x === columnX)
            .sort((a, b) => a.y - b.y); // From top to bottom
    
        function removeNext(index = 0) {
            if (index >= columnBlocks.length) {
                if (callback) callback();
                return;
            }
            const block = columnBlocks[index];
    
            removeBlock(block);
    
            setTimeout(() => removeNext(index + 1), delay);
        }
    
        removeNext();
    }

    return callback?.();
} // handleNukeBlock


// Handle the Blaster special block
function handleBlasterBlock(block, callback) {
    // Mosts blaster logic is handled elsewhere
    failSound.play();
    removeBlock(block); // Blaster disappears once it hits something
    return callback?.();
} // handleBlasterBlock


// Combine blocks of matching value and handle special blocks
function mergeBlocks(block, callback = null) {
    if (!block) return;

    const blockType = blockTypes[block.spriteIndex];
    const blockBelow = getBlockAt(block.x, block.y + BLOCK_HEIGHT);
    const blockBelowType = blockBelow ? blockTypes[blockBelow.spriteIndex] : null;

    // Behaviors for special blocks
    switch (blockType.type) {
        case "Wild":
            if (blockBelowType?.type === "Bug") {
                // Remove both blocks (Wild + Bug)
                removeBlock(blockBelow);
                wildSound.play();
                removeBlock(block);
                return callback?.();
            }
            break;
        case "Swap":
            return handleSwapBlock(block, callback);
        case "Bomb":
            return handleBombBlock(block, callback);
        case "Magnet":
            return handleMagnetBlock(block, callback);
        case "Zap":
            return handleZapBlock(block, callback);
        case "Nuke":
            return handleNukeBlock(block, callback);
        case "Bug":
            bugSound.play(); // Bug just lands, does nothing
            return callback?.();
        case "Blaster":
            return handleBlasterBlock(block, callback);
    }

    // Proceed with standard merge logic
    if (blockBelow) {
        const isWild = blockType.type === "Wild" || blockBelowType?.type === "Wild";
        const bothNumeric = blockType.value !== null && blockBelowType?.value !== null;
        const valuesEqual = blockType.value === blockBelowType?.value;

        const canMerge = isWild || (bothNumeric && valuesEqual);

        if (canMerge) {
            removeBlock(blockBelow);
            block.y += BLOCK_HEIGHT;

            const baseValue = blockType.value ?? blockBelowType?.value ?? 0;
            const upgradedValue = baseValue * 2;
            const newIndex = blockTypes.findIndex(bt => bt.value === upgradedValue);

            if (newIndex !== -1) {
                block.spriteIndex = newIndex;
                score += upgradedValue;
                mergeSound.play();
                console.log("Merge:", blockTypes[block.spriteIndex].type);
                if(isWild) {
                    wildSound.play();
                }
                return setTimeout(() => mergeBlocks(block, callback), 100);
            } else {
                console.warn("No block type found for value:", upgradedValue);
                return callback?.();
            }
        }
    }

    // No merge occurred
    if (callback) callback();
} // mergeBlocks


// Find the location of where the block would land if dropped
function getGhostPosition() {
    if (!activeBlock) return null;

    let ghostX = activeBlock.x;
    let ghostY = 0;

    for (let y = 0; y <= canvas.height - BLOCK_HEIGHT; y += BLOCK_HEIGHT) {
        let occupied = blocks.some(b => b.x === ghostX && b.y === y);
        if (!occupied) {
            ghostY = y;
        } else {
            break;
        }
    }

    return { x: ghostX, y: ghostY };

} // getGhostPosition


// What we do when the game is over
function endGame() {
    gameOver = true;
    gameRunning = false;
    gamePaused = false;

    // Check and update high score
    if (score > highScore) {
        highScore = score;

        // Store in localStorage if available
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("bitCrunchHighScore", highScore);
        }
    }

    // Stop the game loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Stop active block movement
    activeBlock = null;

    // Stop block creation
    clearInterval(countdown);

    // End the music
    stopMusic();
    // Game over sound effect
    gameOverSound.play();

    // Draw the scoreboard
    drawScoreboardScreen();

    console.log("Game over!");
    console.log("Score:     " + score);
    console.log("Highscore: " + highScore);
} // endGame


// Skip to the next music track
function skipMusic() {
    backgroundmusic.pause();
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length; // Modulus for wraparound
    backgroundmusic = playlist[currentTrackIndex];
    backgroundmusic.play();
    console.log("Next music");
} // skipMusic


// Move the active block left
function moveBlockLeft() {
    if (!activeBlock || dropInProgress) return;

    let newX = activeBlock.x - BLOCK_WIDTH;

    let collision = blocks.some(b => 
        b.x === newX &&
        b.y < activeBlock.y + BLOCK_HEIGHT &&
        b.y + BLOCK_HEIGHT > activeBlock.y
    );

    if (newX >= 0 && !collision) {
        activeBlock.x = newX;
        leftSound.play();
    }
} // moveBlockLeft

// Move the active block right
function moveBlockRight() {
    if (!activeBlock || dropInProgress) return;

    let newX = activeBlock.x + BLOCK_WIDTH;

    let collision = blocks.some(b => 
        b.x === newX &&
        b.y < activeBlock.y + BLOCK_HEIGHT &&
        b.y + BLOCK_HEIGHT > activeBlock.y
    );

    if (newX < canvas.width && !collision) {
        activeBlock.x = newX;
        rightSound.play();
    }
} // moveBlockRight()


// Immediately drop the active block
function dropBlock() {
    if (!activeBlock || dropInProgress) return;

    // Special handling for the Blaster block
    const blockType = blockTypes[activeBlock.spriteIndex];
    if (blockType.type === "Blaster") {
        fireBlaster(activeBlock.x, activeBlock.y);
        return; // Do NOT drop the blaster
    }

    dropInProgress = true; // Prevent side-to-side movement while dropping
    let maxY = canvas.height - BLOCK_HEIGHT;
    let columnBlocks = blocks.filter(b => b.x === activeBlock.x).sort((a, b) => a.y - b.y);

    // Play the drop sound effect
    dropSound.play();

    for (let b of columnBlocks) {
        if (b.y > activeBlock.y) {
            maxY = Math.min(maxY, b.y - BLOCK_HEIGHT);
            break;
        }
    }

    let dropInterval = setInterval(() => {
        if (!activeBlock) {
            clearInterval(dropInterval);
            dropInProgress = false;
            return;
        }

        if (activeBlock.y + DROP_SPEED < maxY) {
            activeBlock.y += DROP_SPEED;
        } else {
            clearInterval(dropInterval);
            activeBlock.y = Math.floor(maxY / BLOCK_HEIGHT) * BLOCK_HEIGHT;

            let placedBlock = new Block(activeBlock.x, activeBlock.y, activeBlock.spriteIndex);

            blocks.push(placedBlock);

            let landedRow = 12 - Math.floor(placedBlock.y / BLOCK_HEIGHT);
            console.log("Placed in row " + landedRow);

            activeBlock = null;

            placeSound.play();

            setTimeout(() => {
                mergeBlocks(placedBlock, () => {
                    dropInProgress = false; // Re-enable movement
                    if (!activeBlock && gameRunning) {
                        createBlock();
                    }
                });
            }, MERGE_DELAY); // How long to pause before merging
        }
    }, DROP_INTERVAL); // Influences drop speed and smoothness

    console.log("Drop");

} // dropBlock


// Send back a weighted random value or special type
function getWeightedBlockValue() {
    const blockCounts = {};
    const totalBlocks = blocks.length;

    // Count how many blocks of each value are on the board
    blocks.forEach(block => {
        const def = blockTypes[block.spriteIndex];
        if (def && def.value !== null) {
            blockCounts[def.value] = (blockCounts[def.value] || 0) + 1;
        }
    });

    const maxValue = Math.max(...Object.keys(blockCounts).map(Number), 1);

    // Weighted probabilities for standard blocks
    const probabilities = {
        1: 50,
        2: 30,
        4: 15,
        8: 5,
    };

    if (maxValue >= 8) probabilities[8] = 10;
    if (maxValue >= 16) probabilities[16] = 5;
    if (maxValue >= 32) probabilities[32] = 3;
    if (maxValue >= 64) probabilities[64] = 1;

    const totalWeight = Object.values(probabilities).reduce((a, b) => a + b, 0);
    const roll = Math.random() * 100;

    const SPECIAL_BLOCK_CHANCE = 10; // % chance of a special block

    // Randomly pick if the block will be special
    if (roll < SPECIAL_BLOCK_CHANCE) {
        const enabledSpecials = blockTypes
            .map((bt, i) => ({ ...bt, index: i }))
            .filter(bt => bt.value === null && bt.enabled);

        if (enabledSpecials.length > 0) {
            const chosen = enabledSpecials[Math.floor(Math.random() * enabledSpecials.length)];
            return chosen.index;
        }
    }

    // Otherwise, pick from numbered blocks using weighted values
    const weightedList = [];

    for (const value in probabilities) {
        const weight = probabilities[value];
        for (let i = 0; i < weight; i++) {
            weightedList.push(parseInt(value));
        }
    }

    const chosenValue = weightedList[Math.floor(Math.random() * weightedList.length)];
    const index = blockTypes.findIndex(bt => bt.value === chosenValue);
    return index !== -1 ? index : 0;

} // getWeightedBlockValue;


// Shortcut for turning on and off a global dropshadow style when drawing
function dropShadow(enable) {
    if (enable == true) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowOffsetX = 10;
        ctx.shadowOffsetY = 10;
        ctx.shadowBlur = 20;
    } else {
        ctx.restore();
    }
} //dropShadow


// Show or hide the pause screen
function togglePause() {

    if (gameRunning && !gameOver) {
        if (!gamePaused) {  // Pausing the game
            gamePaused = true;
            backgroundmusic.pause();
            pauseSound.play();
            console.log("Game paused");
            drawPauseScreen();
        } else {  // Unpausing the game
            gamePaused = false;

            backgroundmusic.play();

            // If the game loop stopped, restart it
            if (!animationFrameId) {
                gameLoop();
            }
        }
    }
} // togglePause


// Show or hide the ghost block preview aid
function toggleGhost() {
    console.log("Toggle ghost");
    showGhostBlock = !showGhostBlock;
} // toggleGhost


// Start the music
function startMusic() {
    if (backgroundmusic.paused) {
        backgroundmusic.play();
    }
} // startMusic


// Stop the music
function stopMusic() {
    backgroundmusic.pause();
    backgroundmusic.currentTime = 0; // Reset to the beginning
} // stopMusic


// DIY debugger overlay for mobile since the console isn't available
function logDebug(message) {
    let debugDiv = document.getElementById("debugLog");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
        debugDiv.scrollTop = debugDiv.scrollHeight; // Auto-scroll to newest logs
    }
} // logDebug


// ====================
// MOUSE AND KEYBOARD
// ====================


// General click action
canvas.addEventListener("click", function(event) {
    if (gameOver) {
        gameOver = false; // Ensure game over state resets
        resetGame();
        return;
    }

    if (gamePaused) {
        gamePaused = false;
        backgroundmusic.play();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Play button clicked
    if (!gameRunning && mouseX >= 50 && mouseX <= 350 && mouseY >= 450 && mouseY <= 570) {
        welcomemusic.pause();
        welcomemusic.currentTime = 0; // Reset to the beginning
        
        resetGame();
        dropSound.play();

    } else {
        dropBlock();
    }
}); // click


// Check mouse position
canvas.addEventListener("mousemove", function(event) {
    if (gamePaused) return; // Prevents the pause screen from being canceled

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Track previous hover state to prevent unnecessary redraws
    let previousHoverState = isHoveringPlayButton;

    isHoveringPlayButton = (!gameRunning && countdown === null && 
        mouseX >= 50 && mouseX <= 350 && mouseY >= 450 && mouseY <= 570);

    // Only redraw if the hover state changed
    if (previousHoverState !== isHoveringPlayButton) {
        drawGame();
    }
}); // mousemove


// Mouse listener for horizontal block movement
canvas.addEventListener("mousemove", function(event) {
    if (activeBlock && gameRunning && !gamePaused) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        let newBlockX = Math.floor(mouseX / BLOCK_WIDTH) * BLOCK_WIDTH;

        if (newBlockX !== activeBlock.x) {
            if (newBlockX < activeBlock.x) {
                moveBlockLeft();
            } else if (newBlockX > activeBlock.x) {
                moveBlockRight();
            }
        }
    }
}); // mousemove


// Mouseup action for main Play button
canvas.addEventListener("mouseup", function(event) {
    if (isClickingPlayButton && isHoveringPlayButton) {
        isClickingPlayButton = false;
            resetGame();
    }
    isClickingPlayButton = false;

    // Only redraw if not paused
    if (!gamePaused) {
        drawGame();
    }
}); // mouseup


// Right-click to pause
canvas.addEventListener('mousedown', function(event) {
    if (event.button === 2) { // Right mouse button
        event.preventDefault(); // Stop context menu
        event.stopPropagation(); // Stop any other event from firing
        togglePause();
    }
}); // mousedown

// Prevent default right-click context menu globally
canvas.addEventListener('contextmenu', function(event) {
    event.preventDefault();
}); // right click


// Keyboard controls
document.addEventListener("keydown", function(event) {

    const code = event.code;
    const isShift = event.shiftKey;

    // Any key on Scoreboard screen goes back to Welcome
    if (gameOver) {
        gameOver = false;
        drawWelcomeScreen();
        return;
    }

    // Press enter on Welcome Screen to start game
    if (!gameRunning && event.key === "Enter") {
        resetGame();
        return;
    }

    // Any key to unpause
    if (gamePaused) {
        togglePause();
        return;
    }

    // Main action keys
    if (gameRunning && !gameOver && activeBlock) {
        switch (event.key) {
            case "ArrowLeft":
                moveBlockLeft();
                break;
            case "ArrowRight":
                moveBlockRight();
                break;
            case "ArrowDown":
            case " ":
                dropBlock();
                break;
            case "Escape":
            case "p":
                togglePause(); 
                break;
            case "q":
            case "x":
                endGame();
                break;
            case "m":
                skipMusic();
                break;
            case "g":
                toggleGhost();
                break;
            case "s":
                allowSpecialBlocks = !allowSpecialBlocks;
                console.log("Specials: " + allowSpecialBlocks);
                break;
        }
    } // Action keys


    // DEV TOOLS — Only run if dev keys are enabled
    // Manually change the value of a block (cheat mode)
    if (DEV_KEYS_ENABLED && activeBlock) {
        if (isShift) {
            const devSpecialBlockHotkeys = {
                "Digit1": "Wild",
                "Digit2": "Swap",
                "Digit3": "Bomb",
                "Digit4": "Magnet",
                "Digit5": "Zap",
                "Digit6": "Bug",
                "Digit7": "Nuke",
                "Digit8": "Blaster"
            };
    
            const targetType = devSpecialBlockHotkeys[code];
            if (targetType) {
                const index = blockTypes.findIndex(bt => bt.type === targetType && bt.enabled !== false);
                if (index !== -1) {
                    setActiveBlockByIndex(index);
                } else {
                    console.warn("Special block undefined or disabled:", targetType);
                }
    
                return; // Exit early so we don't also trigger numeric block logic
            }
    
        } else if (code.startsWith("Digit")) {
            // Handle numeric blocks: 1–9 = 2^0 to 2^8
            const digit = parseInt(code.replace("Digit", ""));
            if (digit >= 1 && digit <= 9) {
                const value = Math.pow(2, digit - 1);
                const index = blockTypes.findIndex(bt => bt.value === value);
                if (index !== -1) {
                    setActiveBlockByIndex(index);
                } else {
                    console.warn("Numeric block not found for value:", value);
                }
            }
        }
    } // Dev cheat keys

}); // Keyboard controls



// ====================
// TOUCH GESTURE CONTROLS
// ====================

const SWIPE_THRESHOLD = 50; // px
const PAUSE_THRESHOLD = 100; // px
const MOTION_AMPLIFIER = 2; // Multiply drag distance

let touchStartX = 0;
let touchStartY = 0;
let accumulatedMoveX = 0;
let lastKnownBlockX = 0;

// Touch to start
document.addEventListener("touchstart", function (event) {
    if (!gameRunning || gamePaused) return;

    let touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;

    if (activeBlock) {
        lastKnownBlockX = activeBlock.x;
    }
});

// Swipes
document.addEventListener("touchend", function (event) {
    if (!gameRunning || gamePaused) return;

    let touch = event.changedTouches[0];
    let deltaY = touch.clientY - touchStartY;
    
    // Swipe down to drop
    if (event.touches.length === 0 && event.changedTouches.length === 1) { 
        // Swipe down to drop
        if (deltaY >= SWIPE_THRESHOLD) {
            dropBlock();

        // Swipe up to pause
        } else if (deltaY <= -PAUSE_THRESHOLD) {
            togglePause();
        }
    // Three-finger swipe up to end game
    } else if (event.changedTouches.length === 3) {
        if (deltaY <= -PAUSE_THRESHOLD) {
            endGame();
        }
    }
});

// Drag action
document.addEventListener("touchmove", function (event) {
    if (!gameRunning || gamePaused || !activeBlock) return;

    let touch = event.touches[0];

    // Check how far we are from the initial touch and amplify
    let deltaX = (touch.clientX - touchStartX) * MOTION_AMPLIFIER;

    // Only move if the distance dragged exceeds the block width
    if (Math.abs(deltaX) >= BLOCK_WIDTH) {
        // Move the block using moveLeft or moveRight depending on direction
        if (deltaX > 0) {
            logDebug("Move Right");
            moveRight;
        } else {
            logDebug("Move Left");
            moveLeft;
        }

        // Reset accumulated distance and update the touch reference point
        touchStartX = touch.clientX;  // Reset reference point after move
    }
});


// ====================
// LAUNCHING FUNCTIONS
// ====================


// Start the game loop, but only after the sprite sheets load
spriteSheet.onload = () => {
    logoSprite.onload = () => {
        drawWelcomeScreen();
        console.log("It's time to BitCrunch!");
    };
};

// Start up our main framerate refresh
setInterval(() => {
    if (gameRunning && !gameOver && !activeBlock) {
        createBlock();
    }
}, REFRESH_RATE);


// ====================
// THE END
// ====================