#!/usr/bin/env node
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function findRepoRoot(start) {
  let dir = start;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

const repoRoot = findRepoRoot(process.cwd());
if (!repoRoot) process.exit(0);

const hooksDir = path.join(repoRoot, ".githooks");
if (!fs.existsSync(hooksDir)) process.exit(0);

try {
  const current = execFileSync("git", ["-C", repoRoot, "config", "--get", "core.hooksPath"], {
    encoding: "utf8",
  }).trim();
  if (current === ".githooks") process.exit(0);
} catch {
  // hooksPath not set yet — fall through and set it
}

try {
  execFileSync("git", ["-C", repoRoot, "config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
  console.log("[salon-pos] git hooks installed (.githooks/)");
} catch (e) {
  // git missing or repo broken — silent
}
