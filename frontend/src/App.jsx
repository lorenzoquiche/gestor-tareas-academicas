import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createTarea,
  deleteTarea,
  listTareas,
  updateTarea,
  updateTareaEstado,
} from './api/tareas.js';
import { EstadoFilter } from './components/EstadoFilter.jsx';
import { Notice } from './components/Notice.jsx';
import { TareaForm } from './components/TareaForm.jsx';
import { TareaList } from './components/TareaList.jsx';

function errorMessage(error) {
  return error?.message || 'Ocurrió un error inesperado.';
}

export function App() {
  const [tareas, setTareas] = useState([]);
  const [filter, setFilter] = useState('todas');
  const [editingTarea, setEditingTarea] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyTareaId, setBusyTareaId] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const requestSequence = useRef(0);
  const listController = useRef(null);
  const currentFilter = useRef(filter);

  useEffect(() => {
    currentFilter.current = filter;
  }, [filter]);

  const loadTareas = useCallback(async (selectedFilter) => {
    listController.current?.abort();
    const controller = new AbortController();
    const requestId = ++requestSequence.current;
    listController.current = controller;
    setIsLoading(true);
    setLoadError('');

    try {
      const estado = selectedFilter === 'todas' ? undefined : selectedFilter;
      const data = await listTareas(estado, { signal: controller.signal });
      if (requestId === requestSequence.current) {
        setTareas(data);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && requestId === requestSequence.current) {
        setLoadError(errorMessage(error));
      }
    } finally {
      if (requestId === requestSequence.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTareas(filter);
    return () => listController.current?.abort();
  }, [filter, loadTareas]);

  async function refreshCurrentFilter() {
    await loadTareas(currentFilter.current);
  }

  async function handleSubmit(form) {
    setIsSaving(true);
    setNotice(null);

    try {
      if (editingTarea) {
        await updateTarea(editingTarea.id, form);
        setEditingTarea(null);
        setNotice({ type: 'success', text: 'Tarea actualizada correctamente.' });
      } else {
        await createTarea(form);
        setNotice({ type: 'success', text: 'Tarea registrada correctamente.' });
      }
      await refreshCurrentFilter();
      return true;
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(tarea) {
    const nextEstado = tarea.estado === 'completada' ? 'pendiente' : 'completada';
    setBusyTareaId(tarea.id);
    setNotice(null);

    try {
      await updateTareaEstado(tarea.id, nextEstado);
      setNotice({
        type: 'success',
        text:
          nextEstado === 'completada'
            ? 'Tarea marcada como completada.'
            : 'Tarea marcada como pendiente.',
      });
      await refreshCurrentFilter();
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    } finally {
      setBusyTareaId(null);
    }
  }

  async function handleDelete(tarea) {
    setBusyTareaId(tarea.id);
    setNotice(null);

    try {
      await deleteTarea(tarea.id);
      if (editingTarea?.id === tarea.id) {
        setEditingTarea(null);
      }
      setNotice({ type: 'success', text: `Se eliminó “${tarea.titulo}”.` });
      await refreshCurrentFilter();
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) });
    } finally {
      setBusyTareaId(null);
    }
  }

  function handleEdit(tarea) {
    setEditingTarea(tarea);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="header-content">
          <p className="eyebrow">Planificación personal</p>
          <h1>Gestor de tareas académicas</h1>
          <p className="header-description">
            Registra entregas, ajusta prioridades y mantén visible tu progreso.
          </p>
        </div>
      </header>

      <main className="main-layout">
        <div className="form-column">
          <TareaForm
            editingTarea={editingTarea}
            isSaving={isSaving}
            onCancel={() => setEditingTarea(null)}
            onSubmit={handleSubmit}
          />
          <Notice notice={notice} onDismiss={() => setNotice(null)} />
        </div>

        <section className="panel list-panel" aria-labelledby="list-title">
          <div className="list-heading">
            <div>
              <p className="eyebrow">Seguimiento</p>
              <h2 id="list-title">Mis tareas</h2>
            </div>
            <span className="task-count" aria-live="polite">
              {tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>

          <EstadoFilter value={filter} onChange={setFilter} />

          {isLoading && (
            <p className="state-message" role="status" data-cy="loading-state">
              Cargando tareas…
            </p>
          )}

          {!isLoading && loadError && (
            <div className="state-message error-state" role="alert" data-cy="load-error">
              <p>{loadError}</p>
              <button
                className="button button-primary"
                type="button"
                onClick={() => loadTareas(currentFilter.current)}
                data-cy="retry-load"
              >
                Reintentar
              </button>
            </div>
          )}

          {!isLoading && !loadError && tareas.length === 0 && (
            <div className="state-message empty-state" data-cy="empty-state">
              <strong>No hay tareas en esta vista.</strong>
              <span>Registra una nueva o cambia el filtro.</span>
            </div>
          )}

          {!isLoading && !loadError && tareas.length > 0 && (
            <TareaList
              tareas={tareas}
              busyTareaId={busyTareaId}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onToggle={handleToggle}
            />
          )}
        </section>
      </main>
    </div>
  );
}
