import { runInSandbox } from "./runner.js";

const samples = [
  {
    name: "Correct sum",
    input: "3 4",
    code: [
      'const fs = require("fs");',
      'const p = fs.readFileSync(0, "utf8").trim().split(" ");',
      "console.log(Number(p[0]) + Number(p[1]));",
    ].join("\n"),
  },
  {
    name: "Infinite loop",
    input: "",
    code: "while (true) {}",
  },
  {
    name: "Memory hog",
    input: "",
    code: [
      "const chunks = [];",
      "while (true) {",
      "  chunks.push(Buffer.alloc(10 * 1024 * 1024, 1));",
      "}",
    ].join("\n"),
  },
  {
    name: "Crash",
    input: "",
    code: 'console.error("something went wrong"); process.exit(3);',
  },
  {
    name: "Too much output",
    input: "",
    code: 'while (true) { console.log("spam spam spam spam spam"); }',
  },
  {
    name: "Internet",
    input: "",
    timeLimitMs: 5000,
    code: 'fetch("https://example.com").then(() => console.log("got internet")).catch(() => console.log("no internet"));',
  },
];

async function main() {
  const rows = [];

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];

    const result = await runInSandbox({
      language: "javascript",
      code: sample.code,
      input: sample.input,
      timeLimitMs: sample.timeLimitMs || 2000,
      memoryLimitMb: 128,
    });

    rows.push({
      name: sample.name,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      outputTooLong: result.outputTooLong,
      timeMs: result.timeMs,
      stdout: result.stdout.trim().slice(0, 25),
      stderr: result.stderr.trim().split("\n")[0].slice(0, 40),
    });
  }

  console.table(rows);
}

main();