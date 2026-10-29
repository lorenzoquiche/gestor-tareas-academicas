const TAREAS_URL = '/api/tareas';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requestJson(url, options = {}) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new ApiError('No se pudo conectar con el servidor.', 0);
  }

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      payload?.mensaje ?? 'El servidor no pudo completar la solicitud.',
      response.status,
    );
  }

  return payload;
}

function jsonOptions(method, body) {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export function listTareas(estado, { signal } = {}) {
  const params = new URLSearchParams();
  if (estado) {
    params.set('estado', estado);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return requestJson(`${TAREAS_URL}${query}`, { signal });
}

export function createTarea(tarea) {
  return requestJson(TAREAS_URL, jsonOptions('POST', tarea));
}

export function updateTarea(id, tarea) {
  return requestJson(`${TAREAS_URL}/${id}`, jsonOptions('PUT', tarea));
}

export function updateTareaEstado(id, estado) {
  return requestJson(
    `${TAREAS_URL}/${id}/estado`,
    jsonOptions('PATCH', { estado }),
  );
}

export function deleteTarea(id) {
  return requestJson(`${TAREAS_URL}/${id}`, { method: 'DELETE' });
}
