/// <reference types="cypress" />

describe('Pomodoro flow', () => {
  it('runs a short preset and logs session', () => {
    cy.visit('/pomodoro');
    cy.contains('10 min pausa').click();
    cy.contains('Iniciar').click();
    cy.wait(1000);
    cy.contains('Pausar').click();
    cy.contains('Resetar').click();
    cy.contains('Histórico recente');
  });

  it('executa ciclo offline com fallback de notificação', () => {
    cy.intercept('POST', '**/auth/v1/**', { forceNetworkError: true });
    cy.clock(Date.now(), ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']);

    cy.visit('/pomodoro', {
      onBeforeLoad(win) {
        delete (win as any).Notification;
        if (!win.navigator.vibrate) {
          win.navigator.vibrate = () => undefined;
        }
      }
    });

    cy.contains('Modo offline ativo');
    cy.contains('5 min respiro').click();
    cy.contains('Iniciar').click();

    cy.tick(5 * 60 * 1000);

    cy.contains('Ciclo concluído 🎯').should('exist');
  });
});
