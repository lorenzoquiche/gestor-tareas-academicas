import { Router } from 'express';

import { createTareasRepository } from '../repositories/tareas.js';
import { validateNewTarea } from '../validation/tarea.js';

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
    try {
      return res.status(200).json(repository.findAll());
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
