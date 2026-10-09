/**
 * The list view, driven entirely by stubbed responses: these tests describe the
 * UI states (loading, error, empty, filled) and never depend on the backend.
 */
describe('Liste des documents', () => {
  it('affiche les documents renvoyes par l API', () => {
    cy.intercept('GET', '/api/documents', { fixture: 'documents.json' }).as('listDocuments');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('h1', 'Documents');
    cy.get('table tbody tr').should('have.length', 2);

    cy.contains('td', 'rapport-annuel.pdf');
    cy.contains('td', 'notes.txt');
    cy.contains('td', 'Terminé');
    cy.contains('td', 'En cours');
    cy.contains('td', '200.0 Ko');
  });

  it('affiche un message quand la liste est vide', () => {
    cy.intercept('GET', '/api/documents', { body: { documents: [], total: 0 } }).as(
      'listDocuments',
    );

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('Aucun document pour le moment');
    cy.get('table').should('not.exist');
  });

  it('affiche une erreur puis permet de reessayer', () => {
    let callCount = 0;

    cy.intercept('GET', '/api/documents', (request) => {
      callCount += 1;

      if (callCount === 1) {
        request.reply({
          statusCode: 500,
          body: { error: 'Internal Server Error', message: 'Serveur indisponible' },
        });
        return;
      }

      request.reply({ fixture: 'documents.json' });
    }).as('listDocuments');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('Serveur indisponible');
    cy.get('table').should('not.exist');

    cy.contains('button', 'Réessayer').click();
    cy.wait('@listDocuments');

    cy.contains('Serveur indisponible').should('not.exist');
    cy.get('table tbody tr').should('have.length', 2);
  });

  it('actualise le statut des documents en traitement sans recharger la page', () => {
    const processingDocument = {
      id: 'doc_002',
      name: 'notes.txt',
      status: 'processing',
      createdAt: '2026-02-02T09:30:00.000Z',
      size: 1024,
      mimetype: 'text/plain',
    };
    const completedDocument = { ...processingDocument, status: 'completed' };

    let callCount = 0;

    cy.intercept('GET', '/api/documents', (request) => {
      callCount += 1;

      // The first responses keep it processing so the intermediate state is
      // observable; the next one is what the backend would return later.
      const documents = callCount <= 2 ? [processingDocument] : [completedDocument];
      request.reply({ body: { documents, total: documents.length } });
    }).as('listDocuments');

    cy.visit('/documents');

    cy.contains('td', 'En cours');
    cy.contains('td', 'Terminé', { timeout: 10000 });
  });

  it('arrete les requetes quand plus aucun document n est en traitement', () => {
    const completedDocument = {
      id: 'doc_001',
      name: 'rapport-annuel.pdf',
      status: 'completed',
      createdAt: '2026-02-01T10:00:00.000Z',
      size: 204800,
      mimetype: 'application/pdf',
    };

    cy.intercept('GET', '/api/documents', {
      body: { documents: [completedDocument], total: 1 },
    }).as('listDocuments');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('td', 'Terminé');

    // Longer than the polling interval: had the loop run, extra requests would
    // have been issued by now.
    cy.wait(3000);
    cy.get('@listDocuments.all').should('have.length', 1);
  });
});
