<template>
  <div class="app">
    <header class="app__bar">
      <RouterLink class="app__brand" :to="{ name: 'documents' }">Document AI</RouterLink>
    </header>

    <main class="app__main">
      <RouterView />
    </main>
  </div>
</template>
