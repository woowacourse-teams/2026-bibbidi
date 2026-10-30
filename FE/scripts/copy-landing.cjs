const { cpSync } = require("node:fs");
const path = require("node:path");

cpSync(
  path.resolve(__dirname, "../public/landing-story"),
  path.resolve(__dirname, "../dist/landing-story"),
  { recursive: true },
);
