<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  page: number;
  totalPages: number;
  total: number;
}>();

const emit = defineEmits<{ change: [page: number] }>();

/**
 * Every page number. Ellipses would be premature: the list is not long enough
 * for a windowed range to matter yet, and a plain range stays readable.
 */
const pages = computed<number[]>(() =>
  Array.from({ length: props.totalPages }, (_, index) => index + 1),
);

const canGoPrevious = computed<boolean>(() => props.page > 1);
const canGoNext = computed<boolean>(() => props.page < props.totalPages);

const summary = computed<string>(
  () =>
    `${props.total} document${props.total > 1 ? 's' : ''} — page ${props.page} / ${props.totalPages}`,
);
</script>

<template>
  <div class="pagination">
    <p v-if="props.total > 0" class="pagination__summary">{{ summary }}</p>

    <!-- A single page needs no controls: there is nowhere to go. -->
    <nav v-if="props.totalPages > 1" class="pagination__nav" aria-label="Pagination">
      <button
        class="button button--secondary"
        type="button"
        :disabled="!canGoPrevious"
        @click="emit('change', props.page - 1)"
      >
        ← Précédent
      </button>

      <ul class="pagination__pages">
        <li v-for="number in pages" :key="number">
          <button
            class="pagination__page"
            :class="{ 'pagination__page--current': number === props.page }"
            type="button"
            :aria-current="number === props.page ? 'page' : undefined"
            @click="emit('change', number)"
          >
            {{ number }}
          </button>
        </li>
      </ul>

      <button
        class="button button--secondary"
        type="button"
        :disabled="!canGoNext"
        @click="emit('change', props.page + 1)"
      >
        Suivant →
      </button>
    </nav>
  </div>
</template>
