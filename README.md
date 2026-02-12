# BitCrunch

## A binary falling block game

### Play Now: [pizar.net/BitCrunch]

## Gameplay

The game board consists of a grid 4 blocks wide by 12 blocks tall. A random block appears at the top of the board and begins to fall. The player can move it right or left, and optionally drop it immediately.

Stacking two blocks of the same number value makes them merge together and the new resulting block contains the combined, doubled value. Once blocks have reached a value of 256, another merge will remove them from the board.

Occasionally, random special blocks will appear, each one with different characteristics that can help or hinder the player.


## Controls

```
Enter		Start Game
←  A		Move Left
→  D		Move Right
↓  S  ␣		Drop Block
P  Esc		Pause/Resume
T			Next Music Track
M			Toggle Music
F			Toggle Sound FX
G			Toggle Ghost
X  Q		End Game
```

Mouse controls are available, but keyboard input is generally recommended for best gameplay. Though the game is not optimized for mobile, gesture controls work too.

## Specials

```
1 – Bug		Doesn’t merge, can only be removed by other specials
2 – Wild	Merges with any other block
3 – Swap	Makes the block it lands on swap Positions with the one below it	
4 – Bomb	Destroys any block it lands on
5 – Magnet	Scrambles the blocks in a column
6 – Zap		Destroys all touching blocks in a single horizontal row
7 – Nuke	Destroys all blocks in the column
8 – Blaster	Doesn’t drop, fires downward destroying blocks
```


## Scoring

Number blocks range from 1 to 256, doubling in value for each step.

```
1	2	4	8	16	32	64	128	256
```

When a block lands and settles on the grid, its value is added to the score. When a block is destroyed, its value is added to the score also.

If two blocks of the same value collide, they merge into a single block with their values combined, from top to bottom. The score is increased based on the new merged block's value. If a pair of 256 blocks merge, the player is awarded 512 points and they are removed from the board.

Examples:
Two "2" blocks merge → new block is "4" → score increases by 4.
Two "16" blocks merge → new block is "32" → score increases by 32.
Two "128" blocks merge → new block is "256" → score increases by 256.

Should there be combo bonuses for multiple merges in a row? For cascading merges?


## Block Generation

For better gameplay, the value of a newly spawned block is not entirely random. It would be no fun to start off with the highest blocks immediately. To address this, the blocks are given a weighted distribution.

Each block type is assigned a weight, which is essentially a number that determines how likely it is to appear. Higher weights mean the block is more likely to appear, and lower weights mean it’s less likely to appear. 
When the game spawns a new block, it picks randomly, but the chance of each block being picked depends on its weight. At the start, the weights are as follows:

1:	50%				
2: 	30%
4:	15%
8:	5%

As higher numbers are created through merging, we add the opportunity for those higher numbers to be spawned on new blocks and adjust the probabilities.

```
   8:	  10%
  16:	   5%
  32:	   3%
64 >:	   1%
```

There is also a 10% chance of receiving a special block vs. a standard numeric block. Currently special blocks are entirely random but will eventually also be weighted based on their power.
 
## To Do

### Known Bugs:
	•	￼Sometimes blocks continue to be drawn after being destroyed by Nuke
	•	￼Sound continues to play on mobile when browser is minimized
	•	￼iOS does not allow sound volume adjustment via javascript

### Features:

	•	￼Basic game grid with falling blocks
	•	￼Keyboard controls to move active block
	•	￼Collision detection to prevent overlap
	•	￼Block merging with recursion
	•	￼Calculate points and track high score
	•	￼Mouseover/click action on Play button
	•	￼Pause function with animation
	•	￼Restart game without reloading browser
	•	￼Music that cycles through a playlist
	•	￼Sound effects for main actions
	•	￼Spawn with weighted values rather than purely random
	•	￼Persistent high scores using cookies
	•	￼Key controls cheat sheet
	•	￼Mouse controls for movement with click to drop
	•	￼Prevent lateral movement when blocks are dropping
	•	￼Ghost block hinting (toggleable)
	•	￼Console log status messages
	•	￼Dev “cheat code” to manually set block type
	•	￼Graphics for special blocks
	•	￼Enable/disable special blocks
	•	￼Add special blocks or powerups
	◦	￼Wild		Merges with any other block to become the next largest
	◦	￼Swap		Makes any block it lands on swap with the one below it	
	◦	￼Bomb		Destroys whatever single block it lands on
	◦	￼Magnet		Scrambles the block it lands on into a random value
	◦	￼Zap		Destroys the entire row for whatever block it lands on
	◦	￼Nuke		Destroys the entire column	
	◦	￼Bug		Doesn’t merge, can only be removed other specials
	◦	￼Blaster	Doesn’t drop, fires downward to destroy blocks
	•	￼Make a global mergedown check to avoid floating blocks
	•	￼Add additional animations
	◦	￼Basic merge (blend the two blocks together like inverse mitosis)
	◦	￼Basic remove (shrink block?)
	◦	￼Bug
	◦	￼Wild (glow or sparkle when merging?)
	◦	￼Swap
	◦	￼Bomb
	◦	￼Magnet
	◦	￼Zapping electricity
	◦	￼Nuke
	◦	￼Blaster
	•	￼Placing blocks adds their value to score
	•	￼Destroying blocks adds their value to score also
	•	￼Animate scores being added by floating off the blocks
	•	￼Toggle music and sound effects


	•	￼Count sequential merges and give bonus points for combo chains
	•	￼Increase pitch of sound effect for each combo merge
	•	￼Refine touch gesture controls for mobile
	•	￼Increase difficulty as the game progresses. Faster falling speed? Levels?
	•	￼Prevent specials from showing up too soon in the game
	•	￼Balance frequency of special blocks based on their power
	•	￼Expand canvas height to move scorebar and option buttons outside grid
	•	￼Test different game grid sizes?
	•	￼Mute and volume controls for Music and SFX with on-screen icons
	•	￼On-screen buttons for ghost, pause, and ending game (important for mobile)
	•	￼Help/credits screen
	•	￼Rearrange sprite sheets, improve design of graphics, and add more visuals
	•	￼Refactor all code, convert to use React instead of canvas?
	•	￼Make native iPhone port


## About

I am not a programmer! I’m an animator and designer by day and did this just for fun as a learning exercise. BitCrunch is an idea I’ve had in my head for a long time and the graphics in the game are from a sprite sheet I made many years ago. I finally decided to go ahead and try to implement a basic version of the working game as a fun challenge just to see if I could.

Since I’m a hobbyist rather than an actual software developer, every feature added meant a new thing I had to learn how to code and figure out along the way. 

This initial version was written purely in plain JavaScript canvas without any frameworks. You can view the code here:

**[pizar.net/BitCrunch/BitCrunch.js](pizar.net/BitCrunch/BitCrunch.js)**

I tried to keep it as neat and organized as possible, but there are definitely places where I used  inconsistent methods for various parts of the game as I learned new techniques or the logic became more complicated as I added features.


## Feedback

I would definitely love for as many people to test it as possible, and give detailed feedback. Whether it be gameplay mechanics, glitches, you encounter, or thoughts on creative aspects like the graphics and sound. There are still things left to be implemented (see [To Do](#to-do) above) and I know it’s rough, but hopefully it’s playable and even a little fun. Enjoy!


