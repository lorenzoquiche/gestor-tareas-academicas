const PRIORIDADES = new Set(['baja', 'media', 'alta']);
const ESTADOS = new Set(['pendiente', 'completada']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRealIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function validateNewTarea(body) {
  if (!isPlainObject(body)) {
    return { error: 'El cuerpo de la solicitud debe ser un objeto JSON.' };
  }

  if (typeof body.titulo !== 'string') {
    return { error: 'El título es obligatorio y debe ser texto.' };
  }

  const titulo = body.titulo.trim();
  if (titulo.length === 0 || titulo.length > 120) {
    return { error: 'El título debe tener entre 1 y 120 caracteres.' };
  }

  if (body.descripcion !== undefined && typeof body.descripcion !== 'string') {
    return { error: 'La descripción debe ser texto.' };
  }

  const descripcion = body.descripcion ?? '';
  if (descripcion.length > 1000) {
    return { error: 'La descripción no puede superar los 1000 caracteres.' };
  }

  if (body.prioridad !== undefined && typeof body.prioridad !== 'string') {
    return { error: 'La prioridad debe ser texto.' };
  }

  const prioridad = body.prioridad ?? 'media';
  if (!PRIORIDADES.has(prioridad)) {
    return { error: 'La prioridad debe ser baja, media o alta.' };
  }

  if (!isRealIsoDate(body.fechaEntrega)) {
    return {
      error: 'La fecha de entrega es obligatoria y debe ser una fecha real con formato YYYY-MM-DD.',
    };
  }

  return {
    value: {
      titulo,
      descripcion,
      prioridad,
      fechaEntrega: body.fechaEntrega,
    },
  };
}

export function validateTareaId(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return { error: 'El id debe contener únicamente dígitos.' };
  }

  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return { error: 'El id debe representar un entero positivo seguro.' };
  }

  return { value: id };
}

export function validateEstado(body) {
  if (!isPlainObject(body)) {
    return { error: 'El cuerpo de la solicitud debe ser un objeto JSON.' };
  }

  if (typeof body.estado !== 'string' || !ESTADOS.has(body.estado)) {
    return { error: 'El estado debe ser pendiente o completada.' };
  }

  return { value: body.estado };
}

export function validateEstadoFilter(query) {
  if (!Object.prototype.hasOwnProperty.call(query, 'estado')) {
    return { value: undefined };
  }

  if (typeof query.estado !== 'string' || !ESTADOS.has(query.estado)) {
    return { error: 'El filtro estado debe ser pendiente o completada y aparecer una sola vez.' };
  }

  return { value: query.estado };
}
