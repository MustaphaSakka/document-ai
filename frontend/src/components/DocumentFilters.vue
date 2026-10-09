<script setup lang="ts">
import type { DocumentStatus } from '../types/document';

/**
 * The statuses the backend accepts, with the words the table shows next to each
 * row (the same ones as `StatusBadge.vue`, so a filter and the rows it returns
 * read alike). `Record<DocumentStatus, string>` makes the mapping exhaustive:
 * a new status fails to compile until it is given a label here.
 */
const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'En attente',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
};

/**
 * The types the backend accepts on upload (`ALLOWED_MIMETYPES` in
 * `src/s3-file-handler.ts`). Filtering on any other type could only ever return
 * an empty list, so the select offers exactly these.
 */
const MIME_TYPES: readonly { value: string; label: string }[] = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/msword', label: 'Word (.doc)' },
  {
    value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word (.docx)',
  },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/png', label: 'PNG' },
  { value: 'text/plain', label: 'Texte' },
];

const search = defineModel<string>('search', { required: true });
const status = defineModel<DocumentStatus | ''>('status', { required: true });
const mimeType = defineModel<string>('mimeType', { required: true });

/**
 * `apply` asks for the list again; `reset` clears everything first. Both are
 * the parent's to carry out — this component holds no state of its own and
 * decides nothing about pages.
 */
const emit = defineEmits<{ apply: []; reset: [] }>();
</script>

<template>
  <!--
    A form, so that Enter in the search field submits it: that is what makes the
    search work without a button of its own, and it is the same event in every
    browser. The selects apply on `change`, which is when a choice is made.
  -->
  <form class="filters" @submit.prevent="emit('apply')">
    <div class="filters__field filters__field--search">
      <label class="filters__label" for="document-search">Rechercher un document</label>
      <input
        id="document-search"
        v-model="search"
        class="filters__input"
        type="search"
        placeholder="Nom du document…"
      />
    </div>

    <div class="filters__field">
      <label class="filters__label" for="document-status">Statut</label>
      <select id="document-status" v-model="status" class="filters__select" @change="emit('apply')">
        <option value="">Tous les statuts</option>
        <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="filters__field">
      <label class="filters__label" for="document-mime-type">Type</label>
      <select
        id="document-mime-type"
        v-model="mimeType"
        class="filters__select"
        @change="emit('apply')"
      >
        <option value="">Tous les types</option>
        <option v-for="type in MIME_TYPES" :key="type.value" :value="type.value">
          {{ type.label }}
        </option>
      </select>
    </div>

    <button class="button button--secondary" type="button" @click="emit('reset')">
      Réinitialiser
    </button>
  </form>
</template>
