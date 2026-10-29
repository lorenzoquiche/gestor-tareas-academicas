const TAREA_BASE = {
  titulo: 'Preparar exposición',
  descripcion: 'Revisar las diapositivas finales',
  prioridad: 'alta',
  fechaEntrega: '2026-11-20',
};

function crearTareaPorApi(overrides = {}) {
  return cy
    .request('POST', '/api/tareas', { ...TAREA_BASE, ...overrides })
    .its('body');
}

function limpiarTareas() {
  return cy.request('/api/tareas').then(({ body }) => {
    cy.wrap(body).each((tarea) => {
      cy.request('DELETE', `/api/tareas/${tarea.id}`);
    });
  });
}

function visitarAplicacion() {
  cy.intercept('GET', '**/api/tareas*', (request) => {
    delete request.headers['if-none-match'];
    request.continue();
  }).as('listarTareas');
  cy.visit('/');
  cy.wait('@listarTareas').its('response.statusCode').should('eq', 200);
}

function tarjeta(id) {
  return cy.get(`[data-cy="task-${id}"]`);
}

describe('Gestor de tareas académicas', () => {
  beforeEach(() => {
    limpiarTareas();
  });

  it('crea una tarea y conserva sus datos al recargar', () => {
    cy.intercept('POST', '**/api/tareas').as('crearTarea');
    visitarAplicacion();

    cy.get('[data-cy="task-title"]').type('  Informe de calidad  ');
    cy.get('[data-cy="task-description"]').type('Validar los criterios');
    cy.get('[data-cy="task-priority"]').select('alta');
    cy.get('[data-cy="task-date"]').type('2026-12-10');
    cy.get('[data-cy="task-submit"]').click();

    cy.wait('@crearTarea').then(({ response }) => {
      expect(response.statusCode).to.eq(201);
      const tarea = response.body;

      cy.wait('@listarTareas');
      tarjeta(tarea.id).within(() => {
        cy.get('[data-cy="task-card-title"]').should(
          'have.text',
          'Informe de calidad',
        );
        cy.get('[data-cy="task-card-description"]').should(
          'have.text',
          'Validar los criterios',
        );
        cy.get('[data-cy="task-card-date"]').should(
          'have.text',
          '2026-12-10',
        );
      });

      cy.reload();
      cy.wait('@listarTareas');
      tarjeta(tarea.id)
        .find('[data-cy="task-card-title"]')
        .should('have.text', 'Informe de calidad');
    });
  });

  it('edita una tarea y mantiene los cambios', () => {
    crearTareaPorApi().then((tarea) => {
      cy.intercept('PUT', '**/api/tareas/*').as('actualizarTarea');
      visitarAplicacion();

      tarjeta(tarea.id).find(`[data-cy="task-edit-${tarea.id}"]`).click();
      cy.get('[data-cy="task-title"]').clear().type('Exposición actualizada');
      cy.get('[data-cy="task-description"]').clear().type('Ensayar conclusión');
      cy.get('[data-cy="task-priority"]').select('baja');
      cy.get('[data-cy="task-date"]').clear().type('2026-12-15');
      cy.get('[data-cy="task-submit"]').click();

      cy.wait('@actualizarTarea').then(({ response }) => {
        expect(response.statusCode).to.eq(200);
        expect(response.body.id).to.eq(tarea.id);
      });
      cy.wait('@listarTareas');

      tarjeta(tarea.id).within(() => {
        cy.get('[data-cy="task-card-title"]').should(
          'have.text',
          'Exposición actualizada',
        );
        cy.get('[data-cy="task-card-description"]').should(
          'have.text',
          'Ensayar conclusión',
        );
        cy.get('[data-cy="task-card-priority"]').should(
          'contain.text',
          'baja',
        );
        cy.get('[data-cy="task-card-date"]').should(
          'have.text',
          '2026-12-15',
        );
      });
    });
  });

  it('cancela una edición sin modificar la tarea', () => {
    crearTareaPorApi({ titulo: 'Tarea sin cambios' }).then((tarea) => {
      cy.intercept('PUT', '**/api/tareas/*').as('actualizarTarea');
      visitarAplicacion();

      tarjeta(tarea.id).find(`[data-cy="task-edit-${tarea.id}"]`).click();
      cy.get('[data-cy="task-title"]').clear().type('Cambio descartado');
      cy.get('[data-cy="cancel-edit"]').click();

      cy.get('@actualizarTarea.all').should('have.length', 0);
      tarjeta(tarea.id)
        .find('[data-cy="task-card-title"]')
        .should('have.text', 'Tarea sin cambios');
      cy.request('/api/tareas').its('body').should('deep.equal', [tarea]);
    });
  });

  it('completa una tarea, verifica los filtros y la devuelve a pendiente', () => {
    crearTareaPorApi({ titulo: 'Objetivo del filtro' }).then((objetivo) => {
      crearTareaPorApi({ titulo: 'Otra tarea pendiente' }).then((otra) => {
        cy.intercept('PATCH', '**/api/tareas/*/estado').as('cambiarEstado');
        visitarAplicacion();

        tarjeta(objetivo.id)
          .find(`[data-cy="task-toggle-${objetivo.id}"]`)
          .click();
        cy.wait('@cambiarEstado')
          .its('response.body.estado')
          .should('eq', 'completada');
        cy.wait('@listarTareas');

        cy.get('[data-cy="filter-completada"]').click();
        cy.wait('@listarTareas');
        tarjeta(objetivo.id).should('be.visible');
        tarjeta(otra.id).should('not.exist');

        cy.get('[data-cy="filter-pendiente"]').click();
        cy.wait('@listarTareas');
        tarjeta(otra.id).should('be.visible');
        tarjeta(objetivo.id).should('not.exist');

        cy.get('[data-cy="filter-completada"]').click();
        cy.wait('@listarTareas');
        tarjeta(objetivo.id)
          .find(`[data-cy="task-toggle-${objetivo.id}"]`)
          .click();
        cy.wait('@cambiarEstado')
          .its('response.body.estado')
          .should('eq', 'pendiente');
        cy.wait('@listarTareas');
        cy.get('[data-cy="empty-state"]').should('be.visible');

        cy.get('[data-cy="filter-pendiente"]').click();
        cy.wait('@listarTareas');
        tarjeta(objetivo.id).should('be.visible');
        tarjeta(otra.id).should('be.visible');
      });
    });
  });

  it('rechaza un título compuesto por espacios sin registrar la tarea', () => {
    cy.intercept('POST', '**/api/tareas').as('crearTarea');
    visitarAplicacion();

    cy.get('[data-cy="task-title"]').type('   ');
    cy.get('[data-cy="task-date"]').type('2026-12-20');
    cy.get('[data-cy="task-submit"]').click();

    cy.wait('@crearTarea').its('response.statusCode').should('eq', 400);
    cy.get('[data-cy="notice"]').should(
      'contain.text',
      'El título debe tener entre 1 y 120 caracteres.',
    );
    cy.get('[data-cy="empty-state"]').should('be.visible');
    cy.request('/api/tareas').its('body').should('deep.equal', []);
  });

  it('cancela una eliminación y luego confirma solo la tarea elegida', () => {
    crearTareaPorApi({ titulo: 'Tarea que permanece' }).then((conservada) => {
      crearTareaPorApi({ titulo: 'Tarea para eliminar' }).then((eliminada) => {
        cy.intercept('DELETE', '**/api/tareas/*').as('eliminarTarea');
        visitarAplicacion();

        cy.window().then((win) => {
          const confirmDelete = cy.stub(win, 'confirm');
          confirmDelete.onFirstCall().returns(false);
          confirmDelete.onSecondCall().returns(true);
          cy.wrap(confirmDelete).as('confirmDelete');
        });

        tarjeta(eliminada.id)
          .find(`[data-cy="task-delete-${eliminada.id}"]`)
          .click();
        cy.get('@confirmDelete').should(
          'have.been.calledWith',
          '¿Eliminar la tarea "Tarea para eliminar"?',
        );
        cy.get('@eliminarTarea.all').should('have.length', 0);
        tarjeta(eliminada.id).should('exist');

        tarjeta(eliminada.id)
          .find(`[data-cy="task-delete-${eliminada.id}"]`)
          .click();
        cy.wait('@eliminarTarea').its('response.statusCode').should('eq', 204);
        cy.wait('@listarTareas');

        cy.get('@confirmDelete').should('have.been.calledTwice');
        tarjeta(eliminada.id).should('not.exist');
        tarjeta(conservada.id).should('be.visible');
      });
    });
  });
});
