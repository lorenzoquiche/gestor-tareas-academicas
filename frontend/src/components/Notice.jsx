export function Notice({ notice, onDismiss }) {
  if (!notice) {
    return null;
  }

  const isError = notice.type === 'error';

  return (
    <div
      className={`notice notice-${notice.type}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      data-cy="notice"
    >
      <span>{notice.text}</span>
      <button type="button" onClick={onDismiss} aria-label="Cerrar mensaje">
        ×
      </button>
    </div>
  );
}
