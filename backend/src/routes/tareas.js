import { Router } from 'express';

import { createTareasRepository } from '../repositories/tareas.js';
import {
  validateEstado,
  validateEstadoFilter,
  validateNewTarea,
  validateTareaId,
} from '../validation/tarea.js';

export function createTareasRouter({ database }) {
  const router = Router();
  const repository = createTareasRepository(database);

  router.post('/', (req, res, next) => {
    const validation = validateNewTarea(req.body);

    if (validation.error) {
      return res.status(400).json({ mensaje: validation.error });
    }

    try {
      const tarea = repository.create(validation.value);
      return res.status(201).json(tarea);
    } catch (error) {
      return next(error);
    }
  });

  router.get('/', (req, res, next) => {
    const validation = validateEstadoFilter(req.query);

    if (validation.error) {
      return res.status(400).json({ mensaje: validation.error });
    }

    try {
      return res.status(200).json(repository.findAll(validation.value));
    } catch (error) {
      return next(error);
    }
  });

  router.put('/:id', (req, res, next) => {
    const idValidation = validateTareaId(req.params.id);
    if (idValidation.error) {
      return res.status(400).json({ mensaje: idValidation.error });
    }

    const tareaValidation = validateNewTarea(req.body);
    if (tareaValidation.error) {
      return res.status(400).json({ mensaje: tareaValidation.error });
    }

    try {
      const tarea = repository.update(idValidation.value, tareaValidation.value);
      if (!tarea) {
        return res.status(404).json({ mensaje: 'No se encontró la tarea solicitada.' });
      }

      return res.status(200).json(tarea);
    } catch (error) {
      return next(error);
    }
  });

  router.patch('/:id/estado', (req, res, next) => {
    const idValidation = validateTareaId(req.params.id);
    if (idValidation.error) {
      return res.status(400).json({ mensaje: idValidation.error });
    }

    const estadoValidation = validateEstado(req.body);
    if (estadoValidation.error) {
      return res.status(400).json({ mensaje: estadoValidation.error });
    }

    try {
      const tarea = repository.updateEstado(idValidation.value, estadoValidation.value);
      if (!tarea) {
        return res.status(404).json({ mensaje: 'No se encontró la tarea solicitada.' });
      }

      return res.status(200).json(tarea);
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/:id', (req, res, next) => {
    const idValidation = validateTareaId(req.params.id);
    if (idValidation.error) {
      return res.status(400).json({ mensaje: idValidation.error });
    }

    try {
      if (!repository.remove(idValidation.value)) {
        return res.status(404).json({ mensaje: 'No se encontró la tarea solicitada.' });
      }

      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
