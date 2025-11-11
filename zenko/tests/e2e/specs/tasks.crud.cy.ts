/// <reference types="cypress" />

describe('Kanban Tasks CRUD', () => {
  beforeEach(() => {
    cy.viewport('iphone-12');
    cy.visit('/');
  });

  it('creates and moves a task across columns using mobile controls', () => {
    cy.contains('Nova tarefa').click();
    cy.get('input[name="title"]').type('Teste Cypress');
    cy.get('form').contains('Salvar').click();

    const findCard = () => cy.contains('[data-task-id]', 'Teste Cypress');

    findCard().should('have.attr', 'data-status', 'todo');

    findCard().contains('button', 'Mover para próxima coluna').should('be.visible').click();

    findCard().should('have.attr', 'data-status', 'doing');

    findCard().contains('button', 'Mover para próxima coluna').click();

    findCard().should('have.attr', 'data-status', 'done');

    findCard().contains('button', 'Mover para coluna anterior').click();

    findCard().should('have.attr', 'data-status', 'doing');
  });
});
