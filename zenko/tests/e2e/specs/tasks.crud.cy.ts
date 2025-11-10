/// <reference types="cypress" />

describe('Kanban Tasks CRUD', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('creates and moves a task across columns', () => {
    cy.contains('Nova tarefa').click();
    cy.get('input[name="title"]').type('Teste Cypress');
    cy.get('form').contains('Salvar').click();

    cy.contains('Teste Cypress').should('exist');

    // simulate drag and drop
    cy.window().then((win) => {
      const dataTransfer = new DataTransfer();
      const taskCard = Cypress.$(`button:contains("Teste Cypress")`).closest('[draggable]')[0];
      const doingColumn = Cypress.$('section').filter((_, el) => el.querySelector('h2')?.textContent === 'Fazendo')[0];
      const doneColumn = Cypress.$('section').filter((_, el) => el.querySelector('h2')?.textContent === 'Feito')[0];

      taskCard?.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true }));
      doingColumn?.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));
      doneColumn?.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));
    });

    cy.reload();
    cy.contains('Teste Cypress').should('exist');
  });
});
