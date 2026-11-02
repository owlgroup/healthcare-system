#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const PKG_ROOT = path.resolve(__dirname, '..');

function readPkg() {
  const p = path.join(PKG_ROOT, 'package.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function printHelp() {
  console.log(`class-ai-agent — Install Claude Code & Cursor AI agent scaffolding

Usage:
  npx class-ai-agent [init] [options]

Options:
  -d, --dir <path>   Target directory (default: current working directory)
      --claude       Install only .claude/
      --cursor       Install only .cursor/ and AGENTS.md
  -f, --force        Overwrite existing files or directories
  -h, --help         Show help
  -v, --version      Print version

Examples:
  npx class-ai-agent
  npx class-ai-agent --dir ./my-app
  npx class-ai-agent --cursor --force
`);
}

function parseArgs(argv) {
  const opts = {
    command: 'init',
    dir: process.cwd(),
    claudeOnly: false,
    cursorOnly: false,
    force: false,
    help: false,
    version: false,
  };

  let i = 0;
  if (argv[0] === 'init') {
    i = 1;
  }

  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      opts.help = true;
      continue;
    }
    if (a === '-v' || a === '--version') {
      opts.version = true;
      continue;
    }
    if (a === '-f' || a === '--force') {
      opts.force = true;
      continue;
    }
    if (a === '--claude') {
      opts.claudeOnly = true;
      continue;
    }
    if (a === '--cursor') {
      opts.cursorOnly = true;
      continue;
    }
    if (a === '-d' || a === '--dir') {
      const v = argv[++i];
      if (!v) {
        console.error('Error: missing value for --dir');
        process.exit(1);
      }
      opts.dir = path.resolve(v);
      continue;
    }
    console.error(`Unknown argument: ${a}`);
    process.exit(1);
  }

  return opts;
}

function ensureParentDir(filePath) {
  const d = path.dirname(filePath);
  fs.mkdirSync(d, { recursive: true });
}

function copyDir(src, dest, { force }) {
  if (!fs.existsSync(src)) {
    console.error(`Error: template missing from package: ${src}`);
    process.exit(1);
  }
  if (fs.existsSync(dest)) {
    if (!force) {
      console.error(`Error: already exists (use --force to overwrite): ${dest}`);
      process.exit(1);
    }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function copyFile(src, dest, { force }) {
  if (!fs.existsSync(src)) {
    console.error(`Error: template missing from package: ${src}`);
    process.exit(1);
  }
  if (fs.existsSync(dest) && !force) {
    console.error(`Error: already exists (use --force to overwrite): ${dest}`);
    process.exit(1);
  }
  ensureParentDir(dest);
  fs.copyFileSync(src, dest);
}

function run(opts) {
  const full =
    (!opts.claudeOnly && !opts.cursorOnly) ||
    (opts.claudeOnly && opts.cursorOnly);

  const installClaude = full || (opts.claudeOnly && !opts.cursorOnly);
  const installCursor = full || (opts.cursorOnly && !opts.claudeOnly);
  const installAgents = full || opts.cursorOnly;

  fs.mkdirSync(opts.dir, { recursive: true });

  const copyOpts = { force: opts.force };

  if (installClaude) {
    const src = path.join(PKG_ROOT, '.claude');
    const dest = path.join(opts.dir, '.claude');
    copyDir(src, dest, copyOpts);
    console.log(`Installed: ${dest}`);
  }

  if (installCursor) {
    const src = path.join(PKG_ROOT, '.cursor');
    const dest = path.join(opts.dir, '.cursor');
    copyDir(src, dest, copyOpts);
    console.log(`Installed: ${dest}`);
  }

  if (installAgents) {
    const src = path.join(PKG_ROOT, 'AGENTS.md');
    const dest = path.join(opts.dir, 'AGENTS.md');
    copyFile(src, dest, copyOpts);
    console.log(`Installed: ${dest}`);
  }

  const hints = [];
  if (installClaude) hints.push('.claude/CLAUDE.md');
  if (installCursor) hints.push('.cursor/CURSOR.md');
  console.log(`\nDone. Next steps: read ${hints.join(' and ')}.`);
}

const argv = process.argv.slice(2);
const opts = parseArgs(argv);

if (opts.help) {
  printHelp();
  process.exit(0);
}

if (opts.version) {
  console.log(readPkg().version);
  process.exit(0);
}

run(opts);
