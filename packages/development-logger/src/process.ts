import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { LoggerConfig, RunOptions, RunResult } from './types.ts';

type ExecError = Error & { stdout?: string; stderr?: string; status?: number; code?: string };

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function asExecError(error: unknown): ExecError {
  return (error ?? {}) as ExecError;
}

export function run(command: string, args: string[], options: RunOptions = {}): string {
  return execFileSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    input: options.input,
    maxBuffer: 20 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}

export function tryRun(command: string, args: string[], options: RunOptions = {}): RunResult {
  try {
    return { ok: true, output: run(command, args, options) };
  } catch (caught) {
    const error = asExecError(caught);
    return {
      ok: false,
      output: String(error.stdout ?? '').trimEnd(),
      error: String(error.stderr ?? error.message ?? '').trimEnd(),
      status: Number.isInteger(error.status) ? Number(error.status) : 1,
    };
  }
}

export function findRepositoryRoot(cwd: string = process.cwd()): string {
  const result = tryRun('git', ['rev-parse', '--show-toplevel'], { cwd });
  if (!result.ok) {
    throw new Error('Git 저장소 안에서 Development Logger를 실행해야 합니다.');
  }
  return resolve(result.output);
}

export function gitDirectory(root: string): string {
  const value = run('git', ['rev-parse', '--git-dir'], { cwd: root });
  return isAbsolute(value) ? value : resolve(root, value);
}

export function readJson<T>(path: string, fallback: T | null = null): T | null {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJsonAtomic(path: string, value: unknown): void {
  writeAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeTextAtomic(path: string, value: string): void {
  writeAtomic(path, value);
}

function writeAtomic(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, contents, 'utf8');
  renameSync(temporary, path);
}

export function removeFile(path: string): void {
  rmSync(path, { force: true });
  rmSync(`${path}.lock`, { force: true });
}

export function loadConfig(root: string): LoggerConfig {
  const path = join(root, '.devlogger.json');
  const config = readJson<LoggerConfig>(path);
  if (!config || config.version !== 1) {
    throw new Error(`지원하는 Development Logger 설정을 찾지 못했습니다: ${path}`);
  }
  return config;
}

export async function readStdin(): Promise<Record<string, unknown>> {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  // Windows 셸이 파이프 앞에 BOM을 붙이는 경우가 있어 벗겨 낸다.
  const text = input.replace(/^﻿/, '').trim();
  return text ? JSON.parse(text) : {};
}
