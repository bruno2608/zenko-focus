/// <reference types="cypress" />

describe('Reminders management', () => {
  it('creates a reminder and toggles lists', () => {
    cy.visit('/reminders');
    cy.contains('Novo lembrete').click();
    cy.get('input[name="title"]').type('Reunião');
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);
    cy.get('input[type="datetime-local"]').type(future);
    cy.get('form').contains('Salvar').click();
    cy.contains('Reunião').should('exist');
    cy.contains('Passados').click();
    cy.contains('Nenhum lembrete').should('exist');
  });

  it('registra lembrete offline e exibe fallback de notificação', () => {
    cy.intercept('POST', '**/auth/v1/**', { forceNetworkError: true });
    cy.clock(Date.now(), ['setTimeout', 'clearTimeout', 'Date']);

    cy.visit('/reminders', {
      onBeforeLoad(win) {
        delete (win as any).Notification;
      }
    });

    cy.contains('Modo offline ativo');
    cy.contains('Novo lembrete').click();

    const future = new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16);
    cy.get('input[name="title"]').type('Revisar contrato offline');
    cy.get('input[type="datetime-local"]').type(future);
    cy.get('form').contains('Salvar').click();

    cy.contains('Lembrete criado');

    cy.tick(60 * 1000);

    cy.contains('Lembrete: Revisar contrato offline').should('exist');
  });
});
