import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = 3320;
const children = [];
let temporaryDirectory;
let cleanupPromise;

function verifyK6() {
  const result = spawnSync('k6', ['version'], {
    encoding: 'utf8',
    shell: false,
  });

  if (result.error?.code === 'ENOENT') {
    throw new Error(
      'k6 no está disponible en PATH. Instálalo y verifica con "k6 version".',
    );
  }
  if (result.error) {
    throw new Error(`No se pudo ejecutar k6: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `"k6 version" terminó con código ${result.status}: ${result.stderr.trim()}`,
    );
  }

  console.log(result.stdout.trim());
}

function reservePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const reservation = createServer();
    reservation.unref();
    reservation.once('error', (error) => {
      const reason =
        error.code === 'EADDRINUSE'
          ? `El puerto exclusivo de carga ${port} ya está ocupado. No se usará un servidor ajeno.`
          : `No se pudo reservar el puerto de carga ${port}: ${error.message}`;
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

function stripAnsi(value) {
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function startBackend() {
  const child = spawn(process.execPath, [join(backendDirectory, 'src', 'server.js')], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_PATH: join(temporaryDirectory, 'tareas-carga.db'),
    },
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push({ child, name: 'backend de carga' });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[backend carga] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[backend carga] ${chunk}`);
  });

  const ready = new Promise((resolvePromise, rejectPromise) => {
    let output = '';
    const timeout = setTimeout(() => {
      finish(new Error('El backend de carga no estuvo listo en 20 segundos.'));
    }, 20_000);

    function onData(chunk) {
      output = `${output}${stripAnsi(chunk.toString())}`.slice(-20_000);
      if (output.includes(`API disponible en http://localhost:${port}`)) {
        finish();
      }
    }

    function onExit(code, signal) {
      const occupied = output.includes('EADDRINUSE');
      finish(
        new Error(
          occupied
            ? `El puerto exclusivo de carga ${port} fue ocupado antes de iniciar el backend.`
            : `El backend de carga terminó antes de estar listo (código ${code ?? 'sin código'}, señal ${signal ?? 'ninguna'}).`,
        ),
      );
    }

    function onError(error) {
      finish(new Error(`No se pudo iniciar el backend de carga: ${error.message}`));
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

async function waitForBackend(child) {
  const url = `http://${host}:${port}/api/health`;
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error('El backend de carga terminó antes de responder health.');
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // El proceso confirmó el puerto; se espera a que health esté disponible.
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }

  throw new Error(`El backend de carga no respondió en ${url}.`);
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
    // El proceso pudo terminar entre la comprobación y la señal.
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
      console.log('Base y directorio temporal de carga eliminados.');
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

function runK6() {
  return new Promise((resolvePromise, rejectPromise) => {
    const script = join(backendDirectory, 'tests', 'carga', 'tareas.js');
    const child = spawn(
      'k6',
      [
        'run',
        '--env',
        `BASE_URL=http://${host}:${port}`,
        script,
      ],
      {
        cwd: backendDirectory,
        detached: process.platform !== 'win32',
        shell: false,
        stdio: 'inherit',
      },
    );
    children.push({ child, name: 'k6' });

    child.once('error', (error) => {
      rejectPromise(new Error(`No se pudo iniciar k6: ${error.message}`));
    });
    child.once('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`k6 terminó por la señal ${signal}.`));
      } else {
        resolvePromise(code ?? 1);
      }
    });
  });
}

try {
  verifyK6();
  const reservation = await reservePort();
  await closeReservation(reservation);

  temporaryDirectory = mkdtempSync(join(tmpdir(), 'gestor-tareas-carga-'));
  const backend = startBackend();
  await backend.ready;
  await waitForBackend(backend.child);

  const k6ExitCode = await runK6();
  if (k6ExitCode !== 0) {
    console.error(`k6 terminó con código ${k6ExitCode}.`);
  }
  process.exitCode = k6ExitCode;
} catch (error) {
  console.error(`Carga: ${error.message}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
