import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!['run', 'open'].includes(mode)) {
  console.error('Uso: node scripts/run-e2e.mjs <run|open>');
  process.exit(2);
}

const frontendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectDirectory = resolve(frontendDirectory, '..');
const backendDirectory = join(projectDirectory, 'backend');
const host = '127.0.0.1';
const backendPort = 3310;
const frontendPort = 5174;
const children = [];
let temporaryDirectory;
let cleanupPromise;

function reservePort(port, service) {
  return new Promise((resolvePromise, rejectPromise) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once('error', (error) => {
      const reason =
        error.code === 'EADDRINUSE'
          ? `El puerto E2E ${port} para ${service} ya está ocupado. No se conectará a un servidor ajeno.`
          : `No se pudo reservar el puerto E2E ${port} para ${service}: ${error.message}`;
      rejectPromise(new Error(reason));
    });
    reservation.listen({ host, port, exclusive: true }, () => {
      resolvePromise(reservation);
    });
  });
}

function closeReservation(reservation) {
  return new Promise((resolvePromise, rejectPromise) => {
    reservation.close((error) =>
      error ? rejectPromise(error) : resolvePromise(),
    );
  });
}

async function assertPortsAvailable() {
  const reservations = [];
  try {
    reservations.push(await reservePort(backendPort, 'el backend'));
    reservations.push(await reservePort(frontendPort, 'el frontend'));
  } finally {
    await Promise.all(reservations.map(closeReservation));
  }
}

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function startProcess(name, cwd, args, env, readyPattern) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push({ child, name });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  const ready = new Promise((resolvePromise, rejectPromise) => {
    let output = '';
    const timeout = setTimeout(() => {
      finish(new Error(`${name} no informó estar listo en 20 segundos.`));
    }, 20_000);

    function onData(chunk) {
      output = `${output}${stripAnsi(chunk.toString())}`.slice(-20_000);
      if (readyPattern.test(output)) {
        finish();
      }
    }

    function onExit(code, signal) {
      finish(
        new Error(
          `${name} terminó antes de estar listo (código ${code ?? 'sin código'}, señal ${signal ?? 'ninguna'}).`,
        ),
      );
    }

    function onError(error) {
      finish(new Error(`No se pudo iniciar ${name}: ${error.message}`));
    }

    function finish(error) {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) {
        rejectPromise(error);
      } else {
        resolvePromise();
      }
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', onExit);
    child.once('error', onError);
  });

  return { child, ready };
}

async function waitForHttp(url, child, service) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`${service} terminó antes de responder en ${url}.`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // El proceso ya confirmó que posee el puerto; se espera a que termine de iniciar.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error(`${service} no respondió en ${url} dentro de 10 segundos.`);
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve(true);
  }

  return Promise.race([
    once(child, 'exit').then(() => true),
    new Promise((resolvePromise) =>
      setTimeout(() => resolvePromise(false), timeoutMs),
    ),
  ]);
}

function signalProcessTree(child, signal, force = false) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      if (force) {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
        });
      } else {
        child.kill(signal);
      }
    } else {
      process.kill(-child.pid, signal);
    }
  } catch {
    // El proceso pudo finalizar entre la comprobación y la señal.
  }
}

async function stopProcess({ child, name }) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  signalProcessTree(child, 'SIGTERM');
  if (await waitForExit(child, 5_000)) {
    return;
  }

  console.error(`${name} no terminó a tiempo; se forzará su cierre.`);
  signalProcessTree(child, 'SIGKILL', true);
  await waitForExit(child, 2_000);
}

async function cleanup() {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
    for (const entry of [...children].reverse()) {
      await stopProcess(entry);
    }

    if (temporaryDirectory) {
      rmSync(temporaryDirectory, { recursive: true, force: true });
      console.log('Base y directorio temporal E2E eliminados.');
    }
  })();

  return cleanupPromise;
}

for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(exitCode));
  });
}

async function runCypress() {
  const cypressEnvironment = { ...process.env };
  delete cypressEnvironment.ELECTRON_RUN_AS_NODE;

  const cypressBin = join(
    frontendDirectory,
    'node_modules',
    'cypress',
    'bin',
    'cypress',
  );
  const child = spawn(
    process.execPath,
    [
      cypressBin,
      mode,
      '--config',
      `baseUrl=http://${host}:${frontendPort}`,
    ],
    {
      cwd: frontendDirectory,
      env: cypressEnvironment,
      detached: process.platform !== 'win32',
      stdio: 'inherit',
    },
  );
  children.push({ child, name: 'Cypress' });

  const [code, signal] = await once(child, 'exit');
  if (code !== 0) {
    throw new Error(
      `Cypress terminó con código ${code ?? 'sin código'} y señal ${signal ?? 'ninguna'}.`,
    );
  }
}

try {
  await assertPortsAvailable();
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'gestor-tareas-e2e-'));

  const backend = startProcess(
    'backend E2E',
    backendDirectory,
    [join(backendDirectory, 'src', 'server.js')],
    {
      PORT: String(backendPort),
      DATABASE_PATH: join(temporaryDirectory, 'tareas-e2e.db'),
    },
    new RegExp(`API disponible en http://localhost:${backendPort}`),
  );
  await backend.ready;
  await waitForHttp(
    `http://${host}:${backendPort}/api/health`,
    backend.child,
    'El backend E2E',
  );

  const viteBin = join(frontendDirectory, 'node_modules', 'vite', 'bin', 'vite.js');
  const frontend = startProcess(
    'frontend E2E',
    frontendDirectory,
    [
      viteBin,
      '--host',
      host,
      '--port',
      String(frontendPort),
      '--strictPort',
      '--clearScreen',
      'false',
    ],
    { VITE_API_TARGET: `http://${host}:${backendPort}` },
    /Local:\s+http:\/\//,
  );
  await frontend.ready;
  await waitForHttp(
    `http://${host}:${frontendPort}`,
    frontend.child,
    'El frontend E2E',
  );

  await runCypress();
} catch (error) {
  console.error(`E2E: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
