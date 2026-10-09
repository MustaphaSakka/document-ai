<script setup lang="ts">
const props = withDefaults(
  defineProps<{ message: string; variant?: 'error' | 'success' | 'info' }>(),
  { variant: 'info' },
);
</script>

<template>
  <p
    class="alert"
    :class="`alert--${props.variant}`"
    :role="props.variant === 'error' ? 'alert' : 'status'"
  >
    {{ props.message }}
  </p>
</template>
