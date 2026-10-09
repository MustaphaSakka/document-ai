<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { deleteDocument, getDocument } from '../api/documents';
import AppAlert from '../components/AppAlert.vue';
import ExtractedText from '../components/ExtractedText.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { useDocumentPolling } from '../composables/useDocumentPolling';
import type { Document } from '../types/document';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime, formatFileSize } from '../utils/format';

const props = defineProps<{ id: string }>();

const router = useRouter();

const currentDocument = ref<Document | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);
const isDeleting = ref(false);

const {
  status: polledStatus,
  isPolling,
  start: startPolling,
  stop: stopPolling,
} = useDocumentPolling(() => props.id);

const isPending = computed(() => {
  const status = currentDocument.value?.status;
  return status === 'pending' || status === 'processing';
});

async function load(): Promise<void> {
  isLoading.value = true;
  error.value = null;

  try {
    currentDocument.value = await getDocument(props.id);
  } catch (caught) {
    currentDocument.value = null;
    error.value = getErrorMessage(caught);
  } finally {
    isLoading.value = false;
  }
}

/** Loads the document, then polls only if its processing is still running. */
async function initialize(): Promise<void> {
  stopPolling();
  await load();

  if (isPending.value) {
    startPolling();
  }
}

async function handleDelete(): Promise<void> {
  const document = currentDocument.value;

  if (document === null || isDeleting.value) {
    return;
  }

  const confirmed = window.confirm(`Supprimer « ${document.name} » ? Cette action est définitive.`);

  if (!confirmed) {
    return;
  }

  isDeleting.value = true;
  error.value = null;

  try {
    await deleteDocument(document.id);
    await router.push({ name: 'documents' });
  } catch (caught) {
    error.value = getErrorMessage(caught);
  } finally {
    isDeleting.value = false;
  }
}

// Polling reports a status, not a document: refetch once it reaches a terminal
// status so the page picks up the processing result (or the failure reason).
watch(polledStatus, (status) => {
  if (status === 'completed' || status === 'failed') {
    void load();
  }
});

// The same component instance is reused when navigating between two documents.
watch(
  () => props.id,
  () => void initialize(),
);

onMounted(() => {
  void initialize();
});
</script>

<template>
  <section class="page">
    <RouterLink class="back-link" :to="{ name: 'documents' }">← Retour à la liste</RouterLink>

    <p v-if="isLoading" class="state">Chargement du document…</p>

    <template v-else-if="error">
      <AppAlert variant="error" :message="error" />
    </template>

    <article v-else-if="currentDocument !== null">
      <header class="page__header">
        <h1>{{ currentDocument.name }}</h1>
        <StatusBadge :status="currentDocument.status" />
      </header>

      <dl class="metadata">
        <div class="metadata__item">
          <dt>Identifiant</dt>
          <dd>{{ currentDocument.id }}</dd>
        </div>
        <div class="metadata__item">
          <dt>Type</dt>
          <dd>{{ currentDocument.mimetype ?? '—' }}</dd>
        </div>
        <div class="metadata__item">
          <dt>Taille</dt>
          <dd>{{ formatFileSize(currentDocument.size) }}</dd>
        </div>
        <div class="metadata__item">
          <dt>Créé le</dt>
          <dd>{{ formatDateTime(currentDocument.createdAt) }}</dd>
        </div>
        <template v-if="currentDocument.processingResult">
          <div class="metadata__item">
            <dt>Mots</dt>
            <dd>{{ currentDocument.processingResult.wordCount }}</dd>
          </div>
          <div class="metadata__item">
            <dt>Pages estimées</dt>
            <dd>{{ currentDocument.processingResult.pageEstimated }}</dd>
          </div>
          <div class="metadata__item">
            <dt>Durée de traitement</dt>
            <dd>{{ currentDocument.processingResult.processingDuration }} ms</dd>
          </div>
        </template>
      </dl>

      <AppAlert v-if="currentDocument.error" variant="error" :message="currentDocument.error" />

      <p v-if="isPolling" class="state state--muted">
        Traitement en cours, actualisation automatique…
      </p>

      <ExtractedText :document-id="props.id" :status="currentDocument.status" />

      <div class="actions">
        <button
          class="button button--danger"
          type="button"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ isDeleting ? 'Suppression…' : 'Supprimer ce document' }}
        </button>
      </div>
    </article>
  </section>
</template>
