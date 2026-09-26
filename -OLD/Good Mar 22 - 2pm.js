    //
    // ===== SETUP =====
    //

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
const blockWidth = 100;
const blockHeight = 60;
const dropSpeed = 20; // Drop speed, in pixels per refresh
const refreshRate = 1000; // Update how many times per second
const mergeDelayTime = 100;
const NUMERIC_BLOCK_COUNT = 9; // This includes 1 through 256

// Because we change the gravity speed temporarily when dropping
let gravity = 1; // Falling speed, in pixels per refresh

let gameRunning = false;
let gameOver = false; // delete later
let gamePaused = false;
let blocks = [];
let activeBlock = null; // Track the active falling block
let score = 0;
let highScore = 0;
let showGhostBlock = true;
let allowSpecialBlocks = false;

// Check if localStorage is available and retrieve high score
if (typeof localStorage !== "undefined") {
    const storedHighScore = localStorage.getItem("bitCrunchHighScore");
    if (storedHighScore !== null) {
        highScore = parseInt(storedHighScore, 10);
    }
}

let countdown = null;
let countdownValue = 3;

// Game graphics
const spriteSheet = new Image();
spriteSheet.src = "graphics/BitCrunch-Sprite-Sheet.png";

const logoSprite = new Image();
logoSprite.src = "graphics/Bit-Crunch-Logo.png";

// Misc graphics
const logo = { x: 0, y: 0, width: 400, height: 400 }
const gameGrid = { x: 0, y: 0, width: 400, height: 720 };
const scoreBoard = { x: 300, y: 720, width: 300, height: 240 };
const scoreBar = { x: 300, y: 960, width: 300, height: 42 };
const playButton = { x: 0, y: 720, width: 300, height: 120 };
const playButtonHighlight = {x: 0, y: 840, width: 300, height: 120 };

// Block Definitions
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
  
    { type: "Wild", value: null, x: 500, y: 0, width: 100, height: 60, enabled: false },
    { type: "Swap", value: null, x: 500, y: 60, width: 100, height: 60, enabled: false },
    { type: "Bomb", value: null, x: 500, y: 120, width: 100, height: 60, enabled: false },
    { type: "Zap", value: null, x: 500, y: 180, width: 100, height: 60, enabled: false },
    { type: "Kaboom", value: null, x: 500, y: 240, width: 100, height: 60, enabled: false },
    { type: "Magnet", value: null, x: 500, y: 300, width: 100, height: 60, enabled: false },
    { type: "Bug", value: null, x: 500, y: 360, width: 100, height: 60, enabled: false },
    { type: "Boom1", value: null, x: 500, y: 420, width: 100, height: 60, enabled: false },
    { type: "Boom2", value: null, x: 500, y: 480, width: 100, height: 60, enabled: false },
    { type: "Boom3", value: null, x: 500, y: 540, width: 100, height: 60, enabled: false },
    { type: "Blaster", value: null, x: 500, y: 600, width: 100, height: 60, enabled: false },
    { type: "Laser", value: null, x: 500, y: 660, width: 100, height: 60, enabled: false }
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


//
// ===== Object Definition
//

class Block {
    constructor(x, y, spriteIndex) {
        if (
            typeof spriteIndex !== "number" ||
            spriteIndex < 0 ||
            spriteIndex >= blockTypes.length
        ) {
            console.error("Invalid spriteIndex:", spriteIndex);
            spriteIndex = 0; // fallback to first block type
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
}
 // class Block



    //
    // ===== Functions =====
    //


    function drawRowNumbers() {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "16px Silkscreen";
        ctx.textAlign = "left";
    
        for (let i = 0; i < 12; i++) {
            let rowNumber = 12 - i;
            let y = i * blockHeight + blockHeight / 2 + 5;
            ctx.fillText(rowNumber, 5, y);
        }
    }

    

    // Sprite lookup for a given block type
    function getBlockSprite(type) {
        return blockTypes.find(b => b.type === type);
    }

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
    startingCountdown();
    console.log("New game");
} // resetGame

// Main game loop

let animationFrameId = null;

// Things we do every cycle
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

function createBlock() {
    if (activeBlock) return;

    const index = getWeightedBlockValue();
    const xPos = Math.floor(Math.random() * (canvas.width / blockWidth)) * blockWidth;

    if (blocks.some(b => b.x === xPos && b.y === 0)) {
        endGame();
        return;
    }

    activeBlock = new Block(xPos, 0, index);
    console.log("New block");
} // createBlock


function updateBlocks() {
    if (!gameRunning || gamePaused || !activeBlock) return;

    let nextY = activeBlock.y + gravity;

    // Check if the active block can fall further
    if (nextY + blockHeight > canvas.height || checkCollision(activeBlock)) {
        if (!activeBlock) return;

        // The block has landed, finalize its position
        activeBlock.y = Math.floor(activeBlock.y / blockHeight) * blockHeight;

        let placedBlock = { ...activeBlock }; // Clone before nullifying
        blocks.push(placedBlock);

        // Report what row it landed in.
        let landedRow = 12 - Math.floor(placedBlock.y / blockHeight);
        console.log("Placed at row:", 12 - (placedBlock.y / blockHeight));

        const row = Math.floor(placedBlock.y / blockHeight);
        console.log(`Placed by gravity in row ${row}`);

        activeBlock = null; // Prevent further movement until a new block spawns

        placeSound.play();

        // Delay merging to ensure proper placement
        setTimeout(() => {
            mergeBlocks(placedBlock, () => {
                // Create a new block only after all merges are done
                if (!activeBlock && gameRunning) {
                    createBlock();
                }
            });
        }, mergeDelayTime);
    } else {
        // Move the active block down naturally
        activeBlock.y = nextY;
    }
} // updateBlocks

function startingCountdown() {

    startSound.play();
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
    }, 1000);
} // startingCountdown


// Draw the game
function drawGame() {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!gameRunning && countdown === null) {
        drawWelcomeScreen();
    } else if (!gameRunning && countdown !== null && countdownValue > 0) {
        drawCountdown();
    } else if (gameOver) {
        drawScoreboardScreen();
    } else {
        drawGameScreen();
    }
} // drawGame

// Welcome screen
function drawWelcomeScreen() {
    // Background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Background grid
    ctx.drawImage(spriteSheet, gameGrid.x, gameGrid.y, gameGrid.width, gameGrid.height, 0, 0, canvas.width, canvas.height);

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
} // drawWelcome

// Countdown
function drawCountdown() {
    // Background grid
    ctx.drawImage(spriteSheet, gameGrid.x, gameGrid.y, gameGrid.width, gameGrid.height, 0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#f16d01"; // Orange
    ctx.font = "100px Silkscreen";
    ctx.textAlign = "center";
    dropShadow(true);
    ctx.fillText(countdownValue > 0 ? countdownValue : "GO!", 200, 390);
    dropShadow(false);
} // drawCountdown

// Draw individual blocks
function drawBlock(block) {
    ctx.drawImage(
      spriteSheet,
      block.sprite.x, block.sprite.y,
      block.sprite.width, block.sprite.height,
      block.x, block.y,
      blockWidth, blockHeight
    );
  }
  

// Game screen
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
        if (!block.sprite) {
            console.warn("Block has no sprite");
            return;
        }
    
        ctx.drawImage(
            spriteSheet,
            block.sprite.x, block.sprite.y, block.sprite.width, block.sprite.height,
            block.x, block.y, blockWidth, blockHeight
        );
    });

    // Draw ghost block, if enabled
    if (activeBlock && showGhostBlock) {
        const ghostPos = getGhostPosition();
        if (ghostPos) {
            ctx.lineWidth = 3;
            ctx.fillStyle = "rgba(173, 216, 230, 0.1)"; // Light blue
            ctx.strokeStyle = "rgba(241, 109, 1, 0.25)"; // Orange
            ctx.shadowColor = "rgba(241, 109, 1, 0.5)";
            ctx.shadowBlur = 16;
            ctx.fillRect(ghostPos.x, ghostPos.y, blockWidth, blockHeight);
            ctx.strokeRect(ghostPos.x, ghostPos.y, blockWidth, blockHeight);
            ctx.shadowBlur = 0;
        }
    }

    if (activeBlock && activeBlock.sprite) {
        ctx.drawImage(
            spriteSheet,
            activeBlock.sprite.x, activeBlock.sprite.y,
            activeBlock.sprite.width, activeBlock.sprite.height,
            activeBlock.x, activeBlock.y,
            blockWidth, blockHeight
        );
    }

    drawRowNumbers();

    // Optionally draw top score bar (commented out for now)
    /*
    dropShadow(true);
    ctx.drawImage(spriteSheet, scoreBar.x, scoreBar.y, scoreBar.width, scoreBar.height, 50, 10, 300, 42);
    dropShadow(false);

    ctx.fillStyle = "white";
    ctx.font = "24px Silkscreen";
    ctx.textAlign = "right";
    ctx.fillText(score, 310, 38);

    ctx.textAlign = "left";
    ctx.fillText(currentTrackIndex+1, 20, 38);
    */
} //drawGameScreen


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

    // Start the scoreboard animation with the orange block
    fillGrid(getBlockSprite("Orange"), 20, drawFinalScore);
}

function drawFinalScore() {
    dropShadow(true);

    // Draw the scoreboard frame
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

    // Draw score values
    ctx.fillStyle = "white";
    ctx.font = "38px Silkscreen";
    ctx.textAlign = "center";
    ctx.fillText(score, 200, 290);
    ctx.fillText(highScore, 200, 366);

} // drawScoreboardScreen


// Fill the game grid with a specified block sprite
function fillGrid(blockSprite, speed, callback = null) {
    
    let yStart = canvas.height - blockHeight;
    let xStart = 0;
    let gridFilling = true; // Prevent multiple calls

    function drawNextBlock() {
        if (!gridFilling) return; // Stop if game resets

        if (yStart < 0) {
            gridFilling = false; // Stop further execution
            if (callback) callback(); // Call the callback function after grid is filled
            return;
        }

        // Draw a block
        ctx.drawImage(spriteSheet, blockSprite.x, blockSprite.y, blockSprite.width, blockSprite.height, xStart, yStart, blockWidth, blockHeight);

        xStart += blockWidth;
        if (xStart >= canvas.width) {
            xStart = 0;
            yStart -= blockHeight;
        }
        
        setTimeout(drawNextBlock, speed); // Adjust speed of filling animation
    }

    drawNextBlock();
} // fillGrid


function checkCollision(block) {
    const nextY = block.y + gravity;

    // Bottom boundary check
    if (nextY + blockHeight > canvas.height) {
        return true;
    }

    // Check for overlapping with settled blocks
    return blocks.some(other => {
        const sameColumn = block.x === other.x;
        const overlapY = nextY + blockHeight > other.y && block.y < other.y;

        return sameColumn && overlapY;
    });
}
 // checkCollision


 function mergeBlocks(block, callback = null) {
    if (!block) return;

    const blockBelowIndex = blocks.findIndex(
        b => b.x === block.x && b.y === block.y + blockHeight
    );

    if (blockBelowIndex !== -1) {
        const blockBelow = blocks[blockBelowIndex];
        const blockType = blockTypes[block.spriteIndex];
        const belowType = blockTypes[blockBelow.spriteIndex];

        const isWild = blockType.type === "Wild";
        const canMerge = isWild || (blockType.value !== null && blockType.value === belowType.value);

        if (canMerge) {
            // Remove the block below
            blocks.splice(blockBelowIndex, 1);

            // Move the top block down to the merged position
            block.y += blockHeight;

            // Determine new value
            if (isWild && belowType.value !== null) {
                const newValue = belowType.value * 2;
                const newTypeIndex = blockTypes.findIndex(bt => bt.value === newValue);
                if (newTypeIndex !== -1) {
                    block.spriteIndex = newTypeIndex;
                    block.sprite = blockTypes[newTypeIndex];  // <- important fix
                    score += newValue;
                } else {
                    console.warn("No matching block type for value:", newValue);
                    return callback?.();
                }
            } else {
                const newIndex = block.spriteIndex + 1;
                if (newIndex < blockTypes.length && blockTypes[newIndex].value !== null) {
                    block.spriteIndex = newIndex;
                    block.sprite = blockTypes[newIndex];  // <- important fix
                    score += blockTypes[newIndex].value;
                } else {
                    console.warn("Invalid merge index:", newIndex);
                    return callback?.();
                }
            }

            mergeSound.play();
            console.log("Merge:", blockTypes[block.spriteIndex].type);

            return setTimeout(() => {
                mergeBlocks(block, callback);
            }, 100);
        }
    }

    if (callback) callback();
} // mergeBlocks


function getGhostPosition() {
    if (!activeBlock) return null;

    let ghostX = activeBlock.x;
    let ghostY = 0;

    for (let y = 0; y <= canvas.height - blockHeight; y += blockHeight) {
        let occupied = blocks.some(b => b.x === ghostX && b.y === y);
        if (!occupied) {
            ghostY = y;
        } else {
            break;
        }
    }

    return { x: ghostX, y: ghostY };
}



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

    stopMusic();
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


function moveBlockLeft() {
    if (!activeBlock || dropInProgress) return;

    let newX = activeBlock.x - blockWidth;

    let collision = blocks.some(b => 
        b.x === newX &&
        b.y < activeBlock.y + blockHeight &&
        b.y + blockHeight > activeBlock.y
    );

    if (newX >= 0 && !collision) {
        activeBlock.x = newX;
        leftSound.play();
    }
}// moveBlockLeft

function moveBlockRight() {
    if (!activeBlock || dropInProgress) return;

    let newX = activeBlock.x + blockWidth;

    let collision = blocks.some(b => 
        b.x === newX &&
        b.y < activeBlock.y + blockHeight &&
        b.y + blockHeight > activeBlock.y
    );

    if (newX < canvas.width && !collision) {
        activeBlock.x = newX;
        rightSound.play();
    }
} // moveBlockRight()

let dropInProgress = false; // Track if a drop is already happening

function dropBlock() {
    console.log("Drop");
    if (!activeBlock || dropInProgress) return; // Prevent multiple drops

    dropInProgress = true; // Prevent side-to-side movement while dropping
    let maxY = canvas.height - blockHeight;
    let columnBlocks = blocks.filter(b => b.x === activeBlock.x).sort((a, b) => a.y - b.y);

    dropSound.play();

    for (let b of columnBlocks) {
        if (b.y > activeBlock.y) {
            maxY = Math.min(maxY, b.y - blockHeight);
            break;
        }
    }

    let dropInterval = setInterval(() => {
        if (!activeBlock) {
            clearInterval(dropInterval);
            dropInProgress = false;
            return;
        }

        if (activeBlock.y + dropSpeed < maxY) {
            activeBlock.y += dropSpeed;
        } else {
            clearInterval(dropInterval);
            activeBlock.y = Math.floor(maxY / blockHeight) * blockHeight;

            let placedBlock = new Block(activeBlock.x, activeBlock.y, activeBlock.spriteIndex);

            blocks.push(placedBlock);


            let landedRow = 12 - Math.floor(placedBlock.y / blockHeight);
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
            }, 150);
        }
    }, 10);
} // dropBlock


function getWeightedBlockValue() {
    const blockCounts = {};
    const totalBlocks = blocks.length;

    // Count values already on the board
    blocks.forEach(block => {
        const value = block.value;
        if (value !== null && value !== undefined) {
            blockCounts[value] = (blockCounts[value] || 0) + 1;
        }
    });

    const maxValue = Math.max(...Object.keys(blockCounts).map(Number), 1);

    const regularProbabilities = {
        1: 50,
        2: 30,
        4: 15,
        8: 5,
    };

    if (maxValue >= 8) regularProbabilities[8] = 10;
    if (maxValue >= 16) regularProbabilities[16] = 5;
    if (maxValue >= 32) regularProbabilities[32] = 3;
    if (maxValue >= 64) regularProbabilities[64] = 1;

    const SPECIAL_BLOCK_CHANCE = 5; // 5% chance of getting a special block
    const specialRoll = Math.random() * 100;

    if (specialRoll < SPECIAL_BLOCK_CHANCE && allowSpecialBlocks) {
        const specialIndex = NUMERIC_BLOCK_COUNT + Math.floor(Math.random() * (blockTypes.length - NUMERIC_BLOCK_COUNT));
        return specialIndex;
    }
    

    const sum = Object.values(regularProbabilities).reduce((a, b) => a + b, 0);
    const random = Math.random() * sum;

    let cumulative = 0;
    for (let value in regularProbabilities) {
        cumulative += regularProbabilities[value];
        if (random < cumulative) {
            const match = blockTypes.find(b => b.value === parseInt(value) && b.enabled);
            return match ? blockTypes.indexOf(match) : 0;
        }
    }

    return 0; // fallback
}
 // getWeightedBlockValue;


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

    //
    // MOUSE AND KEYBOARD
    //

let isHoveringPlayButton = false;
let isClickingPlayButton = false;

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
});


// Mouse release on Play button
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

// Also prevent default right-click menu globally
canvas.addEventListener('contextmenu', function(event) {
    event.preventDefault();
});


// Mouse listener for horizontal block movement
canvas.addEventListener("mousemove", function(event) {
    if (activeBlock && gameRunning && !gamePaused) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        let newBlockX = Math.floor(mouseX / blockWidth) * blockWidth;

        if (newBlockX !== activeBlock.x) {
            if (newBlockX < activeBlock.x) {
                moveBlockLeft();
            } else if (newBlockX > activeBlock.x) {
                moveBlockRight();
            }
        }
    }
});

// Keyboard input
document.addEventListener("keydown", function(event) {

    // Any key at scoreboard screen goes to welcome screen
    if (gameOver) {
        gameOver = false;
        drawWelcomeScreen();
        return;
    }
    // Enter key at welcome screen starts game
    if (!gameRunning && event.key === "Enter") {
        resetGame();
        return;
    }
    if (gamePaused) {
        // Any key unpauses
        togglePause();
        return;
    }

    // Gameplay controls
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
    }
});


// Start the game loop only after the sprite sheet loads
spriteSheet.onload = () => {
    logoSprite.onload = () => {
        drawWelcomeScreen();
        console.log("It's time to BitCrunch!");
    };
};

setInterval(() => {
    if (gameRunning && !gameOver && !activeBlock) {
        createBlock();
    }
}, refreshRate);


function logDebug(message) {
    let debugDiv = document.getElementById("debugLog");
    if (debugDiv) {
        debugDiv.innerHTML += message + "<br>";
        debugDiv.scrollTop = debugDiv.scrollHeight; // Auto-scroll to newest logs
    }
}


    //
    // Touch gesture controls for mobile
    //

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
    if (Math.abs(deltaX) >= blockWidth) {
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
