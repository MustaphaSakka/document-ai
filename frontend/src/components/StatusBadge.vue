<script setup lang="ts">
import type { DocumentStatus } from '../types/document';

const props = defineProps<{ status: DocumentStatus }>();

/** Record<DocumentStatus, string> makes the mapping exhaustive at compile time. */
const STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'En attente',
  processing: 'En cours',
  completed: 'Terminé',
  failed: 'Échec',
};
</script>

<template>
  <span class="badge" :class="`badge--${props.status}`">{{ STATUS_LABELS[props.status] }}</span>
</template>
