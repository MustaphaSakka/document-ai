import { DOCUMENTS_LIST_URL } from '../support/routes';

describe('Detail d un document', () => {
  it('affiche les informations du document', () => {
    cy.intercept('GET', '/api/documents/doc_001', { fixture: 'document.json' });
    cy.intercept('GET', '/api/documents/doc_001/text', { fixture: 'document-text.json' });

    cy.visit('/documents/doc_001');

    cy.contains('h1', 'rapport-annuel.pdf');
    cy.contains('.badge', 'Terminé');

    cy.get('.metadata').should('contain.text', 'doc_001');
    cy.get('.metadata').should('contain.text', 'application/pdf');
    cy.get('.metadata').should('contain.text', '412');
  });

  it('affiche une erreur quand le document est introuvable', () => {
    cy.intercept('GET', '/api/documents/inconnu', {
      statusCode: 404,
      body: { error: 'Not Found', message: 'Document inconnu introuvable' },
    });

    cy.visit('/documents/inconnu');

    cy.contains('Document inconnu introuvable');
    cy.get('.metadata').should('not.exist');
  });

  it('revient a la liste depuis le detail', () => {
    cy.intercept('GET', DOCUMENTS_LIST_URL, { fixture: 'documents.json' }).as('listDocuments');
    cy.intercept('GET', '/api/documents/doc_001', { fixture: 'document.json' });
    cy.intercept('GET', '/api/documents/doc_001/text', { fixture: 'document-text.json' });

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('a', 'rapport-annuel.pdf').click();
    cy.contains('h1', 'rapport-annuel.pdf');

    cy.contains('a', 'Retour à la liste').click();
    cy.wait('@listDocuments');
    cy.get('table tbody tr').should('have.length', 2);
  });
});
