<script setup lang="ts">
import type { Document } from '../types/document';
import { formatDateTime, formatFileSize } from '../utils/format';
import StatusBadge from './StatusBadge.vue';

const props = defineProps<{
  documents: Document[];
  /** Id of the document currently being deleted, if any. */
  deletingId?: string | null;
}>();

const emit = defineEmits<{ remove: [document: Document] }>();
</script>

<template>
  <div class="table-wrapper">
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Nom</th>
          <th scope="col">Statut</th>
          <th scope="col">Date</th>
          <th scope="col">Taille</th>
          <th scope="col"><span class="visually-hidden">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="doc in props.documents" :key="doc.id">
          <td>
            <RouterLink class="table__link" :to="`/documents/${doc.id}`">
              {{ doc.name }}
            </RouterLink>
          </td>
          <td><StatusBadge :status="doc.status" /></td>
          <td>{{ formatDateTime(doc.createdAt) }}</td>
          <td>{{ formatFileSize(doc.size) }}</td>
          <td class="table__actions">
            <button
              class="button button--danger"
              type="button"
              :disabled="props.deletingId === doc.id"
              @click="emit('remove', doc)"
            >
              {{ props.deletingId === doc.id ? 'Suppression…' : 'Supprimer' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
