/// <reference types="cypress" />

describe('Reminders management', () => {
  beforeEach(() => {
    cy.visit('/reminders');
  });

  it('creates a reminder and toggles lists', () => {
    cy.contains('Novo lembrete').click();
    cy.get('input[name="title"]').type('Reunião');
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);
    cy.get('input[type="datetime-local"]').type(future);
    cy.get('form').contains('Salvar').click();
    cy.contains('Reunião').should('exist');
    cy.contains('Passados').click();
    cy.contains('Nenhum lembrete').should('exist');
  });
});
