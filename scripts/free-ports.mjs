#!/usr/bin/env node
import { execSync } from 'node:child_process';

const arg = process.argv[2] ?? '3016-3020';
const [start, end] = arg.includes('-')
  ? arg.split('-').map((n) => parseInt(n, 10))
  : [parseInt(arg, 10), parseInt(arg, 10)];

if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) {
  console.error(`free-ports: invalid range "${arg}" (expected e.g. 3016-3020)`);
  process.exit(1);
}

const ports = Array.from({ length: end - start + 1 }, (_, i) => start + i);
const killed = [];

for (const port of ports) {
  let pids = '';
  try {
    pids = execSync(`lsof -ti tcp:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    continue;
  }
  if (!pids) continue;
  for (const pid of pids.split('\n').filter(Boolean)) {
    try {
      process.kill(parseInt(pid, 10), 'SIGKILL');
      killed.push({ port, pid });
    } catch {}
  }
}

if (killed.length === 0) {
  console.log(`free-ports: ports ${start}-${end} already free`);
} else {
  for (const { port, pid } of killed) {
    console.log(`free-ports: killed pid ${pid} on port ${port}`);
  }
}
