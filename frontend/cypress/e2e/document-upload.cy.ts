const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

describe('Upload d un document', () => {
  it('envoie le fichier puis rafraichit la liste', () => {
    cy.intercept('GET', '/api/documents', { fixture: 'documents.json' }).as('listDocuments');
    cy.intercept('POST', '/api/documents', {
      statusCode: 201,
      body: {
        id: 'doc_003',
        name: 'nouveau.pdf',
        status: 'pending',
        createdAt: '2026-02-03T08:00:00.000Z',
        size: 2048,
        mimetype: 'application/pdf',
      },
    }).as('uploadDocument');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-file').selectFile({
      contents: Cypress.Buffer.from('contenu du fichier'),
      fileName: 'nouveau.pdf',
      mimeType: 'application/pdf',
    });

    cy.contains('button', 'Envoyer').click();

    cy.wait('@uploadDocument');
    cy.contains('nouveau.pdf').should('be.visible');
    cy.contains('envoyé');

    // The list is reloaded once the upload succeeds.
    cy.wait('@listDocuments');
  });

  it('suit le traitement du document envoye sans recharger la page', () => {
    const pendingDocument = {
      id: 'doc_003',
      name: 'nouveau.pdf',
      status: 'pending',
      createdAt: '2026-02-03T08:00:00.000Z',
      size: 2048,
      mimetype: 'application/pdf',
    };
    const completedDocument = { ...pendingDocument, status: 'completed' };

    let callCount = 0;

    cy.intercept('GET', '/api/documents', (request) => {
      callCount += 1;

      // Empty to start with, then the uploaded document while it is still
      // pending, then the same document once processing finished.
      const documents =
        callCount === 1 ? [] : [callCount < 4 ? pendingDocument : completedDocument];

      request.reply({ body: { documents, total: documents.length } });
    }).as('listDocuments');

    cy.intercept('POST', '/api/documents', {
      statusCode: 201,
      body: pendingDocument,
    }).as('uploadDocument');

    cy.visit('/documents');
    cy.wait('@listDocuments');
    cy.contains('Aucun document pour le moment');

    cy.get('#document-file').selectFile({
      contents: Cypress.Buffer.from('contenu du fichier'),
      fileName: 'nouveau.pdf',
      mimeType: 'application/pdf',
    });
    cy.contains('button', 'Envoyer').click();
    cy.wait('@uploadDocument');

    cy.contains('td', 'En attente');
    cy.contains('td', 'Terminé', { timeout: 10000 });
  });

  it('refuse un fichier de plus de 5 Mo sans appeler l API', () => {
    // Only completed documents, so that the background refresh never starts and
    // the request counts below stay meaningful.
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
    cy.intercept('POST', '/api/documents', { statusCode: 500 }).as('uploadDocument');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-file').selectFile({
      contents: Cypress.Buffer.alloc(MAX_UPLOAD_SIZE_BYTES + 1),
      fileName: 'trop-gros.pdf',
      mimeType: 'application/pdf',
    });

    cy.contains('button', 'Envoyer').click();

    cy.contains('dépasse la limite de 5 Mo');
    cy.get('@uploadDocument.all').should('have.length', 0);
    cy.get('@listDocuments.all').should('have.length', 1);
  });
});
