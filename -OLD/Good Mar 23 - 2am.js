//        
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
const MERGE_DELAY = 200; // Milliseconds pause between landing and merging
const COUNTDOWN_SPEED = 1000 // Miliseconds each number of the countdown is on screen
const NUMERIC_BLOCK_COUNT = 9; // This includes 1 through 256
const DEV_KEYS_ENABLED = true; // Allow us to manually set the block type for testing


// Status variables
let gameRunning = false;
let gameOver = false; // delete later
let gamePaused = false;


// Tracking variables
let blocks = []; // Keep track of all the blocks on the grid
let activeBlock = null; // Track the active falling block
let score = 0; // Current player score
let highScore = 0; // Highest score of all time
let countdown = null; // Forgot what I use this for
let countdownValue = 3; // Count down from 3 to start the game
let animationFrameId = null; // Helps keep draw sync
let dropInProgress = false; // Track if a drop is already happening
let isHoveringPlayButton = false; // For mouseover hover status on main Play button
let isClickingPlayButton = false; // For click status on main Play button


// Game Options variables
let gravity = 1; // Falling speed, in pixels per refresh
let showGhostBlock = true;
let allowSpecialBlocks = true;
let drawRowNumbers = true;
let drawScorebar = false;


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
  
    { type: "Orange", value: null, x: 400, y: 540, width: 100, height: 60 },
    { type: "Peach", value: null, x: 400, y: 600, width: 100, height: 60 },
    { type: "Teal", value: null, x: 400, y: 660, width: 100, height: 60 },
  
    { type: "Wild", value: null, x: 500, y: 0, width: 100, height: 60, enabled: true },
    { type: "Swap", value: null, x: 500, y: 60, width: 100, height: 60, enabled: true },
    { type: "Bomb", value: null, x: 500, y: 120, width: 100, height: 60, enabled: false },
    { type: "Zap", value: null, x: 500, y: 180, width: 100, height: 60, enabled: false },
    { type: "Kaboom", value: null, x: 500, y: 240, width: 100, height: 60, enabled: false },
    { type: "Magnet", value: null, x: 500, y: 300, width: 100, height: 60, enabled: false },
    { type: "Bug", value: null, x: 500, y: 360, width: 100, height: 60, enabled: false },
     { type: "Blaster", value: null, x: 500, y: 600, width: 100, height: 60, enabled: false },
];

// Define our sound effect files
const welcomeSound = new Audio("audio/welcomeSound.mp3");
const startSound = new Audio("audio/startSound.mp3");
const leftSound = new Audio("audio/leftSound.mp3");
const rightSound = new Audio("audio/rightSound.mp3");
const dropSound = new Audio("audio/dropSound.mp3");
const placeSound = new Audio("audio/placeSound.mp3");
const mergeSound = new Audio("audio/mergeSound.mp3");
const pauseSound = new Audio("audio/pauseSound.mp3");
const gameOverSound = new Audio("audio/gameOverSound.mp3");

// Define our music files
const musicA = new Audio("audio/music-a.mp3");
const musicB = new Audio("audio/music-b.mp3");
const musicC = new Audio("audio/music-c.mp3");
const musicD = new Audio("audio/music-d.mp3");
const musicE = new Audio("audio/music-e.mp3");
const musicF = new Audio("audio/music-f.mp3");

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
        console.log("Placed in row:", 12 - (placedBlock.y / BLOCK_HEIGHT));

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
    ctx.drawImage(spriteSheet, buttonSprite.x, buttonSprite.y, buttonSprite.width, buttonSprite.height, buttonX, buttonY, buttonWidth, buttonHeight);

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
            ctx.fillStyle = "rgba(173, 216, 230, 0.1)"; // Light blue
            ctx.strokeStyle = "rgba(241, 109, 1, 0.25)"; // Orange
            ctx.shadowColor = "rgba(241, 109, 1, 0.5)";
            ctx.shadowBlur = 16;
            ctx.fillRect(ghostPos.x, ghostPos.y, BLOCK_WIDTH, BLOCK_HEIGHT);
            ctx.strokeRect(ghostPos.x, ghostPos.y, BLOCK_WIDTH, BLOCK_HEIGHT);
            ctx.shadowBlur = 0;
        }
    }

    // Draw the active block
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

    // Draw the Scoreboard at the top of the grame grid
    if (drawScorebar) {
        dropShadow(true);
        ctx.drawImage(spriteSheet, scoreBar.x, scoreBar.y, scoreBar.width, scoreBar.height, 50, 10, 300, 42);
        dropShadow(false);

        ctx.fillStyle = "white";
        ctx.font = "24px Silkscreen";
        ctx.textAlign = "right";
        ctx.fillText(score, 310, 38);

        // Draw the current music track number
        ctx.textAlign = "left";
        ctx.fillText(currentTrackIndex+1, 20, 38);
    }

} // drawGameScreen


// Draw the pause screen
function drawPauseScreen() {
    const tealSprite = getBlockSprite("Teal");

    if (!tealSprite) {
        return;
    }

    fillGrid(tealSprite, 5, drawPauseText);

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
        gameGrid.x,
        gameGrid.y,
        gameGrid.width,
        gameGrid.height,
        0,
        0,
        canvas.width,
        canvas.height
    );

    // Fill the ggame grid with the orange block
    fillGrid(getBlockSprite("Orange"), 20, drawFinalScore);

    function drawFinalScore() {
        dropShadow(true);
    
        // Draw the scoreboard graphic
        ctx.drawImage(
            spriteSheet,
            scoreBoard.x,
            scoreBoard.y,
            scoreBoard.width,
            scoreBoard.height,
            50,
            150,
            300,
            240
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


// Sequentially fill the game grid with a specified block sprite
function fillGrid(blockSprite, speed, callback = null) {
    
    let yStart = canvas.height - BLOCK_HEIGHT;
    let xStart = 0;
    let gridFilling = true; // Prevent multiple calls

    function drawNextBlock() {
        if (!gridFilling) return; // Stop if game resets

        if (yStart < 0) {
            gridFilling = false; // Stop further execution
            if (callback) callback(); // Call the callback function after grid is filled
            return;
        }

        // Draw the block sprite
        ctx.drawImage(
            spriteSheet,
            block.sprite.x, block.sprite.y,
            block.sprite.width, block.sprite.height,
            xStart, yStart,
            BLOCK_WIDTH, BLOCK_HEIGHT
        );

        xStart += BLOCK_WIDTH;
        if (xStart >= canvas.width) {
            xStart = 0;
            yStart -= BLOCK_HEIGHT;
        }
        
        setTimeout(drawNextBlock, speed); // Adjust speed of filling animation
    } // drawNextBlock

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


// Combine blocks of matching value and handle special blocks
function mergeBlocks(block, callback = null) {
    if (!block) return;

    const blockBelowIndex = blocks.findIndex(
        b => b.x === block.x && b.y === block.y + BLOCK_HEIGHT
    );

    if (blockBelowIndex !== -1) {
        const blockBelow = blocks[blockBelowIndex];
        const blockType = blockTypes[block.spriteIndex];
        const belowType = blockTypes[blockBelow.spriteIndex];

        const isWild = blockType.type === "Wild";
        const canMerge = isWild || (blockType.value !== null && blockType.value === belowType.value);

        // Handle special blocks
        if (blockType.value === null || belowType.value === null) {
            switch (blockType.type) {
                case "Wild":
                    // TODO: Implement Wild logic
                    break;
                case "Swap":
                    // Any block it lands on will swap its position with the one below it. If after the swap, a merge is possible, 
                    if (blockBelow) {
                        const secondBlockIndex = blocks.findIndex(
                            b => b.x === block.x && b.y === block.y + 2 * BLOCK_HEIGHT
                        );
                        const secondBlock = secondBlockIndex !== -1 ? blocks[secondBlockIndex] : null;
    
                        if (secondBlock) {
                            // Swap the two blocks
                            const tempY = blockBelow.y;
                            blockBelow.y = secondBlock.y;
                            secondBlock.y = tempY;
    
                            console.log("Swap block triggered: swapped blocks below");
    
                            // Remove the Swap block itself
                            const thisBlockIndex = blocks.indexOf(block);
                            if (thisBlockIndex !== -1) {
                                blocks.splice(thisBlockIndex, 1);
                            }
    
                            placeSound.play();
    
                            // Check for new merge with the swapped block
                            return setTimeout(() => {
                                mergeBlocks(blockBelow, callback);
                            }, 100);
                        } else {
                            console.log("Swap block: only one block below, no swap.");
                        }
                    }
    
                    // If no valid swap occurred, still remove the Swap block
                    const indexToRemove = blocks.indexOf(block);
                    if (indexToRemove !== -1) {
                        blocks.splice(indexToRemove, 1);
                    }
    
                    if (callback) callback();
                    return;
                case "Bomb":
                    // TODO: Implement Bomb logic
                    break;
                case "Magnet":
                    // TODO: Implement Magnet logic
                    break;
                case "Bug":
                    // TODO: Implement Bug logic
                    break;
                case "Blaster":
                    // TODO: Implement Blaster logic
                    break;
                default:
                    // Fallback for unknown special types
                    console.warn("Unhandled special block type:", blockType.type);
            }

            if (callback) callback();
            return;
        }

        if (canMerge) {
            // Remove the block below
            blocks.splice(blockBelowIndex, 1);

            // Move the top block down to the merged position
            block.y += BLOCK_HEIGHT;

            // Determine new value
            if (isWild && belowType.value !== null) {
                const newValue = belowType.value * 2;
                const newTypeIndex = blockTypes.findIndex(bt => bt.value === newValue);
                if (newTypeIndex !== -1) {
                    block.spriteIndex = newTypeIndex;
                    score += newValue;
                } else {
                    console.warn("No matching block type for value:", newValue);
                    return callback?.();
                }
            } else {
                const newValue = blockType.value * 2;
                const newIndex = blockTypes.findIndex(bt => bt.value === newValue);
                if (newIndex !== -1) {
                    block.spriteIndex = newIndex;
                    score += newValue;
                } else {
                    // No next level block (like merging two 256s)
                    score += blockType.value * 2;
                    blocks = blocks.filter(b => b !== block); // Remove top block too
                    return callback?.();
                }
            }

            // Play the merging sound effect
            mergeSound.play();

            console.log("Merge");

            return setTimeout(() => {
                mergeBlocks(block, callback);
            }, MERGE_DELAY); // How long to pause before another merge
        }
    }

    if (callback) callback();
} // mergeBlocks


// Find the location of where the block would place if dropped
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
    backgroundMusic.pause();
    currentTrackIndex = (currentTrackIndex + 1) % playlist.length; // Modulus for wraparound
    backgroundMusic = playlist[currentTrackIndex];
    backgroundMusic.play();
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
    if (!activeBlock || dropInProgress) return; // Prevent multiple drops

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
            console.log(`Placed in row ${landedRow}`);

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
    }, DROP_SPEED);

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
            pauseSound.play();
            console.log("Game paused");
            drawPauseScreen();
        } else {  // Unpausing the game
            gamePaused = false;

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
}


// Start the music
function startMusic() {
    if (backgroundMusic.paused) {
        backgroundMusic.play();
    }
}


// Stop the music
function stopMusic() {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0; // Reset to the beginning
}


// DIY debugger overlay for mobile since the console isn't available
function logDebug(message) {
    let debugDiv = document.getElementById("debugLog");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
        debugDiv.scrollTop = debugDiv.scrollHeight; // Auto-scroll to newest logs
    }
}


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
        dropSound.play();

    } else {
        dropBlock();
    }
});


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
});


// Right-click to pause
canvas.addEventListener('mousedown', function(event) {
    if (event.button === 2) { // Right mouse button
        event.preventDefault(); // Stop context menu
        event.stopPropagation(); // Stop any other event from firing
        togglePause();
    }
});

// Prevent default right-click context menu globally
canvas.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});


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
                "Digit4": "Zap",
                "Digit5": "Kaboom",
                "Digit6": "Magnet",
                "Digit7": "Bug",
                "Digit8": "Blaster",
                "Digit9": "Laser"
            };

            const targetType = devSpecialBlockHotkeys[code];
            if (targetType) {
                const index = blockTypes.findIndex(bt => bt.type === targetType && bt.enabled !== false);
                if (index !== -1) {
                    setActiveBlockByIndex(index);
                    console.log(`Dev block set to special: ${targetType} | Index: ${index}`);
                } else {
                    console.warn("Special block not found or disabled:", targetType);
                }
                return; // Prevent gameplay actions after dev override
            }
        } else if (code.startsWith("Digit")) {
            const number = parseInt(code.replace("Digit", ""), 10);
            if (number >= 1 && number <= 9) {
                const blocValue = Math.pow(2, number - 1);
                const index = blockTypes.findIndex(bt => bt.value === blockValue);
                if (index !== -1) {
                    setActiveBlockByIndex(index);
                    console.log("Block set to: " + blockValue);
                } else {
                    console.warn("Numeric block not found for value:", value);
                }
                return; // Prevent gameplay actions after dev override
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