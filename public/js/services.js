document.addEventListener('DOMContentLoaded', async () => {
  const list = document.querySelector('ul#services-list');
  const searchInput = document.getElementById('searchInput');

  try {
    const res = await fetch('/api/services');
    const services = await res.json();

    services.forEach(service => {
      const li = document.createElement('li');
      li.className = "flex justify-between items-center bg-gray-700 p-4 rounded";

      // Nom du service
      const label = document.createElement('span');
      label.className = "text-lg font-semibold";
      label.textContent = service.name;

      // Bouton Détails
      const btnDetails = document.createElement('button');
      btnDetails.textContent = 'Détails';
      btnDetails.className = 'bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1 rounded mr-4';

      // Zone de description (initialement cachée)
      const description = document.createElement('span');
      description.className = 'ml-4 text-sm italic hidden';
      description.textContent = `État: ${service.status}`;

      btnDetails.addEventListener('click', () => {
        // Toggle affichage de la description
        description.classList.toggle('hidden');
      });

      // Contrôles (start, pause, kill)
      const controls = document.createElement('div');
      controls.className = "space-x-2 flex items-center";

      const btnStart = document.createElement('button');
      btnStart.textContent = 'Start';
      btnStart.className = 'bg-green-600 hover:bg-green-700 text-sm px-3 py-1 rounded';

      const btnPause = document.createElement('button');
      btnPause.textContent = 'Pause';
      btnPause.className = 'bg-yellow-500 hover:bg-yellow-600 text-sm px-3 py-1 rounded';

      const btnKill = document.createElement('button');
      btnKill.textContent = 'Kill';
      btnKill.className = 'bg-red-600 hover:bg-red-700 text-sm px-3 py-1 rounded';

      controls.append(btnDetails, btnStart, btnPause, btnKill);

      li.append(label, controls, description);
      list.appendChild(li);
    });

    // Ajout de la recherche en dehors de la boucle
    searchInput.addEventListener('input', () => {
      const filter = searchInput.value.toLowerCase();
      const items = document.querySelectorAll('#services-list > li');

      items.forEach(li => {
        const serviceName = li.querySelector('span.text-lg').textContent.toLowerCase();
        if (serviceName.includes(filter)) {
          li.style.display = '';
        } else {
          li.style.display = 'none';
        }
      });
    });

  } catch (e) {
    console.error('Erreur chargement services:', e);
  }
});
