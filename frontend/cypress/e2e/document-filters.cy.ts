import { DOCUMENTS_LIST_URL } from '../support/routes';

/**
 * Search and filters on the document list. The stub filters and paginates the
 * way the backend does — narrow first, cut the page second — so these tests
 * describe what a user gets, not just which request was sent. Responses are
 * stubbed, so the suite passes with the backend stopped.
 */

interface StubDocument {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  size: number;
  mimetype: string;
}

/**
 * Newest first, the order the API returns them in.
 *
 * Nothing here is `pending` or `processing` on purpose: a page holding either
 * would start the background refresh, and the requests it sends would arrive
 * between the ones these tests are about. Only the polling test wants that, so
 * it brings its own catalogue.
 */
const CATALOGUE: StubDocument[] = [
  document('doc_005', 'photo.png', 'completed', 'image/png'),
  document('doc_004', 'notes.txt', 'completed', 'text/plain'),
  document('doc_003', 'contrat.pdf', 'failed', 'application/pdf'),
  document('doc_002', 'facture-fevrier.pdf', 'completed', 'application/pdf'),
  document('doc_001', 'facture-janvier.pdf', 'completed', 'application/pdf'),
];

/** One document still being processed, so the list polls while it is on screen. */
const PROCESSING_CATALOGUE: StubDocument[] = [
  document('doc_001', 'facture-en-cours.pdf', 'processing', 'application/pdf'),
];

function document(id: string, name: string, status: string, mimetype: string): StubDocument {
  return { id, name, status, createdAt: '2026-02-01T10:00:00.000Z', size: 2048, mimetype };
}

/** Twenty-five completed invoices: more than one page at the default limit. */
function manyInvoices(): StubDocument[] {
  return Array.from({ length: 25 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');

    return document(`doc_${number}`, `facture-${number}.pdf`, 'completed', 'application/pdf');
  });
}

/**
 * Answers the list the way the backend does: every filter that is present must
 * match, then the page is cut from what is left. `total` therefore counts the
 * matching documents, not the stored ones.
 */
function stubFilteredList(catalogue: StubDocument[] = CATALOGUE): void {
  cy.intercept('GET', DOCUMENTS_LIST_URL, (request) => {
    const params = new URL(request.url).searchParams;
    const search = (params.get('search') ?? '').toLowerCase();
    const status = params.get('status') ?? '';
    const mimeType = params.get('mimeType') ?? '';
    const page = Number(params.get('page') ?? '1');
    const limit = Number(params.get('limit') ?? '20');

    const matching = catalogue.filter(
      (item) =>
        item.name.toLowerCase().includes(search) &&
        (status === '' || item.status === status) &&
        (mimeType === '' || item.mimetype === mimeType),
    );

    request.reply({
      body: {
        documents: matching.slice((page - 1) * limit, page * limit),
        total: matching.length,
        page,
        limit,
        totalPages: Math.ceil(matching.length / limit),
      },
    });
  }).as('listDocuments');
}

describe('Recherche et filtres de la liste des documents', () => {
  it('affiche la liste complete quand aucun filtre n est actif', () => {
    stubFilteredList();

    cy.visit('/documents');
    cy.wait('@listDocuments').its('request.url').should('not.include', 'search=');

    cy.get('table tbody tr').should('have.length', 5);
    cy.contains('5 documents — page 1 / 1');
  });

  it('recherche un document par son nom', () => {
    stubFilteredList();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-search').type('facture{enter}');

    cy.wait('@listDocuments').its('request.url').should('include', 'search=facture');
    cy.get('table tbody tr').should('have.length', 2);
    cy.contains('td', 'facture-janvier.pdf');
    cy.contains('td', 'contrat.pdf').should('not.exist');
  });

  it('filtre par statut', () => {
    stubFilteredList();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-status').select('completed');

    cy.wait('@listDocuments').its('request.url').should('include', 'status=completed');
    cy.get('table tbody tr').should('have.length', 4);
    cy.contains('td', 'Échec').should('not.exist');
  });

  it('filtre par type MIME', () => {
    stubFilteredList();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-mime-type').select('text/plain');

    // URLSearchParams encodes the value, so the slash travels as %2F.
    cy.wait('@listDocuments').its('request.url').should('include', 'mimeType=text%2Fplain');
    cy.contains('td', 'notes.txt');
    cy.get('table tbody tr').should('have.length', 1);

    cy.get('#document-mime-type').select('image/png');
    cy.wait('@listDocuments').its('request.url').should('include', 'mimeType=image%2Fpng');
    cy.contains('td', 'photo.png');
    cy.get('table tbody tr').should('have.length', 1);
  });

  it('combine plusieurs filtres', () => {
    stubFilteredList();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-search').type('facture{enter}');
    cy.wait('@listDocuments');

    cy.get('#document-status').select('completed');
    cy.wait('@listDocuments')
      .its('request.url')
      .should('include', 'search=facture')
      .and('include', 'status=completed');
    cy.get('table tbody tr').should('have.length', 2);

    // Filters narrow together: the invoices are not failed, so this is empty.
    cy.get('#document-status').select('failed');
    cy.wait('@listDocuments');

    cy.contains('Aucun document ne correspond à ces filtres.');
    cy.get('table').should('not.exist');
  });

  it('revient a la premiere page quand un filtre change', () => {
    stubFilteredList(manyInvoices());

    cy.visit('/documents');
    cy.wait('@listDocuments');
    cy.contains('25 documents — page 1 / 2');

    cy.contains('button', '2').click();
    cy.wait('@listDocuments').its('request.url').should('include', 'page=2');
    cy.contains('25 documents — page 2 / 2');
    cy.get('table tbody tr').should('have.length', 5);

    // Page 2 of the previous result set means nothing for the new one.
    cy.get('#document-status').select('completed');

    cy.wait('@listDocuments')
      .its('request.url')
      .should('include', 'page=1')
      .and('include', 'status=completed');
    cy.contains('25 documents — page 1 / 2');
    cy.get('table tbody tr').should('have.length', 20);
  });

  it('reinitialise les filtres', () => {
    stubFilteredList();

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-search').type('facture{enter}');
    cy.wait('@listDocuments');
    cy.get('#document-status').select('completed');
    cy.wait('@listDocuments');
    cy.get('table tbody tr').should('have.length', 2);

    cy.contains('button', 'Réinitialiser').click();

    cy.wait('@listDocuments')
      .its('request.url')
      .should('not.include', 'search=')
      .and('not.include', 'status=');

    cy.get('#document-search').should('have.value', '');
    cy.get('#document-status').should('have.value', '');
    cy.get('table tbody tr').should('have.length', 5);
  });

  it('conserve les filtres en changeant de page', () => {
    stubFilteredList(manyInvoices());

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.get('#document-status').select('completed');
    cy.wait('@listDocuments');
    cy.contains('25 documents — page 1 / 2');

    cy.contains('button', '2').click();

    cy.wait('@listDocuments')
      .its('request.url')
      .should('include', 'page=2')
      .and('include', 'status=completed');
    cy.contains('25 documents — page 2 / 2');
  });

  it('conserve les filtres pendant le polling', () => {
    stubFilteredList(PROCESSING_CATALOGUE);

    cy.visit('/documents');
    // Two requests on arrival: the load itself, then the loop's first run,
    // which happens as soon as the page is known to hold work in progress.
    cy.wait('@listDocuments');
    cy.wait('@listDocuments');

    cy.get('#document-status').select('processing');
    cy.wait('@listDocuments').its('request.url').should('include', 'status=processing');
    cy.contains('td', 'En cours');

    // The loop reloads the page on screen, filters included — never page 1 of
    // the unfiltered list.
    cy.wait('@listDocuments', { timeout: 10000 })
      .its('request.url')
      .should('include', 'status=processing');
  });

  it('affiche l erreur du backend sans masquer les filtres', () => {
    cy.intercept('GET', DOCUMENTS_LIST_URL, {
      statusCode: 500,
      body: { error: 'Internal Server Error', message: 'Serveur indisponible' },
    }).as('listDocuments');

    cy.visit('/documents');
    cy.wait('@listDocuments');

    cy.contains('Serveur indisponible');
    cy.get('table').should('not.exist');
    cy.contains('button', 'Réessayer');

    // The controls survive the error: widening the filters is the obvious way
    // out when a narrowed list comes back empty.
    cy.get('#document-search').should('be.visible');
    cy.contains('button', 'Réinitialiser').should('be.visible');
  });
});
