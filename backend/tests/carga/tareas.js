import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 10 },
    { duration: '30s', target: 10 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
    checks: ['rate==1'],
  },
  systemTags: [
    'status',
    'method',
    'name',
    'expected_response',
    'scenario',
    'group',
    'check',
    'error',
    'error_code',
  ],
};

const baseUrl = __ENV.BASE_URL;

if (!baseUrl) {
  throw new Error('BASE_URL es obligatoria para ejecutar la prueba de carga.');
}

function safeJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

function requestParams(name, operation, includeJson = false) {
  return {
    headers: includeJson ? { 'Content-Type': 'application/json' } : undefined,
    tags: { name, operation },
  };
}

export default function () {
  let taskId = null;
  let deleted = false;
  const title = `Carga VU ${__VU} iteración ${__ITER}`;

  try {
    const createResponse = http.post(
      `${baseUrl}/api/tareas`,
      JSON.stringify({
        titulo: title,
        descripcion: 'Tarea generada por la prueba de carga',
        prioridad: 'media',
        fechaEntrega: '2026-12-31',
      }),
      requestParams('POST /api/tareas', 'crear', true),
    );
    const created = safeJson(createResponse);
    const hasValidId =
      created !== null &&
      typeof created.id === 'number' &&
      Number.isSafeInteger(created.id) &&
      created.id > 0;

    check(createResponse, {
      'creación responde 201': (response) => response.status === 201,
      'creación devuelve un id válido': () => hasValidId,
      'creación devuelve estado pendiente': () => created?.estado === 'pendiente',
    });

    if (!hasValidId) {
      return;
    }
    taskId = created.id;

    const listResponse = http.get(
      `${baseUrl}/api/tareas?estado=pendiente`,
      requestParams('GET /api/tareas?estado=pendiente', 'listar_pendientes'),
    );
    const listed = safeJson(listResponse);
    const containsOwnTask =
      Array.isArray(listed) &&
      listed.some(
        (task) =>
          task !== null &&
          task.id === taskId &&
          task.titulo === title &&
          task.estado === 'pendiente',
      );

    check(listResponse, {
      'listado pendiente responde 200': (response) => response.status === 200,
      'listado contiene la tarea propia': () => containsOwnTask,
    });

    const stateResponse = http.patch(
      `${baseUrl}/api/tareas/${taskId}/estado`,
      JSON.stringify({ estado: 'completada' }),
      requestParams('PATCH /api/tareas/:id/estado', 'completar', true),
    );
    const updated = safeJson(stateResponse);

    check(stateResponse, {
      'cambio de estado responde 200': (response) => response.status === 200,
      'cambio conserva el id propio': () => updated?.id === taskId,
      'cambio devuelve estado completada': () => updated?.estado === 'completada',
    });

    const deleteResponse = http.del(
      `${baseUrl}/api/tareas/${taskId}`,
      null,
      requestParams('DELETE /api/tareas/:id', 'eliminar'),
    );
    deleted = deleteResponse.status === 204;

    check(deleteResponse, {
      'eliminación responde 204': (response) => response.status === 204,
    });
  } finally {
    if (taskId !== null && !deleted) {
      const cleanupResponse = http.del(
        `${baseUrl}/api/tareas/${taskId}`,
        null,
        requestParams(
          'DELETE /api/tareas/:id (limpieza)',
          'limpiar_tarea_propia',
        ),
      );

      check(cleanupResponse, {
        'limpieza de tarea propia responde 204 o 404': (response) =>
          response.status === 204 || response.status === 404,
      });
    }

    sleep(1);
  }
}
