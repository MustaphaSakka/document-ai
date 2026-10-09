<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { deleteDocument } from '../api/documents';
import AppAlert from '../components/AppAlert.vue';
import DocumentTable from '../components/DocumentTable.vue';
import DocumentUpload from '../components/DocumentUpload.vue';
import { useDocuments } from '../composables/useDocuments';
import type { Document } from '../types/document';
import { getErrorMessage } from '../utils/errors';

const { documents, isLoading, error, load } = useDocuments();

const deleteError = ref<string | null>(null);
const deletingId = ref<string | null>(null);

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

    <p v-if="isLoading" class="state">Chargement des documents…</p>

    <template v-else-if="error">
      <AppAlert variant="error" :message="error" />
      <button class="button button--secondary" type="button" @click="load">Réessayer</button>
    </template>

    <p v-else-if="documents.length === 0" class="state state--muted">
      Aucun document pour le moment. Envoyez un fichier pour commencer.
    </p>

    <DocumentTable v-else :documents="documents" :deleting-id="deletingId" @remove="handleRemove" />
  </section>
</template>
