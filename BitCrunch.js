//  
//      BitCrunch - A binary falling block game
//      (C) 2025 Nathan Pizar
//      nathan@piar.net
//


const VERSION = "v0.02.2 (Beta)";
// Version notes:
// 0.02.1 - Fixed ASD controls 
// 0.02.2 - Reduced music volume levels, pause game when switching away from window
//
// Known bugs:
// Sometimes the Nuke removes blocks but they are still drawn on the grid
// Music continues to play on iPhone even when browser is minimized



// ====================
// SETUP
// ====================

let myFont = new FontFace(
    "Silkscreen",
    "url(https://fonts.gstatic.com/s/silkscreen/v4/m8JXjfVPf62XiF7kO-i9YLNla0GA1dM.woff2)"
  );
  myFont.load().then((font) => {
    document.fonts.add(font);
  });

// Create the canvas and context, add it to the document
const canvas = document.getElementById("gameCanvas"); // Named in the HTML

// Prevent right-click from opening the context menu
canvas.oncontextmenu = function () { return false;};
const ctx = canvas.getContext("2d");

// Set canvas dimensions (optional, since CSS also controls it)
canvas.width = 400;
canvas.height = 720;


// Game variables
const BLOCK_WIDTH = 100; // Pixels
const BLOCK_HEIGHT = 60; // Pixels
const REFRESH_RATE = 1000; // FPS - Update how many times per second
const DROP_SPEED = 10; // Pixels per frame
const DROP_INTERVAL = 5; // Drop framerate
const MERGE_DELAY = 200; // Milliseconds pause between landing and merging
const COUNTDOWN_SPEED = 1000 // Miliseconds each number of the countdown is on screen
const NUMERIC_BLOCK_COUNT = 9; // How many number block increments, 1 through 256
const DEV_KEYS_ENABLED = true; // Allow us to manually set the block type for testing
const DEFAULT_BLASTER_SHOTS = 5; // If we want a shot limit to prevent being overpowered
const INFINITY_BLASTER_SHOTS = true; // Toggle unlimited mode
const LASER_DURATION = 100; // Milliseconds, duration of laser beam
const SCORE_POPUP_RISE_SPEED = 2; // Pixels per frame
const SCORE_POPUP_FADE_SPEED = 1; // Percent alpha reduction per frame
const SWAP_ANIMATION_DURATION = 12; // Frames, Hhw long the swap should take

// Game Options variables
let gravity = 1; // Falling speed, in pixels per refresh
let showGhostBlock = true;
let showScorePopups = true;
let allowSpecialBlocks = true;
let drawRowNumbers = false;
let drawScorebar = true;
let musicOn = true;
let sfxOn = true;

// Status variables
let gameRunning = false; // Is the game running?
let gameOver = false; // Is the game over?
let gamePaused = false; // Is the game paused?
let swapInProgress = null; // Global tracker for animation state
let dropInProgress = false; // Track if a drop is already happening
let zapInProgress = false; // Check if we're currently running the zap action
let isHoveringPlayButton = false; // For mouseover hover status on main Play button
let isClickingPlayButton = false; // For click status on main Play button
let lightningOverlay = null; // Flag to draw the zap effect or not

// Tracking variables
let blocks = []; // Keep track of all the blocks on the grid
let explodingBlocks = []; // Keep a list of blocks in proccess of going boom
let activeBlock = null; // Track the active falling block
let score = 0; // Current player score
let highScore = 0; // Highest score of all time
let countdown = null; // Forgot what I use this for
let countdownValue = 3; // Count down from 3 to start the game
let animationFrameId = null; // Helps keep draw sync
let blasterShotsRemaining = Infinity;  // Global counter
let activeLaser = null;
let laserVisuals = []; // Stores active laser visuals with timers
let scorePopups = []; // List of floating text when points are added


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
const playButtonHighlight = { x: 0, y: 840, width: 300, height: 120 }
const laser = { x: 500, y: 660, width: 100, height: 60 };
const boom1 = { x: 500, y: 420, width: 100, height: 60 };
const boom2 = { x: 500, y: 480, width: 100, height: 60 };
const boom3 = { x: 500, y: 540, width: 100, height: 60 };
const boomSprites = [ boom1, boom2, boom3 ];
const lightningSprite = { x: 0, y: 1020, width: 400, height: 60 };


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

    { type: "Bug", value: null, x: 500, y: 300, width: 100, height: 60, enabled: true },
    { type: "Wild", value: null, x: 500, y: 0, width: 100, height: 60, enabled: true },
    { type: "Swap", value: null, x: 500, y: 60, width: 100, height: 60, enabled: true },
    { type: "Bomb", value: null, x: 500, y: 120, width: 100, height: 60, enabled: true },
    { type: "Magnet", value: null, x: 500, y: 180, width: 100, height: 60, enabled: true},
    { type: "Zap", value: null, x: 500, y: 240, width: 100, height: 60, enabled: true },
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

const bugSound = new Audio("audio/sfx/bugSound.mp3");
const wildSound = new Audio("audio/sfx/wildSound.mp3");
const swapSound = new Audio("audio/sfx/swapSound.mp3");
const bombSound = new Audio("audio/sfx/bombSound.mp3");
const magnetSound = new Audio("audio/sfx/magnetSound.mp3");
const zapSound = new Audio("audio/sfx/zapSound.mp3");
const nukeSound = new Audio("audio/sfx/nukeSound.mp3");
const laserSound = new Audio("audio/sfx/laserSound.mp3");

const failSound = new Audio("audio/sfx/failSound.mp3");
const successSound = new Audio("audio/sfx/successSound.mp3");
const smallBoomSound = new Audio("audio/sfx/smallBoomSound.mp3");

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
let backgroundMusic = playlist[currentTrackIndex];

let welcomeMusic = musicA;
let scoreboardMusic = musicA;

scoreboardMusic.loop = true;
scoreboardMusic.volume = 0.2;

backgroundMusic.volume = 0.2;

// Set music looping and volume options, play next song after end
playlist.forEach(track => {
    track.loop = false;

    track.addEventListener("ended", () => {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
        backgroundMusic = playlist[currentTrackIndex];
        backgroundMusic.play();
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
            console.error("Invalid spriteIndex");
            spriteIndex = 0; // fallback to first block type, a "1" block
        }

        const typeDef = blockTypes[spriteIndex];
        if (!typeDef) {
            console.error("Sprite definition not found");
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

    score = 0;
    blocks = [];
    laserVisuals = [];
    explodingBlocks = [];

    gameRunning = false;
    gameOver = false;
    gamePaused = false;
    activeBlock = null;
    countdown = null;
    countdownValue = 3;
    zapInProgress = false;
    magnetInProgress = false;
    laserActive = false;
    shakeActive = false;

    // Cancel any timers
    clearInterval(countdown);

    stopMusic(); // In case music was playing
    startMusic(); // Restart music

    startCountdown();

    console.log("New game");
} // resetGame


// Main game loop, things we do every cycle
function gameLoop() {
    if (!gameRunning || gamePaused || gameOver) return;
    
    if (animationFrameId !== null) {
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


// Spawn a new block
function createBlock() {
    
    if (activeBlock || swapInProgress) return;

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

        // Update score and draw points floating up
        if (placedBlock && placedBlock.value) {
            score+= placedBlock.value;
            spawnScorePopup(placedBlock.x + BLOCK_WIDTH/2, placedBlock.y, placedBlock.value);
        }

        // Report what row it landed in
        let landedRow = 12 - Math.floor(placedBlock.y / BLOCK_HEIGHT);
        console.log("Placed in row ", 12 - (placedBlock.y / BLOCK_HEIGHT));

        // Prevent further movement until a new block spawns
        activeBlock = null;

        // Sound effect for when the block lands
        if (sfxOn) placeSound.play();

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

    if (sfxOn) startSound.play(); // Play the countdown sound effect
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


function spawnScorePopup(x, y, amount) {
    scorePopups.push({
        x,
        y,
        text: `+${amount}`,
        alpha: 1, // Starting transparency
        dy: SCORE_POPUP_RISE_SPEED  // Pixels per frame to float upwards
    });
} // spawnScorePopup


// Animate an explosion as part of block removal
function explodeBlock(block, callback = null) {
    if (!block) return;

    const frames = [...boomSprites];
    const frameDuration = 80;
    let currentFrame = 0;

    // Track this block as actively exploding
    explodingBlocks.push({ x: block.x, y: block.y, frame: 0 });

    if (sfxOn) smallBoomSound.play();
    const animate = () => {
        if (currentFrame < frames.length) {
            const explosion = explodingBlocks.find(e => e.x === block.x && e.y === block.y);
            if (explosion) explosion.frame = currentFrame;
            drawGame();
            currentFrame++;
            setTimeout(animate, frameDuration);
        } else {
            const index = blocks.indexOf(block);
            if (index !== -1) blocks.splice(index, 1);

            // Remove from explodingBlocks
            explodingBlocks = explodingBlocks.filter(e => e.x !== block.x || e.y !== block.y);

            block.spriteOverride = null;

            if (typeof callback === "function") {
                callback();
            }
        }
    };

    animate();
} // explk



// ====================
// Drawing Functions
// ====================


// Draw the game
function drawGame() {

    // Start with a blank canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Set the font right up front
    ctx.font = "24px Silkscreen";

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

    ctx.fillStyle = "white";
    ctx.font = "24px Silkscreen";
    ctx.textAlign = "center";
    ctx.fillText(VERSION, 200, 640);

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
    ctx.strokeStyle = "#682f00"; // Dark Orange
    ctx.lineWidth = 6;

    dropShadow(true);

    ctx.strokeText(countdownValue > 0 ? countdownValue : "GO!", 200, 390);
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
        // Skip blocks currently exploding
        const isExploding = explodingBlocks.some(e => e.x === block.x && e.y === block.y);
        if (isExploding) return;

        // Use spriteOverride if present (e.g., for explosions)
        const sprite = block.spriteOverride || blockTypes[block.spriteIndex];
        if (!sprite) {
            console.warn("Missing sprite for block:", block);
            return;
        }

        // Support animated draw position (e.g., during swap)
        const drawX = block._drawX ?? block.x;
        const drawY = block._drawY ?? block.y;

        ctx.drawImage(
            spriteSheet,
            sprite.x, sprite.y, sprite.width, sprite.height,
            drawX, drawY, BLOCK_WIDTH, BLOCK_HEIGHT
        );
    }); // Draw settled blocks


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

    
    // Draw laser beam, if active
    if (activeLaser) {
        const ghostPos = getGhostPosition();
        // Include block height to have the laser cover the ghost space
        drawLaserBeam(activeBlock.x, activeBlock.y + BLOCK_HEIGHT, ghostPos.y + BLOCK_HEIGHT);
    }


    // Draw exploding block animations
    explodingBlocks.forEach(explosion => {
        if (sfxOn) bombSound.play();
        const sprite = boomSprites[explosion.frame];
        if (sprite) {
            ctx.drawImage(
                spriteSheet,
                sprite.x, sprite.y, sprite.width, sprite.height,
                explosion.x, explosion.y, BLOCK_WIDTH, BLOCK_HEIGHT
            );
        }
    });


    // Draw lightning effect
    if (lightningOverlay?.active) {

        const { centerX, rowY, blocks } = lightningOverlay;
    
        // Find how far left and right we need to go
        const xs = blocks.map(b => b.x);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);


        // Draw block glow outlines
        blocks.forEach(({ x, y }) => {
            ctx.shadowColor = "rgba(255, 255, 0, 1)";
            ctx.shadowBlur = 30;
            ctx.strokeStyle = "rgba(241, 109, 1, 0.5)";
            ctx.fillStyle = "rgba(255, 255, 0, 0.25)";
            ctx.lineWidth = 4;
            //ctx.strokeRect(x + 2, y + 2, BLOCK_WIDTH - 4, BLOCK_HEIGHT - 4);
            ctx.fillRect(x + 2, y + 2, BLOCK_WIDTH - 4, BLOCK_HEIGHT - 4);
        });

        ctx.shadowBlur = 0;

        const halfWidth = BLOCK_WIDTH / 2;

        // Calculate how much width to draw in each direction
        const rightWidth = maxX + BLOCK_WIDTH - (centerX + halfWidth);
        const leftWidth = (centerX + halfWidth) - minX;

        // Draw rightward segment of lightning
        ctx.drawImage(
            spriteSheet,
            lightningSprite.x, lightningSprite.y,
            rightWidth, lightningSprite.height,
            centerX + halfWidth, rowY,
            rightWidth, lightningSprite.height
        );

        // Draw mirrored leftward segment
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(
            spriteSheet,
            lightningSprite.x, lightningSprite.y,
            leftWidth, lightningSprite.height,
            -(centerX + halfWidth), rowY,
            leftWidth, lightningSprite.height
        );

        ctx.restore();

    } // Lightning overlay

        
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
    } // Draw active block



    // Draw floating score popups
    if (showScorePopups) {
        scorePopups.forEach((popup, index) => {
            ctx.globalAlpha = popup.alpha;
            ctx.fillStyle = "#ffffff";
            ctx.font = "30px Silkscreen";
            ctx.textAlign = "center";
            ctx.fillText(popup.text, popup.x, popup.y);

            // Update popup position
            popup.y -= popup.dy;

            // Update transparency. Specified by percent, but alpha is 0-1
            popup.alpha -= SCORE_POPUP_FADE_SPEED / 100; 

            // Remove when faded or expired
            if (popup.alpha <= 0) {
                scorePopups.splice(index, 1);
            }
        });

        ctx.globalAlpha = 1.0; // Reset transparency

    } // Draw score popups


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
    } // Row numbbrs


    // Draw the Scorebar
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
        ctx.fillText(score, 308, 38);

        ctx.textAlign = "left";
        if (musicOn) {
            ctx.fillText("â™«", 10, 38);
        }
        if (sfxOn) {
            ctx.fillText("FX", 358, 38);
        }
    } // Scorebar


    // Draw the debugging text under the scorebar
    // drawDirectionText();

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
        ctx.strokeStyle = "#682f00"; // Dark Orange
        ctx.lineWidth = 6;
        ctx.strokeText("PAUSED", 200, 380);
        ctx.fillText("PAUSED", 200, 380);

        dropShadow(false);
    }

} // drawPauseScreen


// Draw the Scoreboard screen
function drawScoreboardScreen() {
    if (sfxOn) gameOverSound.play();

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
} //drawBlock

