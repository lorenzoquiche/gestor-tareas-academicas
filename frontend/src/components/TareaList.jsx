import { TareaCard } from './TareaCard.jsx';

export function TareaList({ busyTareaId, tareas, onDelete, onEdit, onToggle }) {
  return (
    <div className="task-list" data-cy="task-list">
      {tareas.map((tarea) => (
        <TareaCard
          key={tarea.id}
          tarea={tarea}
          isBusy={busyTareaId === tarea.id}
          onDelete={onDelete}
          onEdit={onEdit}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
