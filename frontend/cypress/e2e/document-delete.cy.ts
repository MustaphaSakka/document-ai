import { DOCUMENTS_LIST_URL } from '../support/routes';

describe('Suppression d un document', () => {
  it('supprime le document apres confirmation puis rafraichit la liste', () => {
    cy.intercept('GET', DOCUMENTS_LIST_URL, { fixture: 'documents.json' }).as('listDocuments');
    cy.intercept('DELETE', '/api/documents/doc_001', { statusCode: 204 }).as('deleteDocument');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.on('window:confirm', (message) => {
      expect(message).to.contain('rapport-annuel.pdf');
      return true;
    });

    cy.contains('tr', 'rapport-annuel.pdf').contains('button', 'Supprimer').click();

    cy.wait('@deleteDocument');
    cy.wait('@listDocuments');
  });

  it('ne supprime rien quand la confirmation est refusee', () => {
    cy.intercept('GET', DOCUMENTS_LIST_URL, { fixture: 'documents.json' }).as('listDocuments');
    cy.intercept('DELETE', '/api/documents/doc_001', { statusCode: 204 }).as('deleteDocument');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.on('window:confirm', () => false);

    cy.contains('tr', 'rapport-annuel.pdf').contains('button', 'Supprimer').click();

    cy.get('@deleteDocument.all').should('have.length', 0);
    cy.get('table tbody tr').should('have.length', 2);
  });

  it('supprime le document depuis sa page de detail', () => {
    cy.intercept('GET', DOCUMENTS_LIST_URL, { fixture: 'documents.json' }).as('listDocuments');
    cy.intercept('GET', '/api/documents/doc_001', { fixture: 'document.json' });
    cy.intercept('GET', '/api/documents/doc_001/text', { fixture: 'document-text.json' });
    cy.intercept('DELETE', '/api/documents/doc_001', { statusCode: 204 }).as('deleteDocument');

    cy.visit('/documents/doc_001');

    cy.on('window:confirm', () => true);

    cy.contains('button', 'Supprimer ce document').click();

    cy.wait('@deleteDocument');

    // Back on the list after a successful deletion.
    cy.wait('@listDocuments');
    cy.contains('h1', 'Documents');
  });
});
