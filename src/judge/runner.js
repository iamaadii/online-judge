import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { languages } from "./languages.js";

const MAX_OUTPUT_CHARS = 64 * 1024;
const STARTUP_ALLOWANCE_MS = 1500;

function killContainer(containerName) {
  const killer = spawn("docker", ["kill", containerName]);
  killer.on("error", () => {});
}

function runContainer(args, containerName, input, timeLimitMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn("docker", args);

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let outputTooLong = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killContainer(containerName);
    }, timeLimitMs + STARTUP_ALLOWANCE_MS);

    child.stdout.on("data", (chunk) => {
      if (outputTooLong) {
        return;
      }
      stdout = stdout + chunk.toString();
      if (stdout.length > MAX_OUTPUT_CHARS) {
        outputTooLong = true;
        stdout = stdout.slice(0, MAX_OUTPUT_CHARS);
        killContainer(containerName);
      }
    });

    child.stderr.on("data", (chunk) => {
      if (outputTooLong) {
        return;
      }
      stderr = stderr + chunk.toString();
      if (stderr.length > MAX_OUTPUT_CHARS) {
        outputTooLong = true;
        stderr = stderr.slice(0, MAX_OUTPUT_CHARS);
        killContainer(containerName);
      }
    });

    child.stdin.on("error", () => {});
    child.stdin.write(input + "\n");
    child.stdin.end();

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({
        timedOut: timedOut,
        outputTooLong: outputTooLong,
        exitCode: exitCode,
        stdout: stdout,
        stderr: stderr,
        timeMs: Date.now() - startedAt,
      });
    });
  });
}

export async function runInSandbox(options) {
  if (!Object.hasOwn(languages, options.language)) {
    throw new Error("Unsupported language: " + options.language);
  }

  const language = languages[options.language];
  const timeLimitMs = options.timeLimitMs || 2000;
  const memoryLimitMb = options.memoryLimitMb || 128;

  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "judge-"));

  try {
    await fs.chmod(folder, 0o755);
    await fs.writeFile(path.join(folder, language.fileName), options.code, { mode: 0o644 });

    const containerName = "judge-" + randomUUID();
    const memory = memoryLimitMb + "m";

    const args = [
      "run", "--rm", "-i",
      "--name", containerName,
      "--network", "none",
      "--memory", memory,
      "--memory-swap", memory,
      "--cpus", "0.5",
      "--pids-limit", "64",
      "--read-only",
      "--cap-drop", "ALL",
      "--security-opt", "no-new-privileges",
      "--user", "1000:1000",
      "-v", folder + ":/code:ro",
      language.image,
    ].concat(language.command);

    return await runContainer(args, containerName, options.input, timeLimitMs);
  } finally {
    await fs.rm(folder, { recursive: true, force: true });
  }
}