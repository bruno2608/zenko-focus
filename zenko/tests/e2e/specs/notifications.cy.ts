/// <reference types="cypress" />

describe('Notification banner', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad(win) {
        const NotificationMock = function () {
          return undefined;
        } as unknown as typeof Notification;

        Object.defineProperty(NotificationMock, 'permission', {
          configurable: true,
          get: () => 'denied'
        });

        NotificationMock.requestPermission = () => Promise.resolve('denied');

        Object.defineProperty(win, 'Notification', {
          configurable: true,
          writable: true,
          value: NotificationMock
        });
      }
    });
  });

  it('shows banner and disables notification toggle when browser blocks alerts', () => {
    cy.contains('Notificações bloqueadas pelo navegador').should('be.visible');
    cy.contains('Perfil').click();
    cy.contains('Preferências').should('be.visible');
    cy.get('[data-preference-toggle="Notificações ativas"]').within(() => {
      cy.get('button[role="switch"]').should('be.disabled');
      cy.get('button[role="switch"]').should(
        'have.attr',
        'title',
        'As notificações foram bloqueadas no navegador. Permita novamente nas configurações do site.'
      );
    });
  });
});
