<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { ApiError } from '../api/client';
import { getDocumentText } from '../api/documents';
import type { DocumentStatus } from '../types/document';
import { getErrorMessage } from '../utils/errors';
import AppAlert from './AppAlert.vue';

const props = defineProps<{ documentId: string; status: DocumentStatus }>();

/** 409 and 404 are expected states here, not failures: they get their own message. */
const HANDLED_STATUSES = [404, 409];

const WAITING_MESSAGE = 'Le texte sera affiché dès que le traitement du document sera terminé.';

const text = ref<string | null>(null);
const numpages = ref(0);
const isLoading = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const hasText = computed(() => text.value !== null && text.value.trim() !== '');

/** Re-runs whenever the document or its status changes, including once on mount. */
const source = computed(() => ({ documentId: props.documentId, status: props.status }));

async function load(): Promise<void> {
  error.value = null;
  notice.value = null;
  text.value = null;

  if (props.status !== 'completed') {
    // A failed document shows its error at the view level, so stay quiet here.
    notice.value = props.status === 'failed' ? null : WAITING_MESSAGE;
    return;
  }

  isLoading.value = true;

  try {
    const response = await getDocumentText(props.documentId);
    text.value = response.text;
    numpages.value = response.numpages;
  } catch (caught) {
    if (caught instanceof ApiError && HANDLED_STATUSES.includes(caught.status)) {
      notice.value = caught.message;
    } else {
      error.value = getErrorMessage(caught);
    }
  } finally {
    isLoading.value = false;
  }
}

watch(source, () => void load(), { immediate: true });
</script>

<template>
  <section class="extracted-text">
    <h2>Texte extrait</h2>

    <p v-if="isLoading" class="state">Chargement du texte…</p>

    <template v-else-if="error">
      <AppAlert variant="error" :message="error" />
      <button class="button button--secondary" type="button" @click="load">Réessayer</button>
    </template>

    <p v-else-if="notice" class="state state--muted">{{ notice }}</p>

    <p v-else-if="!hasText" class="state state--muted">
      Aucun texte n'a été extrait de ce document.
    </p>

    <template v-else>
      <p class="state state--muted">{{ numpages }} page(s)</p>
      <pre class="extracted-text__content">{{ text }}</pre>
    </template>
  </section>
</template>
