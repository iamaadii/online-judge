import { test } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.JUDGE_URL || "http://localhost:3000";
const PROBLEM_SLUG = "sum-of-two"; // CHECK: a slug from your seed.js
const SIGNUP_PATH = "/auth/signup"; // CHECK: your signup route
const LOGIN_PATH = "/auth/login"; // CHECK: your login route

const CORRECT_JS = `
const lines = require("fs").readFileSync(0, "utf8").trim().split(" ");
console.log(Number(lines[0]) + Number(lines[1]));
`;

const WRONG_JS = `
const lines = require("fs").readFileSync(0, "utf8").trim().split(" ");
console.log(Number(lines[0]) + Number(lines[1]) + 1);
`;

async function sendJson(path, method, body, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

async function makeLoggedInUser() {
  const unique = Date.now() + "-" + Math.floor(Math.random() * 100000);
  const credentials = {
    name: "tester",
    email: `tester-${unique}@example.com`,
    password: "password123",
  };
  await sendJson(SIGNUP_PATH, "POST", credentials);
  const login = await sendJson(LOGIN_PATH, "POST", credentials);
  return login.data.token;
}

async function submitCode(token, code) {
  return sendJson(
    "/submissions",
    "POST",
    { problemSlug: PROBLEM_SLUG, language: "javascript", code },
    token
  );
}

async function waitForVerdict(token, submissionId) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const result = await sendJson(`/submissions/${submissionId}`, "GET", null, token);
    const verdict = result.data.verdict;
    if (verdict && verdict !== "Pending" && verdict !== "Running") {
      return result.data;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Verdict did not arrive in 30 seconds. Is the worker running?");
}

function getSubmissionId(data) {
  return data.submissionId || data._id || data.id; // CHECK: your 202 response field
}

test("submit without login is rejected", async () => {
  const result = await sendJson("/submissions", "POST", {});
  assert.equal(result.status, 401);
});

test("correct code gets Accepted", async () => {
  const token = await makeLoggedInUser();
  const submitted = await submitCode(token, CORRECT_JS);
  assert.equal(submitted.status, 202);
  const finalResult = await waitForVerdict(token, getSubmissionId(submitted.data));
  assert.equal(finalResult.verdict, "Accepted");
});

test("wrong code gets Wrong Answer", async () => {
  const token = await makeLoggedInUser();
  const submitted = await submitCode(token, WRONG_JS);
  const finalResult = await waitForVerdict(token, getSubmissionId(submitted.data));
  assert.equal(finalResult.verdict, "Wrong Answer");
});

test("6th submission in a minute gets 429", async () => {
  const token = await makeLoggedInUser();
  let lastStatus = 0;
  for (let count = 1; count <= 6; count++) {
    const result = await submitCode(token, CORRECT_JS);
    lastStatus = result.status;
  }
  assert.equal(lastStatus, 429);
});