import fs from "fs";

try {
  fs.writeFileSync("/code/hacked.txt", "hello");
  console.log("I wrote a file");
} catch (err) {
  console.log("Cannot write:", err.code);
}