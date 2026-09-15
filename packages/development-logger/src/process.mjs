import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 20 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

export function tryRun(command, args, options = {}) {
  try {
    return { ok: true, output: run(command, args, options) };
  } catch (error) {
    return {
      ok: false,
      output: String(error.stdout ?? '').trimEnd(),
      error: String(error.stderr ?? error.message ?? '').trimEnd(),
      status: Number.isInteger(error.status) ? error.status : 1,
    };
  }
}

export function findRepositoryRoot(cwd = process.cwd()) {
  const result = tryRun('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (!result.ok) {
    throw new Error('Git 저장소 안에서 Development Logger를 실행해야 합니다.');
  }
  return resolve(result.output);
}

export function gitDirectory(root) {
  const value = run('git', ['rev-parse', '--git-dir'], { cwd: root });
  return isAbsolute(value) ? value : resolve(root, value);
}

export function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, path);
}

export function writeTextAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, value, 'utf8');
  renameSync(temporary, path);
}

export function removeFile(path) {
  rmSync(path, { force: true });
  rmSync(`${path}.lock`, { force: true });
}

export function loadConfig(root) {
  const path = join(root, '.devlogger.json');
  const config = readJson(path);
  if (!config || config.version !== 1) {
    throw new Error(`지원하는 Development Logger 설정을 찾지 못했습니다: ${path}`);
  }
  return config;
}

export async function readStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  return input.trim() ? JSON.parse(input) : {};
}

