<script setup lang="ts">
import { ref } from 'vue';
import { uploadDocument } from '../api/documents';
import { getErrorMessage } from '../utils/errors';
import { formatFileSize } from '../utils/format';
import AppAlert from './AppAlert.vue';

/** Mirrors MAX_FILE_SIZE in the backend (src/s3-file-handler.ts). */
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

const emit = defineEmits<{ uploaded: [] }>();

const selectedFile = ref<File | null>(null);
const isUploading = ref(false);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const inputElement = ref<HTMLInputElement | null>(null);

function onFileChange(event: Event): void {
  // `event.target` is typed EventTarget: narrow it rather than casting.
  if (!(event.target instanceof HTMLInputElement)) {
    return;
  }

  selectedFile.value = event.target.files?.[0] ?? null;
  error.value = null;
  successMessage.value = null;
}

function resetSelection(): void {
  selectedFile.value = null;

  // The input keeps its value after a successful upload, which would make the
  // same file impossible to pick twice.
  if (inputElement.value !== null) {
    inputElement.value.value = '';
  }
}

async function submit(): Promise<void> {
  const file = selectedFile.value;

  if (file === null || isUploading.value) {
    return;
  }

  // Checked before the request: the backend would reject it with a 413 anyway.
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    error.value = `Le fichier dépasse la limite de 5 Mo (${formatFileSize(file.size)}).`;
    return;
  }

  isUploading.value = true;
  error.value = null;
  successMessage.value = null;

  try {
    const document = await uploadDocument(file);
    successMessage.value = `« ${document.name} » envoyé. Le traitement a démarré.`;
    resetSelection();
    emit('uploaded');
  } catch (caught) {
    error.value = getErrorMessage(caught);
  } finally {
    isUploading.value = false;
  }
}
</script>

<template>
  <form class="upload" @submit.prevent="submit">
    <div class="upload__field">
      <label class="upload__label" for="document-file">Ajouter un document (5 Mo max)</label>
      <input
        id="document-file"
        ref="inputElement"
        class="upload__input"
        type="file"
        :disabled="isUploading"
        @change="onFileChange"
      />
    </div>

    <button class="button" type="submit" :disabled="isUploading || selectedFile === null">
      {{ isUploading ? 'Envoi…' : 'Envoyer' }}
    </button>
  </form>

  <AppAlert v-if="error" variant="error" :message="error" />
  <AppAlert v-else-if="successMessage" variant="success" :message="successMessage" />
</template>
