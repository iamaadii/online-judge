export const languages = {
  javascript: {
    image: "node:20-alpine",
    fileName: "main.js",
    command: ["node", "/code/main.js"],
  },
  python: {
    image: "python:3.12-alpine",
    fileName: "main.py",
    command: ["python3", "/code/main.py"],
  },
};