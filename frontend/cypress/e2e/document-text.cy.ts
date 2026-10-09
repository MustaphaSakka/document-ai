const COMPLETED_DOCUMENT = {
  id: 'doc_001',
  name: 'rapport-annuel.pdf',
  status: 'completed',
  createdAt: '2026-02-01T10:00:00.000Z',
  size: 204800,
  mimetype: 'application/pdf',
};

describe('Texte extrait', () => {
  it('affiche le texte quand il est disponible', () => {
    cy.intercept('GET', '/api/documents/doc_001', { fixture: 'document.json' });
    cy.intercept('GET', '/api/documents/doc_001/text', { fixture: 'document-text.json' });

    cy.visit('/documents/doc_001');

    cy.contains('h2', 'Texte extrait');
    cy.contains('2 page(s)');
    cy.get('.extracted-text__content').should('contain.text', 'Rapport annuel 2026');
  });

  it('signale qu aucun texte n a ete extrait (404)', () => {
    cy.intercept('GET', '/api/documents/doc_001', { body: COMPLETED_DOCUMENT });
    cy.intercept('GET', '/api/documents/doc_001/text', {
      statusCode: 404,
      body: { error: 'Not Found', message: 'Aucun texte extrait pour ce document' },
    });

    cy.visit('/documents/doc_001');

    cy.contains('Aucun texte extrait pour ce document');
    cy.get('.extracted-text__content').should('not.exist');
  });

  it('attend la fin du traitement puis affiche le texte', () => {
    let detailCalls = 0;
    let statusCalls = 0;

    // The document is pending on arrival, then becomes completed: the same
    // sequence the real backend produces.
    cy.intercept('GET', '/api/documents/doc_002', (request) => {
      detailCalls += 1;
      request.reply({ fixture: detailCalls === 1 ? 'document-pending.json' : 'document.json' });
    });

    cy.intercept('GET', '/api/documents/doc_002/status', (request) => {
      statusCalls += 1;
      request.reply({
        body: {
          id: 'doc_002',
          status: statusCalls === 1 ? 'processing' : 'completed',
          createdAt: '2026-02-02T09:30:00.000Z',
        },
      });
    }).as('pollStatus');

    cy.intercept('GET', '/api/documents/doc_002/text', { fixture: 'document-text.json' });

    cy.visit('/documents/doc_002');

    cy.contains('Traitement en cours, actualisation automatique');
    cy.wait('@pollStatus');

    // Polling keeps running until the status becomes terminal.
    cy.get('.extracted-text__content', { timeout: 10000 }).should(
      'contain.text',
      'Rapport annuel 2026',
    );
  });

  it('affiche une erreur si la recuperation du texte echoue', () => {
    cy.intercept('GET', '/api/documents/doc_001', { body: COMPLETED_DOCUMENT });
    cy.intercept('GET', '/api/documents/doc_001/text', {
      statusCode: 500,
      body: { error: 'Internal Server Error', message: 'Extraction indisponible' },
    });

    cy.visit('/documents/doc_001');

    cy.contains('Extraction indisponible');
    cy.contains('button', 'Réessayer');
  });
});
