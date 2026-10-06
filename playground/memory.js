const chunks = [];
while (true) {
  chunks.push(Buffer.alloc(10 * 1024 * 1024, 1));
}