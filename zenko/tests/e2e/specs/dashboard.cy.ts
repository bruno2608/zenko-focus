/// <reference types="cypress" />

describe('Dashboard realtime', () => {
  it('displays KPIs and charts', () => {
    cy.visit('/dashboard');
    cy.contains('Dashboard');
    cy.contains('Tarefas');
    cy.contains('Pomodoros (hoje)');
    cy.contains('Lembretes ativos hoje');
  });
});
