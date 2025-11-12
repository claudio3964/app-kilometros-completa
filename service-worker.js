<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => console.log('✅ Service Worker registrado correctamente.', reg))
      .catch(err => console.error('❌ Error registrando Service Worker:', err));
  });
}
</script>
