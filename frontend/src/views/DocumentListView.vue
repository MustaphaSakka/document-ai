<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { deleteDocument } from '../api/documents';
import AppAlert from '../components/AppAlert.vue';
import DocumentFilters from '../components/DocumentFilters.vue';
import DocumentTable from '../components/DocumentTable.vue';
import DocumentUpload from '../components/DocumentUpload.vue';
import PaginationControls from '../components/PaginationControls.vue';
import { useDocuments } from '../composables/useDocuments';
import type { Document } from '../types/document';
import { getErrorMessage } from '../utils/errors';

const {
  documents,
  currentPage,
  total,
  totalPages,
  search,
  status,
  mimeType,
  hasActiveFilters,
  isLoading,
  error,
  load,
  goToPage,
  applyFilters,
  resetFilters,
} = useDocuments();

const deleteError = ref<string | null>(null);
const deletingId = ref<string | null>(null);

/**
 * An empty page means one of two very different things, and saying which is the
 * difference between "there is nothing here yet" and "your filters match
 * nothing" — the second one invites the user to widen them.
 */
const emptyMessage = computed<string>(() =>
  hasActiveFilters.value
    ? 'Aucun document ne correspond à ces filtres.'
    : 'Aucun document pour le moment. Envoyez un fichier pour commencer.',
);

function confirmDelete(document: Document): boolean {
  return window.confirm(`Supprimer « ${document.name} » ? Cette action est définitive.`);
}

async function handleRemove(document: Document): Promise<void> {
  if (!confirmDelete(document)) {
    return;
  }

  deletingId.value = document.id;
  deleteError.value = null;

  try {
    await deleteDocument(document.id);
    await load();
  } catch (caught) {
    deleteError.value = getErrorMessage(caught);
  } finally {
    deletingId.value = null;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="page">
    <header class="page__header">
      <h1>Documents</h1>
      <p class="page__subtitle">Cliquez sur un nom pour voir le détail et le texte extrait.</p>
    </header>

    <DocumentUpload @uploaded="load" />

    <AppAlert v-if="deleteError" variant="error" :message="deleteError" />

    <!--
      Outside the loading/error/empty chain on purpose: applying a filter
      reloads the list, and the controls must not disappear — with the text the
      user just typed — while the request is on its way.
    -->
    <DocumentFilters
      v-model:search="search"
      v-model:status="status"
      v-model:mime-type="mimeType"
      @apply="applyFilters"
      @reset="resetFilters"
    />

    <p v-if="isLoading" class="state">Chargement des documents…</p>

    <template v-else-if="error">
      <AppAlert variant="error" :message="error" />
      <button class="button button--secondary" type="button" @click="load">Réessayer</button>
    </template>

    <p v-else-if="documents.length === 0" class="state state--muted">{{ emptyMessage }}</p>

    <template v-else>
      <DocumentTable :documents="documents" :deleting-id="deletingId" @remove="handleRemove" />

      <PaginationControls
        :page="currentPage"
        :total-pages="totalPages"
        :total="total"
        @change="goToPage"
      />
    </template>
  </section>
</template>
