/// <reference types="cypress" />

describe('Offline synchronization queue', () => {
  beforeEach(() => {
    cy.viewport('iphone-12');
    cy.intercept('POST', '**/auth/v1/**', { forceNetworkError: true });
    cy.intercept('GET', '**/rest/v1/tasks**', { forceNetworkError: true }).as('offlineTasks');
    cy.visit('/');
  });

  it('persists creations offline and syncs when connectivity returns', () => {
    cy.contains('Modo offline ativo');

    cy.contains('Nova tarefa').click();
    cy.get('input[name="title"]').type('Sincronizar depois');
    cy.get('form').contains('Salvar').click();

    cy.contains('[data-task-id]', 'Sincronizar depois').should('exist');

    cy.window().then((win) => {
      const raw = win.localStorage.getItem('zenko-offline-tasks');
      expect(raw, 'offline queue persisted').to.be.a('string');
      const offlineTasks = raw ? JSON.parse(raw) : [];
      expect(offlineTasks.some((task: any) => task.title === 'Sincronizar depois')).to.be.true;

      win.localStorage.removeItem('zenko-offline-tasks');
      cy.intercept('GET', '**/rest/v1/tasks**', { body: offlineTasks }).as('syncedTasks');
    });

    cy.reload();
    cy.wait('@syncedTasks');

    cy.contains('[data-task-id]', 'Sincronizar depois').should('exist');
  });
});
