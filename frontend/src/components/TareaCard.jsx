export function TareaCard({ tarea, isBusy, onDelete, onEdit, onToggle }) {
  const isCompleted = tarea.estado === 'completada';

  function confirmDelete() {
    if (window.confirm(`¿Eliminar la tarea "${tarea.titulo}"?`)) {
      onDelete(tarea);
    }
  }

  return (
    <article
      className={`task-card ${isCompleted ? 'task-card-completed' : ''}`}
      data-cy={`task-${tarea.id}`}
      data-state={tarea.estado}
    >
      <div className="task-card-header">
        <div className="task-title-group">
          <span className={`priority priority-${tarea.prioridad}`}>
            Prioridad {tarea.prioridad}
          </span>
          <h3>{tarea.titulo}</h3>
        </div>
        <span className={`status status-${tarea.estado}`}>
          {isCompleted ? 'Completada' : 'Pendiente'}
        </span>
      </div>

      <p className={`task-description ${tarea.descripcion ? '' : 'muted'}`}>
        {tarea.descripcion || 'Sin descripción.'}
      </p>

      <dl className="task-meta">
        <div>
          <dt>Entrega</dt>
          <dd>
            <time dateTime={tarea.fechaEntrega}>{tarea.fechaEntrega}</time>
          </dd>
        </div>
      </dl>

      <div className="task-actions">
        <button
          className="button button-secondary"
          type="button"
          onClick={() => onEdit(tarea)}
          disabled={isBusy}
          data-cy={`task-edit-${tarea.id}`}
        >
          Editar
        </button>
        <button
          className="button button-state"
          type="button"
          onClick={() => onToggle(tarea)}
          disabled={isBusy}
          data-cy={`task-toggle-${tarea.id}`}
        >
          {isCompleted ? 'Volver a pendiente' : 'Completar'}
        </button>
        <button
          className="button button-danger"
          type="button"
          onClick={confirmDelete}
          disabled={isBusy}
          data-cy={`task-delete-${tarea.id}`}
        >
          Eliminar
        </button>
      </div>
    </article>
  );
}
