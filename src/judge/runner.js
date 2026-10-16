import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { languages } from "./languages.js";

const MAX_OUTPUT_CHARS = 64 * 1024;
const STARTUP_ALLOWANCE_MS = 1000;

function runDocker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout = stdout + chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr = stderr + chunk.toString();
    });

    child.on("error", (err) => {
      reject(err);
    });

    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode, stdout: stdout, stderr: stderr });
    });
  });
}

function killContainer(containerName) {
  const killer = spawn("docker", ["kill", containerName], { stdio: "ignore" });
  killer.on("error", () => {});
}

function removeContainer(containerName) {
  const remover = spawn("docker", ["rm", "-f", containerName], { stdio: "ignore" });
  remover.on("error", () => {});
}

function runContainer(containerName, input, timeLimitMs) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn("docker", ["start", "-a", "-i", containerName]);

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
  const containerName = "judge-" + randomUUID();

  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "judge-"));

  try {
    await fs.chmod(folder, 0o755);
    await fs.writeFile(path.join(folder, language.fileName), options.code, { mode: 0o644 });

    const memory = memoryLimitMb + "m";

    const createArgs = [
      "create", "--rm", "-i",
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

    const created = await runDocker(createArgs);

    if (created.exitCode !== 0) {
      throw new Error("Could not create the container: " + created.stderr.trim());
    }

    return await runContainer(containerName, options.input, timeLimitMs);
  } finally {
    removeContainer(containerName);
    await fs.rm(folder, { recursive: true, force: true });
  }
}