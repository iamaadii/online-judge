# Online Judge

A backend system that executes submitted code in isolated Docker containers and evaluates it against test cases. Below listed are the key-features:
- Users sign up and log in.
- They see problems (with some visible sample tests and some hidden tests).
- They submit code in JavaScript or Python.
- The server runs the code safely inside Docker, compares the output with the expected output, and returns a verdict like Accepted or Wrong Answer.

## The problem it solves

Running code written by strangers is dangerous. Their code can:
- loop forever and block the server
- eat all the memory
- read or delete files
- call the internet
- start thousands of processes (fork bomb)
- print gigabytes of output

So the project has two main jobs:
- **Run unsafe code safely** (the Docker sandbox).
- **Handle many submissions at once without crashing** (the Redis queue and worker).

## Real-world use

- Coding practice sites and contests
- Online interviews and hiring tests
- College assignments auto-checked by a server
- Learning platforms (run a student's code and give instant feedback)

## Tech stack and why each piece is there

| Tech | Why I used it |
|---|---|
| Node.js and Express | The API (routes, middleware) |
| MongoDB and Mongoose | Stores users, problems and submissions. Test cases fit well as documents inside a problem |
| JWT | Login without server-side sessions |
| bcrypt | Stores passwords as hashes, not plain text |
| Docker | The sandbox. Every run happens in an isolated container |
| Redis | Holds the queue and the rate limit counters |
| BullMQ | Queue library on top of Redis. Gives retries, concurrency and stalled-job recovery |
| node:test | Built-in test runner for the integration tests |
| Postman | Manual API testing (collection exported with all routes) |

## Big picture flow

1. Client sends `POST /submissions` with code, language and problem.
2. `requireLogin` checks the JWT. `submitLimit` checks the 5-per-minute limit.
3. API validates the input, saves the submission as `Pending` in MongoDB, adds a job (the submission id) to the Redis queue, and replies `202 Accepted` immediately.
4. The worker takes the job from the queue.
5. The worker calls `judgeSubmission`, which loops over the test cases. For each test case it runs the code in a fresh Docker container.
6. The first failing test stops the loop. The verdict is saved in MongoDB.
7. The client calls `GET /submissions/:id` and sees the verdict.

Analogy: a restaurant. The API is the waiter (takes the order and gives a token number at once). Redis is the order rack. The worker is the kitchen (cooks a few orders at a time). Docker is a clean, separate kitchen counter used for one dish and then thrown away.

## Folder and file guide

| File | Job |
|---|---|
| `docker-compose.yml` | Runs MongoDB, Redis and the API |
| `Dockerfile` | Builds the API image |
| `.env` | Secrets and settings (never committed) |
| `src/server.js` | Connects to the database and starts the API |
| `src/app.js` | Builds the Express app and mounts `/auth`, `/problems`, `/submissions` |
| `src/db.js` | `connectToDatabase()` |
| `src/seed.js` | Inserts 3 sample problems. Uses upsert by slug, so running it twice does not duplicate |
| `src/models/User.js` | User schema (email, password hash) |
| `src/models/Problem.js` | Problem schema with test cases and `isSample` flag |
| `src/models/Submission.js` | Submission schema: verdict, counters, index on `userId` and `createdAt` |
| `src/routes/authRoutes.js` | Signup and login |
| `src/routes/problemRoutes.js` | List problems, get one problem (samples only) |
| `src/routes/submissionRoutes.js` | Submit, list mine, get one |
| `src/middleware/requireLogin.js` | Checks the JWT and sets the user on the request |
| `src/middleware/submitLimit.js` | Per-user rate limit using Redis |
| `src/judge/languages.js` | For each language: image, file name, run command |
| `src/judge/runner.js` | Runs code in Docker for one test case |
| `src/judge/judge.js` | Loops over test cases and decides the verdict |
| `src/judge/tryRunner.js` | A manual try-out script with 6 sample programs |
| `src/queue/judgeQueue.js` | Creates the queue and adds jobs |
| `src/queue/worker.js` | The separate program that judges jobs |
| `tests/judge.test.js` | Integration tests |

## Ports and settings to remember

- MongoDB: container port 27017, published on my PC as **27018**
- Redis: container port 6379, published on my PC as **6380** (so it does not clash with the Rate Limiter project)
- API: 3000
- Inside Docker, containers reach each other by service name (`mongo`, `redis`) and the inner ports
- From my PC, I use `127.0.0.1` and the outer ports

| Variable | Needed | Meaning |
|---|---|---|
| `PORT` | optional | API port |
| `MONGO_URL` | required | Mongo connection string |
| `JWT_SECRET` | required | Signs tokens |
| `REDIS_HOST` and `REDIS_PORT` | optional | Redis address (defaults 127.0.0.1 and 6380) |
| `JUDGE_CONCURRENCY` | optional | How many submissions the worker judges at once (default 2) |

The worker always runs on my PC and reads `.env`. The API in Docker gets its values from the `environment:` block in compose.

## Data models

**User**
- email (unique), password hash, name

**Problem**
- title, slug (unique, used in URLs), description
- time limit, memory limit
- test cases: each has `input`, `expectedOutput` and `isSample`
- Sample test cases are shown to users. Hidden ones are never sent.

**Submission**
- userId, problem, language, code
- verdict: Pending, Running, Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Output Limit Exceeded, Runtime Error, Internal Error
- passedTests, totalTests, failedTestNumber
- createdAt
- Index on `userId` and `createdAt` so "my submissions, newest first" is fast

## Routes

| Method | Route | Login | Notes |
|---|---|---|---|
| POST | `/auth/signup` | no | Hashes the password with bcrypt |
| POST | `/auth/login` | no | Returns a JWT |
| GET | `/problems` | no | List |
| GET | `/problems/:slug` | no | Only sample test cases are returned |
| POST | `/submissions` | yes | Rate limited. Replies 202 |
| GET | `/submissions` | yes | Only my submissions |
| GET | `/submissions/:id` | yes | Only if it is mine |

## Input safety checks on submit

- `MAX_CODE_LENGTH` is 20000 characters. Bigger code is rejected.
- The language must be in the allowed list. I check with `Object.hasOwn(languages, language)`. Plain `languages[language]` would accept words like `constructor` or `__proto__` and is unsafe.
- Values from the request body are forced to strings (`String(...)`) before going into a Mongo query. This stops **NoSQL injection**, where someone sends `{ "$ne": null }` instead of a string.
- Hidden test cases never leave the server. The API answers field by field (it builds the reply object manually), instead of returning the whole database document.
- Other people's submissions are not visible. I filter by `userId`.

## The sandbox: Docker flags and why

| Flag | What it does | Attack it stops |
|---|---|---|
| `--network none` | No network at all | Calling the internet, stealing data |
| `--memory` | RAM limit | Memory bombs |
| `--memory-swap` equal to memory | Turns off swap | Using disk as extra memory |
| `--cpus` | CPU limit | Hogging the processor |
| `--pids-limit` | Max number of processes | Fork bombs |
| `--read-only` | Container filesystem is read only | Writing or changing files |
| `--cap-drop ALL` | Removes Linux special powers | Privilege tricks |
| `--security-opt no-new-privileges` | Process cannot gain more rights | Privilege escalation |
| `--user 1000:1000` | Runs as a normal user, not root | Root powers inside the container |
| Volume mounted with `:ro` | The code folder is read only | The program editing its own code or neighbours |

Important facts:
- **Docker does not stop infinite loops.** So the judge has its **own timer**. When the time is over it runs `docker kill`.
- **Exit code 137** means the process was force-killed (128 + 9). This happens on memory kill or when my timer kills it.
- Output is capped at **64 KB**. If the program prints more, I kill it and give Output Limit Exceeded.
- Each run gets a fresh temp folder (`mkdtemp`) and a uniquely named container, cleaned up in `finally`, so nothing is left behind even if something fails.

## How the runner works for one test case

1. Make a temp folder and write the user's code into it (`main.js` or `main.py`).
2. `docker create` with all the flags. The container exists but is **not started**.
3. `docker start -a -i`. Now the **timer starts**, and the test's input is written to stdin.
4. Collect stdout (with the 64 KB cap), the exit code, and flags `timedOut` and `outputTooLong`.
5. In `finally`: remove the container and delete the temp folder.

Why create and start are split: the timer must measure **only the user's code**, not Docker's setup. In the first version (one `docker run`), a correct program sometimes got `timedOut: true` after 12 seconds because Docker was slow to get ready and the timer was already running. Splitting fixed it. There is also a small `STARTUP_ALLOWANCE_MS` (1000 ms) added to the limit for process start.

Note: with the old version, the problem only showed up when Docker was slow, so it looked random. When Docker was fast, both versions passed.

## How code runs against each test case

- Every test case gets a **brand new container**. After it finishes, the container is deleted.
- This keeps tests from affecting each other: no files left behind, no memory kept, and a crash in one run cannot spread.
- The loop **stops at the first failing test**. This saves time and stops users from learning all hidden tests.

Dry run: tests are `3 4 -> 7`, `10 20 -> 30`, `-5 5 -> 0`.
- Correct code: three containers, three passes, verdict Accepted.
- Buggy code printing 31 for test 2: test 1 passes, test 2 fails, so Wrong Answer with `passedTests = 1` and `failedTestNumber = 2`. Test 3 never runs.

## Verdict decision rules (order matters)

`decideVerdict` checks in this exact order:

1. `timedOut` is true: **Time Limit Exceeded**
2. `outputTooLong` is true: **Output Limit Exceeded**
3. exit code is 137: **Memory Limit Exceeded**
4. exit code is not 0: **Runtime Error**
5. cleaned output equals cleaned expected output: pass
6. otherwise: **Wrong Answer**

Why this order:
- When my timer kills the container, the exit code is also 137. If I checked 137 first, every timeout would wrongly look like a memory error. So the flags (`timedOut`, `outputTooLong`) are checked **before** exit code 137.
- Runtime error is checked before comparing output, because a crashed program may have printed half an answer.

`cleanOutput` trims extra spaces and line endings on both sides, so `7`, `7\n` and `7 ` are equal.

**Internal Error** is for bugs in my own judge (for example, Docker is not running). It is saved from the `catch` block of `judgeSubmission`. It is not the user's fault.

## Queue and worker

Why: without a queue, 50 submissions would start 50 containers at the same time and freeze the machine.

- `judgeQueue.js` makes the queue called `judge` and has `addJudgeJob(submissionId)`.
  - Job data holds only the id, not the code. The worker reads the code from Mongo, so Redis stays small.
  - `jobId` is the submission id, so the same submission cannot be queued twice.
  - `removeOnComplete: true` keeps Redis clean. `removeOnFail: 100` keeps the last 100 failed jobs for debugging.
- `worker.js` is a **separate program**. It connects to Mongo, creates a `Worker("judge", handler, { concurrency })` and calls `judgeSubmission` for each job.
- `concurrency` (from `JUDGE_CONCURRENCY`, default 2) is how many submissions run at the same time. Extra ones wait.
- The API and the worker must use the **same queue name** and the same Redis.

Benefits:
- The API answers in milliseconds (202).
- If the worker is off, submissions stay `Pending` and are judged later. Nothing is lost.
- If the worker crashes mid-job, BullMQ notices the job is **stalled** and gives it to a worker again.
- The API and worker can be scaled separately.

Why the worker runs on my PC and not in Docker: it must start Docker containers. Inside a container it would need the Docker socket mounted, which gives it control of the host. That is a big security risk. Also, mounted temp folders must exist on the host. So only Mongo, Redis and the API are in compose.

Why polling (GET) and not waiting: the judge can take seconds. HTTP requests should not hang that long. 202 plus polling is the standard pattern. Later it could be replaced by WebSockets or Server-Sent Events.

## Rate limit on submit 

- Limit: 5 submissions per minute per user.
- Redis key: `submit-limit:<userId>`.
- Steps: `INCR` the key. If the result is 1, set `EXPIRE` to 60 seconds. If the result is more than 5, reply `429` with a `Retry-After` header. Otherwise call `next()`.
- **Increment first, then compare.** The earlier Rate Limiter bug (off by one) came from reading first and incrementing later. `INCR` is atomic, so two requests at the same moment cannot both see the same number.
- **Fail open**: if Redis is down, the limiter logs the error and lets the request through, so a broken limiter does not block everyone. (The queue itself still needs Redis.)
- Middleware order on the route: `requireLogin`, then `submitLimit`, then the handler. The user must be known before counting.
- Field name lesson: the limiter reads the user id from the request. It must match the exact field that `requireLogin` sets in my code.
- Only POST is limited. GET routes are not.

## Adding a language

`languages.js` has one entry per language: Docker image, file name, run command.
- JavaScript: image `node:20-alpine`, file `main.js`, command `["node", "/code/main.js"]`
- Python: image `python:3.12-alpine`, file `main.py`, command `["python3", "/code/main.py"]`

The runner and judge do not change, because they only do "write file, run command, collect output". The submit route allows any language present in this object.

C++ and Java need a **compile step** first. That needs a writable folder, a separate compile time limit, and compile errors as a new verdict. That is future work.

## Testing (Day 7)

`tests/judge.test.js` uses `node:test`. It needs the API, worker, Mongo and Redis running.
- No token on submit gives 401.
- Correct code gives Accepted.
- Wrong code gives Wrong Answer.
- The 6th submit within a minute gives 429.

Helpers:
- `makeLoggedInUser` signs up a new unique user per test, so one test's rate limit never affects another.
- `waitForVerdict` polls once per second up to 30 times, because judging is in the background.

I also tested by hand with 6 submissions: A Accepted, B Wrong Answer, C Time Limit Exceeded (infinite loop), D Runtime Error, E Memory Limit Exceeded, F Output Limit Exceeded. After this, `docker ps -a` must be empty, which proves cleanup works.

Run: `npm test`.

## Bugs I hit and how I fixed them

| Problem | Cause | Fix |
|---|---|---|
| Correct sum showed `timedOut: true` after 12 s | Timer started before Docker was ready | Split into `docker create` and `docker start`, and start the timer at start |
| Internet sample hung | DNS lookup with no network takes a few seconds | Give that sample a longer limit (5000 ms) |
| Sum printed `NaN` | `input.txt` was empty or not saved | Save the file with the real input (`3 4`) |
| Container exited immediately in a test | The loop file was empty or unsaved | Save the file |
| `import { User }` error | Empty or unsaved `User.js`, or a missing `export` | Check the file content and the export |
| My wrong claims about the runner | I assumed the old runner always failed | The problem is intermittent and depends on Docker speed. Both pass when Docker is fast |
| Verdict mix-up between timeout and memory | Both have exit code 137 | Check the flags first |
| Rate limiter user field | The code used a field name that did not match my `requireLogin` | Use the field my middleware really sets |

## Decision rules and design choices

- **Fresh container per test**: isolation, clean timing, safe cleanup.
- **Own timer plus `docker kill`**: Docker cannot stop infinite loops.
- **Timer starts when code starts**: Docker setup is not the user's fault.
- **Flags before exit code**: 137 is ambiguous.
- **Stop at the first failure**: faster and protects hidden tests.
- **Hidden tests never sent**: the API builds its reply field by field.
- **202 plus polling**: do not keep HTTP open while judging.
- **Only the id in the job**: small Redis, one source of truth (Mongo).
- **jobId equals submission id**: no double judging.
- **Concurrency limit**: protects the host from overload.
- **Rate limit fails open**: availability over strictness for a limiter.
- **Increment then compare**: removes the race condition.
- **Worker outside Docker**: avoids giving containers control of the host.
- **Two Redis and two Mongo ports on the host**: avoid clashing with other projects.
- **Language allowlist with `Object.hasOwn`**: no prototype tricks.
- **Strings only in queries**: no NoSQL injection.
- **bcrypt and JWT**: no plain passwords, no server sessions.
- **Upsert in seed**: running seed twice is safe.
- **Index on `userId` and `createdAt`**: fast "my submissions".
- **Max code length**: stops huge payloads.

## Security summary

- Sandbox flags (network, memory, CPU, pids, read-only, capabilities, non-root)
- Own timer and output cap
- No hidden test leaks
- Input validation (language, length, strings only)
- Rate limit per user
- Worker not given the Docker socket

Known weakness: containers share the host kernel, so a kernel bug could allow an escape. Real judges add gVisor, Firecracker or a VM.

## Limitations and future work

- Add C++ and Java (compile step and a Compile Error verdict)
- Run the worker as a container with a safer setup (rootless Docker or gVisor)
- Per-language time and memory limits
- WebSockets or SSE instead of polling
- Leaderboard, contests, and a UI
- Reuse warm containers or pre-pulled images to reduce start time
- Metrics and logging (queue length, average judge time)

## How to scale it

- Run more workers (they all read the same Redis queue).
- Put workers on several machines.
- Use a managed Redis and MongoDB.
- Keep the API stateless so it can run behind a load balancer.

## Commands to remember

```
docker compose up -d --build     start Mongo, Redis, API
node src/seed.js                 add sample problems
npm run worker                   start the judge worker (on my PC)
npm test                         run integration tests
docker ps -a                     check no leftover containers
docker pull node:20-alpine       download images in advance
docker pull python:3.12-alpine
```

Commit message style used: `feat(judge): ...`, `test(judge): ...`, `chore(docker): ...`, `docs: ...`.

## 30-second pitch

"I built the backend of an online judge. Users submit code, and it runs inside a locked-down Docker container with no network, limited memory, CPU and processes, and a read-only filesystem. Each test case runs in a fresh container with my own timer, because Docker can't stop infinite loops. Submissions go into a BullMQ queue on Redis, and a worker judges a limited number at a time, so a rush of submissions can't overload the server. There is a Redis rate limit per user, hidden test cases that are never exposed, and integration tests."

## Interview questions and answers

**Why a Docker container and not just `child_process`?**
A child process runs with my server's rights. Malicious code could read my files or the network. A container isolates the filesystem, network, memory and processes.

**Is Docker fully safe?**
No. Containers share the host kernel. For real production I would add gVisor or Firecracker, or run on a separate machine.

**How do you stop an infinite loop?**
Docker has no time limit flag. My runner starts a timer when the code starts, and when the time is over it calls `docker kill` and returns Time Limit Exceeded.

**How do you stop memory bombs?**
`--memory` with `--memory-swap` equal to it, so the process cannot use swap. The kernel kills it, and the exit code is 137.

**What is exit code 137?**
128 plus signal 9 (SIGKILL). It means force-killed. It can come from the memory limit or from my own timer, so I check my flags first.

**What is a fork bomb and how do you stop it?**
A program that starts processes endlessly. `--pids-limit` caps the number of processes.

**Why do you split `docker create` and `docker start`?**
So the timer excludes Docker's setup time. A correct solution was getting Time Limit Exceeded when Docker was slow.

**Why a queue?**
To avoid starting too many containers at once, and to reply to users immediately. It also gives retries and recovery.

**Why BullMQ?**
It is built on Redis and gives concurrency control, retries, delayed jobs, and stalled-job recovery out of the box.

**What happens if the worker crashes in the middle?**
BullMQ marks the job as stalled after a timeout and gives it to a worker again.

**What if the same submission is added twice?**
`jobId` equals the submission id, so Redis ignores the duplicate.

**Why 202 and not 200?**
202 means "accepted, work is not finished yet". The result comes later through GET.

**How can the client get the result without polling?**
WebSockets or Server-Sent Events. I used polling because it is simpler and good enough.

**How do you hide test cases?**
Only `isSample` tests go to the user, and the response is built field by field, never the full document.

**What is NoSQL injection and how did you prevent it?**
A user sends an object like `{ "$ne": null }` where a string is expected, and it changes the query. I force values to strings.

**Why `Object.hasOwn` for the language check?**
`languages[language]` also matches inherited keys like `constructor`. `hasOwn` checks only my own keys.

**How does your rate limit work and why is it correct under concurrency?**
`INCR` in Redis is atomic. The first call sets a 60 second expiry. Over 5 gives 429. Increment first and then compare, so two parallel requests never get the same number.

**Fixed window weakness?**
A user can send 5 at the end of one minute and 5 more at the start of the next, so 10 in a short time. A sliding window or token bucket fixes that (I built those in my Rate Limiter project).

**Why fail open?**
If Redis is down, blocking everyone is worse than letting a few extra requests through.

**Why not run the worker in Docker too?**
It would need the Docker socket mounted, which gives it root-like control of the host. It also needs shared temp folders with the host.

**How do you compare outputs?**
Trim whitespace and line endings on both sides, then compare as strings. Real judges also have checkers for problems with many valid answers (for example floating point or any valid order).

**How would you add C++?**
A compile step in the sandbox with its own time limit, a writable output folder, a Compile Error verdict, then run the binary the same way.

**How would you scale it?**
Run more workers on more machines against the same queue, use managed Redis and Mongo, keep the API stateless behind a load balancer.

**What would you improve with more time?**
Stronger isolation (gVisor), per-language limits, more languages, WebSockets, metrics, and a UI.

**What was the hardest bug?**
Correct solutions showing Time Limit Exceeded at random. The timer started before Docker was ready. I proved it by timing the steps, then split create and start.

**Why MongoDB and not MySQL here?**
Test cases are nested lists inside a problem and fit a document well. 

**What did you learn?**
Sandboxing is about limits on every resource, timers must be measured at the right moment, queues protect systems from bursts, and order of checks matters (like the verdict order).