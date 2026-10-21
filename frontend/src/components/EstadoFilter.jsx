const FILTERS = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'completada', label: 'Completadas' },
];

export function EstadoFilter({ value, onChange }) {
  return (
    <div className="filters" aria-label="Filtrar tareas por estado">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          className={`filter-button ${value === filter.value ? 'active' : ''}`}
          type="button"
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
          data-cy={`filter-${filter.value}`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
