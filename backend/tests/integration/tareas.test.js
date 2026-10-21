import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { createDatabase } from '../../src/database.js';

const TAREA_VALIDA = {
  titulo: 'Preparar entrega',
  descripcion: 'Revisar los requisitos',
  prioridad: 'alta',
  fechaEntrega: '2026-11-15',
};

describe('API de tareas con SQLite en memoria', () => {
  let database;
  let api;

  beforeEach(() => {
    database = createDatabase({ filename: ':memory:' });
    api = request(createApp({ database }));
  });

  afterEach(() => {
    if (database?.open) {
      database.close();
    }
  });

  async function registrarTarea(overrides = {}) {
    const response = await api
      .post('/api/tareas')
      .send({ ...TAREA_VALIDA, ...overrides })
      .expect(201);

    return response.body;
  }

  it('responde health 200 y comienza con el listado vacío', async () => {
    const health = await api.get('/api/health').expect(200);
    const listado = await api.get('/api/tareas').expect(200);

    expect(health.body).toEqual({
      status: 'ok',
      service: 'gestor-tareas-academicas',
    });
    expect(listado.body).toEqual([]);
  });

  it('registra una tarea normalizada, aplica defaults y la guarda en SQLite', async () => {
    const response = await api
      .post('/api/tareas')
      .send({
        titulo: '  Preparar entrega  ',
        fechaEntrega: '2026-11-15',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: expect.any(Number),
      titulo: 'Preparar entrega',
      descripcion: '',
      prioridad: 'media',
      fechaEntrega: '2026-11-15',
      estado: 'pendiente',
    });
    expect(Number.isSafeInteger(response.body.id)).toBe(true);
    expect(response.body.id).toBeGreaterThan(0);

    const row = database
      .prepare(
        `SELECT id, titulo, descripcion, prioridad, fecha_entrega, estado
         FROM tareas WHERE id = ?`,
      )
      .get(response.body.id);

    expect(row).toEqual({
      id: response.body.id,
      titulo: 'Preparar entrega',
      descripcion: '',
      prioridad: 'media',
      fecha_entrega: '2026-11-15',
      estado: 'pendiente',
    });
  });

  it('rechaza un POST inválido sin insertar registros', async () => {
    const response = await api
      .post('/api/tareas')
      .send({ titulo: '   ', fechaEntrega: '2026-11-15' })
      .expect(400);

    expect(response.body).toEqual({
      mensaje: 'El título debe tener entre 1 y 120 caracteres.',
    });
    expect(
      database.prepare('SELECT COUNT(*) AS total FROM tareas').get(),
    ).toEqual({ total: 0 });
  });

  it('lista varias tareas ordenadas por id descendente', async () => {
    const primera = await registrarTarea({ titulo: 'Primera tarea' });
    const segunda = await registrarTarea({ titulo: 'Segunda tarea' });
    const tercera = await registrarTarea({ titulo: 'Tercera tarea' });

    const response = await api.get('/api/tareas').expect(200);

    expect(response.body).toEqual([tercera, segunda, primera]);
    expect(response.body.map(({ id }) => id)).toEqual([
      tercera.id,
      segunda.id,
      primera.id,
    ]);
  });

  it('actualiza una tarea con PUT conservando su id y estado', async () => {
    const original = await registrarTarea();
    await api
      .patch(`/api/tareas/${original.id}/estado`)
      .send({ estado: 'completada' })
      .expect(200);

    const response = await api
      .put(`/api/tareas/${original.id}`)
      .send({
        titulo: '  Entrega corregida  ',
        descripcion: 'Versión final',
        prioridad: 'baja',
        fechaEntrega: '2026-12-01',
      })
      .expect(200);

    expect(response.body).toEqual({
      id: original.id,
      titulo: 'Entrega corregida',
      descripcion: 'Versión final',
      prioridad: 'baja',
      fechaEntrega: '2026-12-01',
      estado: 'completada',
    });
  });

  it('rechaza un PUT inválido y conserva los datos anteriores', async () => {
    const original = await registrarTarea();

    const response = await api
      .put(`/api/tareas/${original.id}`)
      .send({ ...TAREA_VALIDA, titulo: '' })
      .expect(400);

    expect(response.body).toEqual({
      mensaje: 'El título debe tener entre 1 y 120 caracteres.',
    });
    expect((await api.get('/api/tareas').expect(200)).body).toEqual([original]);
  });

  it('completa, vuelve a pendiente y repite un estado sin alterar otros campos', async () => {
    const original = await registrarTarea();

    const completada = await api
      .patch(`/api/tareas/${original.id}/estado`)
      .send({ estado: 'completada' })
      .expect(200);
    expect(completada.body).toEqual({ ...original, estado: 'completada' });

    const pendiente = await api
      .patch(`/api/tareas/${original.id}/estado`)
      .send({ estado: 'pendiente' })
      .expect(200);
    expect(pendiente.body).toEqual(original);

    const repetida = await api
      .patch(`/api/tareas/${original.id}/estado`)
      .send({ estado: 'pendiente' })
      .expect(200);
    expect(repetida.body).toEqual(original);
  });

  it('rechaza un PATCH inválido sin modificar la tarea', async () => {
    const original = await registrarTarea();

    const response = await api
      .patch(`/api/tareas/${original.id}/estado`)
      .send({ estado: 'cancelada' })
      .expect(400);

    expect(response.body).toEqual({
      mensaje: 'El estado debe ser pendiente o completada.',
    });
    expect((await api.get('/api/tareas').expect(200)).body).toEqual([original]);
  });

  it('filtra por estado, devuelve vacío sin coincidencias y lista todo sin filtro', async () => {
    const primera = await registrarTarea({ titulo: 'Primera pendiente' });
    const segunda = await registrarTarea({ titulo: 'Segunda pendiente' });

    expect(
      (await api.get('/api/tareas').query({ estado: 'completada' }).expect(200))
        .body,
    ).toEqual([]);

    const completada = (
      await api
        .patch(`/api/tareas/${primera.id}/estado`)
        .send({ estado: 'completada' })
        .expect(200)
    ).body;

    expect(
      (await api.get('/api/tareas').query({ estado: 'pendiente' }).expect(200))
        .body,
    ).toEqual([segunda]);
    expect(
      (await api.get('/api/tareas').query({ estado: 'completada' }).expect(200))
        .body,
    ).toEqual([completada]);
    expect((await api.get('/api/tareas').expect(200)).body).toEqual([
      segunda,
      completada,
    ]);
  });

  it.each([
    ['vacío', '/api/tareas?estado='],
    ['repetido', '/api/tareas?estado=pendiente&estado=completada'],
    ['inválido', '/api/tareas?estado=cancelada'],
  ])('rechaza un filtro %s', async (_caso, url) => {
    const response = await api.get(url).expect(400);

    expect(response.body).toEqual({
      mensaje:
        'El filtro estado debe ser pendiente o completada y aparecer una sola vez.',
    });
  });

  it('elimina una tarea con 204 sin cuerpo y conserva las demás', async () => {
    const conservada = await registrarTarea({ titulo: 'Tarea conservada' });
    const eliminada = await registrarTarea({ titulo: 'Tarea eliminada' });

    const response = await api.delete(`/api/tareas/${eliminada.id}`).expect(204);

    expect(response.text).toBe('');
    expect(
      database.prepare('SELECT id FROM tareas WHERE id = ?').get(eliminada.id),
    ).toBeUndefined();
    expect((await api.get('/api/tareas').expect(200)).body).toEqual([conservada]);
  });

  it.each([
    ['PUT', 'put', '/api/tareas/id-invalido', TAREA_VALIDA],
    [
      'PATCH',
      'patch',
      '/api/tareas/id-invalido/estado',
      { estado: 'pendiente' },
    ],
    ['DELETE', 'delete', '/api/tareas/id-invalido', undefined],
  ])('responde 400 ante un id inválido en %s', async (_nombre, method, url, body) => {
    let operation = api[method](url);
    if (body !== undefined) {
      operation = operation.send(body);
    }

    const response = await operation.expect(400);
    expect(response.body).toEqual({
      mensaje: 'El id debe contener únicamente dígitos.',
    });
  });

  it.each([
    ['PUT', 'put', '/api/tareas', TAREA_VALIDA],
    ['PATCH', 'patch', '/api/tareas', { estado: 'pendiente' }],
    ['DELETE', 'delete', '/api/tareas', undefined],
  ])(
    'responde 404 ante un id válido inexistente en %s',
    async (_nombre, method, baseUrl, body) => {
      const idInexistente = String(Number.MAX_SAFE_INTEGER);
      const suffix = method === 'patch' ? '/estado' : '';
      let operation = api[method](`${baseUrl}/${idInexistente}${suffix}`);
      if (body !== undefined) {
        operation = operation.send(body);
      }

      const response = await operation.expect(404);
      expect(response.body).toEqual({
        mensaje: 'No se encontró la tarea solicitada.',
      });
    },
  );
});

describe('persistencia en un archivo SQLite temporal', () => {
  it('conserva una tarea después de cerrar y reabrir la conexión', async () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'tareas-integration-'));
    const filename = join(temporaryDirectory, 'tareas.db');
    let database;

    try {
      database = createDatabase({ filename });
      const firstApp = request(createApp({ database }));
      const created = (
        await firstApp.post('/api/tareas').send(TAREA_VALIDA).expect(201)
      ).body;

      database.close();
      database = createDatabase({ filename });

      const reopenedApp = request(createApp({ database }));
      const response = await reopenedApp.get('/api/tareas').expect(200);

      expect(response.body).toEqual([created]);
      expect(
        database.prepare('SELECT COUNT(*) AS total FROM tareas').get(),
      ).toEqual({ total: 1 });
    } finally {
      if (database?.open) {
        database.close();
      }
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
