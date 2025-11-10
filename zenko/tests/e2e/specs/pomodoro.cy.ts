/// <reference types="cypress" />

describe('Pomodoro flow', () => {
  beforeEach(() => {
    cy.visit('/pomodoro');
  });

  it('runs a short preset and logs session', () => {
    cy.contains('10 min pausa').click();
    cy.contains('Iniciar').click();
    cy.wait(1000);
    cy.contains('Pausar').click();
    cy.contains('Resetar').click();
    cy.contains('Histórico recente');
  });
});
