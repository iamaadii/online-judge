const fs = require("fs");

const numbers = fs.readFileSync(0, "utf8")
    .trim()
    .split(/\s+/)
    .map(Number);

console.log(numbers[0] + numbers[1]);