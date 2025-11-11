/// <reference types="cypress" />

function readQueue(win: Window) {
  return new Cypress.Promise<any[]>((resolve, reject) => {
    const request = win.indexedDB.open('keyval-store');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('keyval', 'readonly');
      const store = transaction.objectStore('keyval');
      const getRequest = store.get('offline-sync-queue');
      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const value = getRequest.result ?? [];
        resolve(Array.isArray(value) ? value : []);
        db.close();
      };
    };
  });
}

describe('Offline synchronization flow', () => {
  beforeEach(() => {
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 200,
      body: {
        access_token: 'token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'refresh',
        user: { id: 'user-123' }
      }
    }).as('authToken');
    cy.intercept('GET', '**/auth/v1/user', {
      statusCode: 200,
      body: { user: { id: 'user-123' } }
    }).as('authUser');
    cy.intercept('GET', '**/rest/v1/tasks*', {
      statusCode: 200,
      body: []
    }).as('fetchTasks');
    cy.intercept('POST', '**/rest/v1/tasks*', (req) => {
      const parsed = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const payload = Array.isArray(parsed) ? parsed : [parsed];
      req.reply({ statusCode: 201, body: payload });
    }).as('syncTasks');

    cy.visit('/');
    cy.window().then((win) => {
      win.localStorage.clear();
      return new Cypress.Promise<void>((resolve, reject) => {
        const request = win.indexedDB.deleteDatabase('keyval-store');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    });
  });

  it('retries queued mutations when connection is restored', () => {
    cy.window().then((win) => {
      win.dispatchEvent(new Event('offline'));
      win.localStorage.setItem('zenko-last-user-id', 'user-123');
    });

    cy.contains('Nova tarefa').click();
    cy.get('input[name="title"]').type('Sincronização offline');
    cy.get('form').contains('Salvar').click();

    cy.window()
      .then((win) => readQueue(win))
      .then((queue) => {
        expect(queue.length).to.eq(1);
      });

    cy.window().then((win) => {
      win.dispatchEvent(new Event('online'));
    });

    cy.wait('@syncTasks');

    cy.window()
      .then((win) => readQueue(win))
      .then((queue) => {
        expect(queue.length).to.eq(0);
      });
  });
});
