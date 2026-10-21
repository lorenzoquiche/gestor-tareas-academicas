import { useEffect, useRef, useState } from 'react';

const EMPTY_FORM = {
  titulo: '',
  descripcion: '',
  prioridad: 'media',
  fechaEntrega: '',
};

export function TareaForm({ editingTarea, isSaving, onCancel, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const submittingRef = useRef(false);
  const isEditing = Boolean(editingTarea);

  useEffect(() => {
    if (editingTarea) {
      setForm({
        titulo: editingTarea.titulo,
        descripcion: editingTarea.descripcion,
        prioridad: editingTarea.prioridad,
        fechaEntrega: editingTarea.fechaEntrega,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editingTarea]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    try {
      const succeeded = await onSubmit(form);
      if (succeeded && !isEditing) {
        setForm(EMPTY_FORM);
      }
    } finally {
      submittingRef.current = false;
    }
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    onCancel();
  }

  return (
    <section className="panel form-panel" aria-labelledby="form-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Organiza tu trabajo</p>
          <h2 id="form-title">{isEditing ? 'Editar tarea' : 'Nueva tarea'}</h2>
        </div>
        {isEditing && <span className="editing-badge">Edición activa</span>}
      </div>

      <form data-cy="task-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            name="titulo"
            type="text"
            maxLength="120"
            value={form.titulo}
            onChange={updateField}
            placeholder="Ej. Entregar informe final"
            data-cy="task-title"
            required
          />
          <span className="field-hint">Entre 1 y 120 caracteres.</span>
        </div>

        <div className="field">
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            name="descripcion"
            maxLength="1000"
            rows="4"
            value={form.descripcion}
            onChange={updateField}
            placeholder="Agrega detalles opcionales"
            data-cy="task-description"
          />
          <span className="field-hint">Opcional, máximo 1000 caracteres.</span>
        </div>

        <div className="form-row">
          <div className="field">
            <label htmlFor="prioridad">Prioridad</label>
            <select
              id="prioridad"
              name="prioridad"
              value={form.prioridad}
              onChange={updateField}
              data-cy="task-priority"
            >
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="fechaEntrega">Fecha de entrega</label>
            <input
              id="fechaEntrega"
              name="fechaEntrega"
              type="date"
              value={form.fechaEntrega}
              onChange={updateField}
              data-cy="task-date"
              required
            />
          </div>
        </div>

        <div className="form-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={isSaving}
            data-cy="task-submit"
          >
            {isSaving
              ? 'Guardando…'
              : isEditing
                ? 'Guardar cambios'
                : 'Registrar tarea'}
          </button>
          {isEditing && (
            <button
              className="button button-secondary"
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              data-cy="cancel-edit"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
