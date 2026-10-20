import express from 'express';
import { createTareasRouter } from './routes/tareas.js';

export function createApp({ database } = {}) {
  if (!database) {
    throw new TypeError('Se requiere una conexión de base de datos.');
  }

  const app = express();

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'gestor-tareas-academicas',
    });
  });

  app.use('/api/tareas', createTareasRouter({ database }));

  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({
        mensaje: 'El cuerpo de la solicitud debe contener JSON válido.',
      });
    }

    console.error('Error interno al procesar la solicitud.', {
      nombre: error?.name,
      codigo: error?.code,
    });

    return res.status(500).json({
      mensaje: 'No fue posible procesar la solicitud.',
    });
  });

  return app;
}
