"use strict";

// ====================
// HELP CONTENT
// ====================
// The text of the instruction screen, as plain data. The Renderer lays it out.
//
// Item types:
//   paragraph  { text }                     wrapped text
//   heading    { text }                     orange section heading
//   rows       { rows: [[key, text], ...] } two columns: a control and what it does
//   block      { name, text }               a block sprite with a description
//   numbers    {}                           the row of number blocks, 1 to 256

const HelpContent = Object.freeze({
    pages: [
        {
            title: "HOW TO PLAY",
            items: [
                { type: "paragraph", text: "Blocks fall one at a time. Stack two with the same number and they merge into one worth double." },
                { type: "numbers" },
                { type: "paragraph", text: "Merge two 256s and they vanish. Don't let the stack reach the top!" },
                { type: "heading", text: "TOUCH" },
                { type: "rows", rows: [
                    ["DRAG", "Move the block"],
                    ["SWIPE DOWN", "Drop it (or fire the Blaster)"],
                    ["SWIPE UP", "Pause"],
                    ["TAP", "Nudge left or right"],
                ] },
                { type: "paragraph", text: "Tap the music and sound icons at the top to turn them on or off." },
            ],
        },
        {
            title: "KEYBOARD",
            keyboardOnly: true, // Skipped on phones and tablets
            items: [
                { type: "rows", rows: [
                    ["ENTER", "Start game"],
                    ["LEFT  A", "Move left"],
                    ["RIGHT  D", "Move right"],
                    ["DOWN  S  SPACE", "Drop block"],
                    ["P  ESC", "Pause or resume"],
                    ["M", "Music on or off"],
                    ["F", "Sound effects on or off"],
                    ["T", "Next music track"],
                    ["G", "Ghost block on or off"],
                    ["X  Q", "End game"],
                    ["H", "This screen (from the title or pause screen)"],
                ] },
                { type: "paragraph", text: "On a computer you can also steer with the mouse and click to drop. Right-click pauses." },
            ],
        },
        {
            title: "SPECIAL BLOCKS",
            items: [
                { type: "block", name: "Bug", text: "Doesn't merge. Only other specials can remove it." },
                { type: "block", name: "Wild", text: "Merges with any other block." },
                { type: "block", name: "Swap", text: "Swaps the two blocks below it." },
                { type: "block", name: "Bomb", text: "Destroys the block it lands on." },
                { type: "block", name: "Magnet", text: "Scrambles the blocks in its column." },
                { type: "block", name: "Zap", text: "Destroys the row of blocks it lands on." },
                { type: "block", name: "Nuke", text: "Destroys the whole column." },
                { type: "block", name: "Blaster", text: "Doesn't drop. Fires down and destroys blocks." },
            ],
        },
        {
            title: "LEVELS AND JUNK",
            items: [
                { type: "paragraph", text: "Every 10 blocks is a new level, and the blocks fall faster." },
                { type: "block", name: "Junk", text: "From level 4, junk rises from the bottom. It never merges." },
                { type: "paragraph", text: "The top of the screen shows how many blocks until the next junk." },
                { type: "paragraph", text: "Clear junk with a Bomb, Zap, Nuke or Blaster, or land a Wild on it." },
                { type: "heading", text: "SCORING" },
                { type: "paragraph", text: "Placing a block scores its value. So does destroying one, and every merge scores the new block's value." },
            ],
        },
    ],
});
