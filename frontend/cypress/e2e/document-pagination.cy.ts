import { DOCUMENTS_LIST_URL } from '../support/routes';

/**
 * Pagination of the document list. The backend has answered a page at a time
 * since `GET /documents?page=&limit=`; these tests describe how the interface
 * consumes it. Responses are stubbed, so the suite passes with the backend
 * stopped, and every stub echoes the page that was asked for the way the real
 * API does.
 */

const TOTAL_DOCUMENTS = 42;
const PAGE_SIZE = 20;

interface StubDocument {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  size: number;
  mimetype: string;
}

interface StubPage {
  documents: StubDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** Documents are numbered across the whole list, as a user would see them. */
function documentNumbered(index: number, status = 'completed'): StubDocument {
  const number = String(index + 1).padStart(2, '0');

  return {
    id: `doc_${number}`,
    name: `document-${number}.pdf`,
    status,
    createdAt: '2026-02-01T10:00:00.000Z',
    size: 2048,
    mimetype: 'application/pdf',
  };
}

function pageBody(
  page: number,
  total: number = TOTAL_DOCUMENTS,
  status: (index: number) => string = () => 'completed',
): StubPage {
  const firstIndex = (page - 1) * PAGE_SIZE;
  const count = Math.max(0, Math.min(PAGE_SIZE, total - firstIndex));

  const documents = Array.from({ length: count }, (_, offset) =>
    documentNumbered(firstIndex + offset, status(firstIndex + offset)),
  );

  return {
    documents,
    total,
    page,
    limit: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

/** Answers whatever page the client asked for. */
function stubPages(status: (index: number) => string = () => 'completed'): void {
  cy.intercept('GET', DOCUMENTS_LIST_URL, (request) => {
    const requestedPage = Number(new URL(request.url).searchParams.get('page'));

    request.reply({ body: pageBody(requestedPage, TOTAL_DOCUMENTS, status) });
  }).as('listDocuments');
}

describe('Pagination de la liste des documents', () => {
  it('affiche la premiere page et la demande au backend', () => {
    stubPages();

    cy.visit('/documents');
    cy.wait('@listDocuments').its('request.url').should('include', 'page=1&limit=20');

    cy.get('table tbody tr').should('have.length', 20);
    cy.contains('td', 'document-01.pdf');
    cy.contains('td', 'document-20.pdf');

    cy.contains('42 documents — page 1 / 3');
    cy.contains('button', 'Précédent').should('be.disabled');
    cy.contains('button', 'Suivant').should('be.enabled');
  });

  it('affiche la page suivante sans garder la precedente', () => {
    stubPages();

    cy.visit('/documents');
    cy.wait('@listDocuments');
    cy.contains('td', 'document-01.pdf');

    cy.contains('button', 'Suivant').click();

    cy.wait('@listDocuments').its('request.url').should('include', 'page=2&limit=20');

    cy.contains('42 documents — page 2 / 3');
    cy.contains('td', 'document-21.pdf');
    cy.contains('td', 'document-40.pdf');
    cy.get('table tbody tr').should('have.length', 20);

    // Replaced, not appended to: the previous page is off screen.
    cy.contains('td', 'document-01.pdf').should('not.exist');
  });

  it('revient a la page precedente', () => {
    stubPages();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('button', 'Suivant').click();
    cy.wait('@listDocuments');
    cy.contains('42 documents — page 2 / 3');

    cy.contains('button', 'Précédent').click();

    cy.wait('@listDocuments').its('request.url').should('include', 'page=1&limit=20');

    cy.contains('42 documents — page 1 / 3');
    cy.contains('td', 'document-01.pdf');
  });

  it('desactive Suivant sur la derniere page', () => {
    stubPages();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('button', '3').click();
    cy.wait('@listDocuments');

    cy.contains('42 documents — page 3 / 3');
    cy.get('table tbody tr').should('have.length', 2);
    cy.contains('td', 'document-42.pdf');

    cy.contains('button', 'Suivant').should('be.disabled');
    cy.contains('button', 'Précédent').should('be.enabled');
  });

  it('ne recharge pas la page deja affichee', () => {
    stubPages();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('button', '1').click();
    cy.wait(500);

    cy.get('@listDocuments.all').should('have.length', 1);
  });

  it('affiche l erreur du backend sans pagination', () => {
    cy.intercept('GET', DOCUMENTS_LIST_URL, {
      statusCode: 500,
      body: { error: 'Internal Server Error', message: 'Serveur indisponible' },
    }).as('listDocuments');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('Serveur indisponible');
    cy.get('table').should('not.exist');
    cy.contains('button', 'Suivant').should('not.exist');
    cy.contains('button', 'Réessayer');
  });

  it('revient a la derniere page valide quand la page affichee disparait', () => {
    let totalDocuments = TOTAL_DOCUMENTS;

    cy.intercept('GET', DOCUMENTS_LIST_URL, (request) => {
      const requestedPage = Number(new URL(request.url).searchParams.get('page'));

      request.reply({ body: pageBody(requestedPage, totalDocuments) });
    }).as('listDocuments');

    // The deletion is what removes page 3, so the shrinking list is driven by
    // the DELETE itself. A plain assignment in the test body would run while
    // the command queue is still being built — before `cy.visit` — and the
    // first load would already see 21 documents.
    cy.intercept('DELETE', '/api/documents/*', (request) => {
      totalDocuments = 21;
      request.reply({ statusCode: 204 });
    }).as('deleteDocument');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('button', '3').click();
    cy.wait('@listDocuments');
    cy.get('table tbody tr').should('have.length', 2);

    cy.on('window:confirm', () => true);

    cy.contains('tr', 'document-41.pdf').contains('button', 'Supprimer').click();
    cy.wait('@deleteDocument');

    cy.wait('@listDocuments');
    cy.wait('@listDocuments');

    cy.contains('21 documents — page 2 / 2');
    cy.contains('td', 'document-21.pdf');
    cy.contains('td', 'document-41.pdf').should('not.exist');
  });

  it('continue le polling sur la page affichee', () => {
    // Page 1 is fully processed, so nothing polls until the page changes; the
    // pages after it still have work in progress.
    stubPages((index) => (index < PAGE_SIZE ? 'completed' : 'processing'));

    cy.visit('/documents');
    cy.wait('@listDocuments');
    cy.contains('td', 'Terminé');

    cy.contains('button', 'Suivant').click();

    // Landing on a page with work pending starts the loop again, and the loop
    // must reload the page on screen — never page 1.
    cy.wait('@listDocuments').its('request.url').should('include', 'page=2&limit=20');
    cy.contains('td', 'En cours');

    cy.wait('@listDocuments', { timeout: 10000 })
      .its('request.url')
      .should('include', 'page=2&limit=20');
  });
});
