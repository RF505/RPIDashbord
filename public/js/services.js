document.addEventListener('DOMContentLoaded', async () => {
  const list = document.querySelector('ul#services-list');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  try {
    const res = await fetch('/api/services');
    const services = await res.json();

    function renderList(filteredServices) {
      list.innerHTML = '';

      filteredServices.forEach(service => {
        const li = document.createElement('li');
        li.className = "bg-gray-700 p-4 rounded flex justify-between items-center";

        // Couleur du statut
        let statusColor = "text-gray-400";
        if (service.status === "running") statusColor = "text-green-500";
        else if (service.status === "dead") statusColor = "text-red-500";
        else if (service.status === "inactive") statusColor = "text-gray-400";

        // Nom + état
        const label = document.createElement('span');
        label.className = "text-lg font-semibold flex items-center gap-2";

        const nameText = document.createElement('span');
        nameText.textContent = service.name;

        const statusText = document.createElement('span');
        statusText.textContent = `(${service.status})`;
        statusText.className = `${statusColor} font-normal`;

        label.append(nameText, statusText);

        // Contrôles
        const controls = document.createElement('div');
        controls.className = "space-x-2 flex items-center";

        const btnInfo = document.createElement('button');
        btnInfo.textContent = 'Information';
        btnInfo.title = service.description || "Aucune description disponible";
        btnInfo.className = 'bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1 rounded';

        const btnStart = document.createElement('button');
        btnStart.textContent = 'Start';
        btnStart.className = 'bg-green-600 hover:bg-green-700 text-sm px-3 py-1 rounded';

        const btnPause = document.createElement('button');
        btnPause.textContent = 'Pause';
        btnPause.className = 'bg-yellow-500 hover:bg-yellow-600 text-sm px-3 py-1 rounded';

        const btnKill = document.createElement('button');
        btnKill.textContent = 'Kill';
        btnKill.className = 'bg-red-600 hover:bg-red-700 text-sm px-3 py-1 rounded';

        controls.append(btnInfo, btnStart, btnPause, btnKill);
        li.append(label, controls);
        list.appendChild(li);
      });
    }

    function filterServices() {
      const searchTerm = searchInput.value.toLowerCase();
      const statusValue = statusFilter.value;

      const filtered = services.filter(service => {
        const matchesName = service.name.toLowerCase().includes(searchTerm);
        const matchesStatus = (statusValue === 'all') || (service.status === statusValue);
        return matchesName && matchesStatus;
      });

      renderList(filtered);
    }

    // Initial
    renderList(services);

    // Events
    searchInput.addEventListener('input', filterServices);
    statusFilter.addEventListener('change', filterServices);

  } catch (e) {
    console.error('Erreur chargement services:', e);
  }
});
