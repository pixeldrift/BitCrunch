"use strict";

// Tiny test runner: node tests/run.js [name filter]
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const tests = [];
global.test = (name, fn) => tests.push({ name, fn });
global.assert = assert;

fs.readdirSync(__dirname)
    .filter(f => f.endsWith(".test.js"))
    .sort()
    .forEach(f => require(path.join(__dirname, f)));

const filter = process.argv[2];
let failed = 0;
for (const { name, fn } of tests) {
    if (filter && !name.includes(filter)) continue;
    try {
        fn();
        console.log("  ok   " + name);
    } catch (e) {
        failed++;
        console.log("  FAIL " + name + "\n       " + String(e.message).split("\n").join("\n       "));
    }
}
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
