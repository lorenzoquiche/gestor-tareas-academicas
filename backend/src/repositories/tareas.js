function mapTarea(row) {
  return {
    id: row.id,
    titulo: row.titulo,
    descripcion: row.descripcion,
    prioridad: row.prioridad,
    fechaEntrega: row.fecha_entrega,
    estado: row.estado,
  };
}

export function createTareasRepository(database) {
  const insert = database.prepare(`
    INSERT INTO tareas (titulo, descripcion, prioridad, fecha_entrega, estado)
    VALUES (@titulo, @descripcion, @prioridad, @fechaEntrega, 'pendiente')
  `);
  const findById = database.prepare(`
    SELECT id, titulo, descripcion, prioridad, fecha_entrega, estado
    FROM tareas
    WHERE id = ?
  `);
  const findAll = database.prepare(`
    SELECT id, titulo, descripcion, prioridad, fecha_entrega, estado
    FROM tareas
    ORDER BY id DESC
  `);

  return {
    create(tarea) {
      const result = insert.run(tarea);
      return mapTarea(findById.get(result.lastInsertRowid));
    },

    findAll() {
      return findAll.all().map(mapTarea);
    },
  };
}
