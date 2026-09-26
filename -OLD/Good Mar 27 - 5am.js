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
successSound = new Audio("audio/sfx/successSound.mp3");
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
scoreboardMusic.volume = 0.5;

// Set music looping and volume options, play next song after end
playlist.forEach(track => {
    track.loop = false;
    track.volume = 0.2;
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

    score = 0;
    blocks = [];

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

    laserVisuals = [];
    explodingBlocks = [];
    // Reset blaster shots remaining, if there's a limit added later.

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
} // explodeBlock



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
        ctx.fillText(score, 308, 38);

        ctx.textAlign = "left";
        if (musicOn) {
            ctx.fillText("♫", 10, 38);
        }
        if (sfxOn) {
            ctx.fillText("FX", 358, 38);
        }


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


// Draws the swapping motion only
// Does not update block info!!!
function drawBlockSwap(ctx) {
    if (!swapInProgress || !swapAnimation) return;

    const { topBlock, bottomBlock, progress, steps, radius, onComplete } = swapAnimation;

    // Center point for circular arc
    const centerY = (topBlock.y + bottomBlock.y) / 2;
    const angle = Math.PI * (progress / steps); // Sweep angle (180 degrees)

    const offsetX = radius * Math.sin(angle);
    const offsetY = radius * Math.cos(angle);

    // Update drawing positions along the arc
    topBlock.drawX = topBlock.x + offsetX;
    topBlock.drawY = centerY - offsetY;

    bottomBlock.drawX = bottomBlock.x - offsetX;
    bottomBlock.drawY = centerY + offsetY;

    // Advance animation
    swapAnimation.progress++;

    // When animation is complete
    if (swapAnimation.progress >= steps) {

        console.log("Swap animation complete");

        // Reset drawing overrides
        topBlock.drawX = null;
        topBlock.drawY = null;
        bottomBlock.drawX = null;
        bottomBlock.drawY = null;

        // Clean up animation state
        swapInProgress = false;
        swapAnimation = null;

        console.log("Swap animation done. Block states:");
        console.log("Top Block:", topBlock);
        console.log("Bottom Block:", bottomBlock);

        if (typeof onComplete === "function") {
            onComplete();
        }
    }
} // drawBlockSwap


function drawLaserBeam() {
    if (!activeBlock || activeBlock.type !== "Blaster") return;

    const ghostPos = getGhostPosition();
    if (!ghostPos) return;

    const startX = activeBlock.x;
    const startY = activeBlock.y + BLOCK_HEIGHT;
    const endY = ghostPos.y + BLOCK_HEIGHT;

        ctx.drawImage(spriteSheet, 
            laser.x, laser.y, 
            laser.width, laser.height, 
            startX, startY,
            BLOCK_WIDTH, ghostPos.y - activeBlock.y + BLOCK_HEIGHT
        );

} // drawLaserBeam


function animateZap(centerBlockX, rowY, affectedBlocks, callback = null) {
    const flickerCount = 3;
    const flickerDelay = 100;
    let flickerIndex = 0;
    let visible = true;

    function flicker() {
        if (visible) {
            lightningOverlay = {
                centerX: centerBlockX,
                rowY: rowY,
                active: true,
                blocks: affectedBlocks
            };
        } else {
            lightningOverlay = null;
        }

        drawGame(); // Will show or hide based on lightningOverlay

        flickerIndex++;
        visible = !visible; // Toggle on next cycle

        if (flickerIndex < flickerCount * 2) {
            setTimeout(flicker, flickerDelay);
        } else {
            lightningOverlay = null;
            if (callback) callback();
        }
    }

    flicker();
} // animateZap


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
} // getBlockByType


function getBlockAt(x, y) {
    return blocks.find(b => b.x === x && b.y === y) || null;
} // getBlockAt


// Return the block below the passed block object
function getBlockBelow(block) {
    return getBlockAt(block.x, block.y + BLOCK_HEIGHT);
} // getBlockBelow


// Remove a block from the board
function removeBlock(block, callback = null) {
    if (!block) return;

    const index = blocks.indexOf(block);
    if (index !== -1) {
        blocks.splice(index, 1);

        // Optional: play an animation here later before removing visually

        // Apply gravity after a short delay to allow other things to finish
        setTimeout(() => {
            applyGravity(() => {
                if (callback) callback();
            });
        }, 100);
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


// Move all blocks down to fill available empty spaces
function applyGravity(callback = null) {
    const columns = canvas.width / BLOCK_WIDTH;
    let fallingBlocks = 0;

    for (let col = 0; col < columns; col++) {
        const colX = col * BLOCK_WIDTH;

        // Collect blocks in this column, top-down
        const colBlocks = blocks
            .filter(b => b.x === colX)
            .sort((a, b) => a.y - b.y);

        for (let i = 0; i < colBlocks.length; i++) {
            const block = colBlocks[i];

            // Calculate how far down this block can fall
            let targetY = block.y;
            let nextY = block.y + BLOCK_HEIGHT;

            while (
                nextY < canvas.height &&
                !getBlockAt(colX, nextY)
            ) {
                targetY = nextY;
                nextY += BLOCK_HEIGHT;
            }

            if (targetY !== block.y) {
                fallingBlocks++;

                // Animate or instantly move down
                block.y = targetY;

                // After dropping, check for possible merge
                setTimeout(() => {
                    mergeBlocks(block, () => {
                        fallingBlocks--;
                        if (fallingBlocks === 0 && callback) {
                            callback(); // Call only once all gravity updates finish
                        }
                    });
                }, 100);
            }
        }
    }

    // If nothing needed to fall, still call the callback
    if (fallingBlocks === 0 && callback) {
        callback();
    }
} // applyGravity


// Shake the screen!
function shakeScreen(duration = 300, intensity = 5) {
    const startTime = performance.now();

    function doShake(currentTime) {
        const elapsed = currentTime - startTime;

        if (elapsed < duration) {
            const dx = (Math.random() - 0.5) * intensity * 2;
            const dy = (Math.random() - 0.5) * intensity * 2;

            ctx.save();
            ctx.translate(dx, dy);
            drawGame(); // redraw everything with offset
            ctx.restore();

            requestAnimationFrame(doShake);
        } else {
            // Final redraw to reset back to normal
            drawGame();
        }
    }

    requestAnimationFrame(doShake);
} // shakeScreen


// Fire the blaster Block instead of dropping it
function fireBlaster(x, y) {

    if (sfxOn) laserSound.play();


    // Find the bottom of the laser path
    const columnBlocks = blocks
        .filter(b => b.x === x)
        .sort((a, b) => a.y - b.y);

    const targetBlock = columnBlocks.find(b => b.y > y);
    if (targetBlock) {
        // Destroy topmost block in column with an explosion animation
        explodeBlock(targetBlock, () => {
            // optional callback
        }); 
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


function snapToGridPosition(value) {
    const gridSize = BLOCK_HEIGHT;  // Assuming blocks are aligned to grid based on BLOCK_HEIGHT
    return Math.round(value / gridSize) * gridSize;  // Snap to the nearest grid position
}

function swapBlocksAnimated(blockA, blockB, callback) {
    const centerY = (blockA.y + blockB.y) / 2;
    const radius = BLOCK_HEIGHT / 2;  // Arc about center of block
    let step = 0;
    const totalSteps = 20; // Speed of the swap (adjust if needed)
    const angleStep = Math.PI / totalSteps;

    // Create new blocks and place them temporarily above the grid
    const newBlockA = new Block(blockA.x, blockA.y, blockA.spriteIndex);
    const newBlockB = new Block(blockB.x, blockB.y, blockB.spriteIndex);

    // Remove both original target blocks from the grid before starting the animation
    blocks = blocks.filter(b => b !== blockA && b !== blockB);

    // Add the new blocks above other blocks
    blocks.push(newBlockA);
    blocks.push(newBlockB);

    // Start the animation
    function animateStep() {
        const angle = angleStep * step;
        const offsetX = radius * Math.sin(angle);
        const offsetY = radius * Math.cos(angle);

        // Move the blocks along the arc by updating their x and y properties
        newBlockA.x = blockA.x + offsetX;
        newBlockA.y = centerY - offsetY;

        newBlockB.x = blockB.x - offsetX;
        newBlockB.y = centerY + offsetY;

        step++;

        if (step <= totalSteps) {
            requestAnimationFrame(animateStep);  // Continue animation
        } else {
            // Animation complete, move blocks to their final positions
            newBlockA.y = snapToGridPosition(blockB.y);  // Snap y position to grid
            newBlockB.y = snapToGridPosition(blockA.y);  // Snap y position to grid

            // Add a slight pause before applying gravity
            setTimeout(() => {
                // Apply gravity and merge blocks after the pause
                applyGravity(() => {
                    mergeBlocks(newBlockA);
                    mergeBlocks(newBlockB);
                });

                swapInProgress = false;  // End the animation
                if (callback) callback();
            }, 300);  // Pause for 500ms before applying gravity
        }
    } // animateStep

    animateStep();  // Start the animation

} // swapBlocksAnimated


//====================
// Special Handlers
//====================


// Handle the Swap special block
function doSwap(block, callback) {
    const x = block.x;
    const y = block.y;

    const blockBelow = getBlockAt(x, y + BLOCK_HEIGHT);
    const blockTwoBelow = getBlockAt(x, y + 2 * BLOCK_HEIGHT);

    // Remove the Swap block itself
    removeBlock(block);

    // If there aren't 2 blocks to swap
    if (!blockBelow || !blockTwoBelow) {
        failSound.play();
        return callback?.();
    }

    // Track animation state
    swapInProgress = true;

    const topBlock = blockBelow;
    const bottomBlock = blockTwoBelow;

    // Play sound effect
    swapSound.play();

    // Run the animated swap (with merge after)
    swapBlocksAnimated(topBlock, bottomBlock, () => {
        swapInProgress = false;
        if (callback) callback();
    });
} //doSwap


// Handle the Bomb special block
function doBomb(block, callback) {
    const x = block.x;
    const y = block.y;

    const blockBelowIndex = blocks.findIndex(b => b.x === x && b.y === y + BLOCK_HEIGHT);

    // Remove the bomb block itself
    const index = blocks.indexOf(block);
    if (index !== -1) {
        blocks.splice(index, 1);
    }

    // If there’s a block below, destroy it
    if (blockBelowIndex !== -1) {
        const removedBlock = blocks[blockBelowIndex];
        blocks.splice(blockBelowIndex, 1); // Actually remove the block
        if (sfxOn) bombSound.play();
        explodeBlock(removedBlock);
        console.log("Bomb destroyed:", removedBlock.type);
    } else {
        if (sfxOn) failSound.play();
        console.log("Bomb fizzled out, nothing to destroy.");
    }

    if (typeof callback === "function") {
        callback();
    }
} // doBomb


// Handle the Magnet special block
function doMagnet(block, callback) {
    // Play sound

    // Alternate behavior, only randomizes value of single block
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

    // Scramble all numeric blocks in the same column
    const colX = block.x;
    const colBlocks = blocks
        .filter(b => b.x === colX && b !== block)
        .sort((a, b) => a.y - b.y); // Top to bottom

    if (colBlocks.length <= 1) {
        if (sfxOn) failSound.play();
        removeBlock(block); // Nothing to do
        return callback?.();
    }

    // Play the magnet sound only if there are blocks to scramble
    if (sfxOn) magnetSound.play();

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
} // doMagnet



// Handle the Zap special block
zapInProgress = false;

function doZap(block, callback = null) {

    const targetY = block.y + BLOCK_HEIGHT; // Row below the zap block
    const centerX = block.x; // The X position of the block landed on
    const step = BLOCK_WIDTH;
    const positionsToZap = []; // Must be defined here

    // Check if there's anything to zap at all
    const blockBelow = getBlockAt(centerX, targetY);

    // If no block is landed on
    if (!blockBelow) {
        if (sfxOn) failSound.play();
        removeBlock(block);
        return callback?.();
    }

    if (sfxOn) zapSound.play();
    shakeScreen(300, 4);

    // Start with the block directly below
    positionsToZap.push({ x: centerX, y: targetY });

    // Collect blocks to the left
    for (let x = centerX - step; x >= 0; x -= step) {
        const b = getBlockAt(x, targetY);
        if (b) {
            positionsToZap.push({ x, y: targetY });
        } else {
            break;
        }
    } // collect left

    // Collect blocks to the right
    for (let x = centerX + step; x < canvas.width; x += step) {
        const b = getBlockAt(x, targetY);
        if (b) {
            positionsToZap.push({ x, y: targetY });
        } else {
            break;
        }
    } // collect right

    // Draw the zap effect and remove the zapped blocks
    animateZap(centerX, targetY, positionsToZap, () => {

        // Remove the blocks after animation
        positionsToZap.forEach(pos => {
            const blockToRemove = getBlockAt(pos.x, pos.y);
            if (blockToRemove) removeBlock(blockToRemove);
        });

        // Remove the Zap block itself
        removeBlock(block);

        if (callback) callback();
    });

} // doZap


// Handle the Nuke special block
function doNuke(block, callback) {

    const columnBlocks = blocks
        .filter(b => b.x === block.x)
        .sort((a, b) => a.y - b.y); // Top-down

    const delayStep = 100; // time between starting each explosion
    let completed = 0;

    if (columnBlocks.length === 0) {
        if (sfxOn) failSound.play();
        return callback?.();
    }

    if (sfxOn) nukeSound.play();
    shakeScreen(500, 8);

    columnBlocks.forEach((targetBlock, index) => {
        const delay = index * delayStep;

        setTimeout(() => {
            explodeBlock(targetBlock, () => {
                completed++;
                if (completed === columnBlocks.length) {
                    // Remove the Nuke block itself
                    removeBlock(block);
                    callback?.();
                }
            });
        }, delay);
    });
}  // doNuke


// Handle the Blaster special block
function doBlaster(block, callback) {
    
    // Mosts blaster logic is handled elsewhere
    
    // Make blaster disappears once it lands
    explodeBlock(block);

    return callback?.();

} // doBlaster


// Combine blocks of matching value and handle special blocks
function mergeBlocks(block, callback = null) {
    if (!block) return;

    const blockType = blockTypes[block.spriteIndex];
    const blockBelow = getBlockAt(block.x, block.y + BLOCK_HEIGHT);
    const blockBelowType = blockBelow ? blockTypes[blockBelow.spriteIndex] : null;

    // Custom behaviors for special blocks
    switch (blockType.type) {
        case "Wild":
            if (blockBelowType?.type === "Bug") {

                if (sfxOn) wildSound.play();

                // Remove both blocks (Wild + Bug)
                removeBlock(blockBelow);
                removeBlock(block);

                return callback?.();
            } else {
                if (sfxOn) wildSound.play();
            }
            break;
        case "Swap":
            return doSwap(block, callback);
        case "Bomb":
            return doBomb(block, callback);
        case "Magnet":
            return doMagnet(block, callback);
        case "Zap":
            return doZap(block, callback);
            break;
        case "Nuke":
            return doNuke(block, callback);
        case "Bug":
            if (sfxOn) bugSound.play(); // Bug just lands, does nothing
            return callback?.();
        case "Blaster":
            return doBlaster(block, callback);
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
                spawnScorePopup(block.x + BLOCK_WIDTH / 2, block.y, upgradedValue);
                if (sfxOn) mergeSound.play();
                console.log("Merge:", blockTypes[block.spriteIndex].type);

                return setTimeout(() => {
                    mergeBlocks(block, callback); // <== Recursive merge call
                }, 100);

            } else {
                // Special handling for max merge (like 256 + 256)
                if (sfxOn) successSound.play(); // We've made a byte!
                score += upgradedValue; // Still give points!
                console.log("256!");
                
                // Remove the merged block entirely for now
                removeBlock(block);
                
                return setTimeout(() => {
                    mergeBlocks(block, callback); // <== Recursive merge call
                }, 100);
            }
        }
    } // standard merge logic

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
    if (sfxOn) gameOverSound.play();

    // Draw the scoreboard
    drawScoreboardScreen();

    console.log("Game over!");
    console.log("Score:     " + score);
    console.log("Highscore: " + highScore);
} // endGame


// Skip to the next music track
function nextTrack() {
    backgroundMusic.pause();
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length; // Modulus for wraparound
    backgroundMusic = playlist[currentTrackIndex];
    backgroundMusic.play();
    console.log("Next music");
} // nextTrack

function toggleSfx() {
    if (sfxOn) {
        console.log("SFX off");
    } else {
        console.log("SFX on");
    }
    sfxOn = !sfxOn;
}

function toggleMusic() {
if (musicOn) {
        backgroundMusic.pause();
        console.log("Music off");
    } else {
        backgroundMusic.play();
        console.log("Music on");
    }
    musicOn = !musicOn;
} // toggleMusic


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
        if (sfxOn) leftSound.play();
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
        if (sfxOn) rightSound.play();
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
    if (sfxOn) dropSound.play();

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

            if (sfxOn) placeSound.play();

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
            backgroundMusic.pause();
            if (sfxOn) pauseSound.play();
            console.log("Game paused");
            drawPauseScreen();
        } else {  // Unpausing the game
            gamePaused = false;
            console.log("Game resumed");
            backgroundMusic.play();

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
    if(musicOn) {
        if (backgroundMusic.paused) {
            backgroundMusic.play();
        }
    }
} // startMusic


// Stop the music
function stopMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0; // Reset to the beginning
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
        backgroundMusic.play();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Play button clicked
    if (!gameRunning && mouseX >= 50 && mouseX <= 350 && mouseY >= 450 && mouseY <= 570) {
        welcomeMusic.pause();
        welcomeMusic.currentTime = 0; // Reset to the beginning
        
        resetGame();
        if (sfxOn) dropSound.play();

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

    // Toggle options
    if (event.key === "m" || event.key === "M") {
        toggleMusic();
    }
    if (event.key === "s" || event.key === "S") {
        toggleSfx();
    }

    // Main action keys
    if (gameRunning && !gameOver && activeBlock) {
        switch (event.key) {
            case "ArrowLeft":
            case"a":
            case"A":
                moveBlockLeft();
                break;
            case "ArrowRight":
            case "d":
            case "D":
                moveBlockRight();
                break;
            case "ArrowDown":
            case " ":
                dropBlock();
                break;
            case "Escape":
            case "p":
            case "P":
                togglePause(); 
                break;
            case "q":
            case "Q":
            case "x":
            case "X":
                endGame();
                break;
            case "g":
            case "G":
                toggleGhost();
                break;
            }
    } // Main ation keys


    // DEV TOOLS — Only run if dev keys are enabled
    // Manually change the value of a block (cheat mode)
    if (DEV_KEYS_ENABLED && activeBlock) {
        if (isShift) {
            const devSpecialBlockHotkeys = {
                "Digit1": "Bug",
                "Digit2": "Wild",
                "Digit3": "Swap",
                "Digit4": "Bomb",
                "Digit5": "Magnet",
                "Digit6": "Zap",
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