// js/include.js
document.addEventListener("DOMContentLoaded", () => {
  const includes = document.querySelectorAll('[data-include]');
  includes.forEach(el => {
    const file = el.getAttribute('data-include');
    console.log(`Chargement de ${file}...`);
    fetch(file)
      .then(response => response.text())
      .then(html => {
        el.innerHTML = html;
        console.log(`✔️ ${file} chargé.`);

        if (file.includes('sidebar.html')) {
          const script = document.createElement('script');
          script.src = '/js/sidebar.js';
          document.body.appendChild(script);
        }
      });
  });
});
