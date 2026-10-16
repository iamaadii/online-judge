# Docker Sandbox - Day 1

## Docker Limits

We use these limits to safely run user-submitted code inside a Docker container.

```powershell
$limits = @(
  "--rm",
  "--network", "none",
  "--memory", "128m",
  "--memory-swap", "128m",
  "--cpus", "0.5",
  "--pids-limit", "64",
  "--read-only",
  "--cap-drop", "ALL",
  "--security-opt", "no-new-privileges",
  "--user", "1000:1000"
)
```


| Option                             | Simple meaning                                    |
| ---------------------------------- | ------------------------------------------------- |
| `--rm`                             | Delete the container automatically after it stops |
| `--network none`                   | Container cannot access the internet              |
| `--memory 128m`                    | Maximum RAM = 128 MB                              |
| `--memory-swap 128m`               | Prevents extra swap memory                        |
| `--cpus 0.5`                       | Container can use at most half of one CPU         |
| `--pids-limit 64`                  | Maximum 64 processes/threads                      |
| `--read-only`                      | Container filesystem cannot be modified           |
| `--cap-drop ALL`                   | Removes extra Linux permissions                   |
| `--security-opt no-new-privileges` | Prevents gaining more privileges                  |
| `--user 1000:1000`                 | Runs code as a normal non-root user               |

<br>
<br>

# Case 1 - Run Simple JavaScript

### File: `hello.js`

```javascript
console.log("Hello from the sandbox");
```

### Command

```powershell
docker run @limits -v "${PWD}:/code:ro" node:20-alpine node /code/hello.js
```

### Explanation

* `docker run` → creates and runs a container.
* `@limits` → applies all our safety limits.
* `-v` → connects a folder from our computer to the container.
* `${PWD}` → current folder on our computer.
* `/code` → folder inside the container.
* `:ro` → read-only.
* `node:20-alpine` → Node.js 20 lightweight Docker image.
* `node /code/hello.js` → runs our JavaScript file.

### Expected output

```text
Hello from the sandbox
```

### Purpose

Checks whether basic JavaScript code can run inside our sandbox.

<br>
<br>

# Case 2 - Give Input to the Program

### Files

`sum.js`

```javascript
const fs = require("fs");

const numbers = fs.readFileSync(0, "utf8")
    .trim()
    .split(/\s+/)
    .map(Number);

console.log(numbers[0] + numbers[1]);
```

`input.txt`

```text
3 4
```

### Command

```powershell
Get-Content input.txt | docker run -i @limits -v "${PWD}:/code:ro" node:20-alpine node /code/sum.js
```

### Explanation

* `Get-Content input.txt` → reads the input file.
* `|` → sends the input to Docker.
* `-i` → keeps standard input available.
* `fs.readFileSync(0, "utf8")` → reads input from standard input.
* `3 4` → program receives two numbers.
* `3 + 4` → gives `7`.

### Expected output

```text
7
```

### Important

Make sure `input.txt` contains:

```text
3 4
```

and **not the PowerShell command used to create the file**.

### Purpose

This simulates how an online judge gives **test-case input** to submitted code.

<br>
<br>

# Case 3 - Block Internet Access

### File: `internet.js`

```javascript
fetch("https://example.com")
  .then(() => console.log("Internet works"))
  .catch(() => console.log("No internet here"));
```

### Command

```powershell
docker run @limits -v "${PWD}:/code:ro" node:20-alpine node /code/internet.js
```

### Important limit

```text
--network none
```

This disconnects the container from the network.

### Expected output

```text
No internet here
```

### Purpose

Submitted code should not be able to access external websites or services.

<br>
<br>

# Case 4 - Prevent File Writing

### File: `write.js`

```javascript
const fs = require("fs");

fs.writeFileSync("/code/hacked.txt", "hello");

console.log("File written");
```

### Command

```powershell
docker run @limits -v "${PWD}:/code:ro" node:20-alpine node /code/write.js
```

### Important limit

```text
--read-only
```

The `/code` folder is also mounted using:

```text
:ro
```

which means **read-only**.

### Expected result

The program should fail with a read-only filesystem error.

### Purpose

Prevents submitted code from modifying files in the mounted project folder.

<br>
<br>

# Case 5 - Memory Limit

### File: `memory.js`

```javascript
const data = [];

while (true) {
  data.push(Buffer.alloc(10 * 1024 * 1024));
}
```

The program continuously creates approximately **10 MB** of memory at a time.

### Command

```powershell
docker run @limits -v "${PWD}:/code:ro" node:20-alpine node /code/memory.js
```

### Important limit

```text
--memory 128m
--memory-swap 128m
```

The container can use only about **128 MB** of memory.

### Expected result

The container should eventually be killed because it reaches the memory limit.

A commonly seen exit code is:

```text
137
```

### Purpose

Prevents a submitted program from consuming all available RAM on the server.

<br>
<br>

# Case 6 - Infinite Loop / Time Limit

### File: `loop.js`

```javascript
while (true) {}
```

The program never stops by itself.

### Start the container in background

```powershell
docker run -d --name loopy @limits -v "${PWD}:/code:ro" node:20-alpine node /code/loop.js
```

### Explanation

* `-d` → runs the container in the background.
* `--name loopy` → gives the container the name `loopy`.
* `@limits` → applies our safety limits.
* `loop.js` → contains an infinite loop.

### Check running containers

```powershell
docker ps
```

You should see `loopy`.

### Stop it

```powershell
docker kill loopy
```

### Purpose

Shows why an online judge needs a **time limit**.

A user could submit:

```javascript
while (true) {}
```

and the program would keep using CPU forever.

Docker resource limits help, but our actual online judge should also have a mechanism to stop a program after its allowed execution time.

<br>
<br>

# What We Tested

```text
User Code
   |
   v
Docker Sandbox
   |
   +-- Basic code       -> Allowed
   |
   +-- Input            -> Allowed
   |
   +-- Internet         -> Blocked
   |
   +-- File writing     -> Blocked
   |
   +-- Too much memory  -> Limited
   |
   +-- Infinite loop    -> Must be stopped
```

<br>

## Main Idea

Never run submitted code directly on the main server.

Instead:

```text
Submitted Code
      ↓
Docker Container
      ↓
Apply Limits
      ↓
Run Code
      ↓
Check Result
      ↓
Return Verdict
```

The Docker container acts like a **small isolated room** where the submitted code can run with limited permissions and resources.
