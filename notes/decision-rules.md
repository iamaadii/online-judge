# Online Judge - Safety Rules

1. **Never run submitted code directly.** Always run it inside a limited Docker container.

2. **Use only trusted/test code while learning.** Don't expose the judge publicly. Docker is strong isolation, but not perfect.

3. **Don't give a public app Docker control.** During development, API runs on your computer and starts Docker containers.

4. **Apply limits to every sandbox:** no network, limited CPU/RAM, limited processes, read-only files, no extra permissions, and time limit.

5. **Be honest:** This is a learning-level online judge, not production-grade security.
