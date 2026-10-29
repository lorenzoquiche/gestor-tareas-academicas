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
  const findAllByEstado = database.prepare(`
    SELECT id, titulo, descripcion, prioridad, fecha_entrega, estado
    FROM tareas
    WHERE estado = ?
    ORDER BY id DESC
  `);
  const update = database.prepare(`
    UPDATE tareas
    SET titulo = @titulo,
        descripcion = @descripcion,
        prioridad = @prioridad,
        fecha_entrega = @fechaEntrega
    WHERE id = @id
  `);
  const updateEstado = database.prepare(`
    UPDATE tareas
    SET estado = @estado
    WHERE id = @id
  `);
  const remove = database.prepare('DELETE FROM tareas WHERE id = ?');

  return {
    create(tarea) {
      const result = insert.run(tarea);
      return mapTarea(findById.get(result.lastInsertRowid));
    },

    findAll(estado) {
      const rows = estado === undefined ? findAll.all() : findAllByEstado.all(estado);
      return rows.map(mapTarea);
    },

    update(id, tarea) {
      if (!findById.get(id)) {
        return null;
      }

      update.run({ id, ...tarea });
      return mapTarea(findById.get(id));
    },

    updateEstado(id, estado) {
      const existing = findById.get(id);
      if (!existing) {
        return null;
      }

      updateEstado.run({ id, estado });
      return mapTarea(findById.get(id));
    },

    remove(id) {
      return remove.run(id).changes > 0;
    },
  };
}
