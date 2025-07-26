document.addEventListener('DOMContentLoaded', async () => {
  const list = document.querySelector('ul#services-list');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');

  // Elements modal
  const modal = document.getElementById('action-modal');
  const modalMessage = document.getElementById('modal-message');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirm = document.getElementById('modal-confirm');

  let currentAction = null;
  let currentService = null;

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

        // Boutons
        const btnInfo = document.createElement('button');
        btnInfo.textContent = 'Information';
        btnInfo.title = service.description || "Aucune description disponible";
        btnInfo.className = 'bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1 rounded';

        btnInfo.addEventListener('click', () => {
        infoModalTitle.textContent = service.name;
        infoModalContent.textContent = service.description || "Aucune description disponible";
        infoModal.classList.remove('hidden');
      });
      
      infoModalClose.addEventListener('click', () => {
        infoModal.classList.add('hidden');
      });
        const btnStart = document.createElement('button');
        btnStart.textContent = 'Start';
        btnStart.className = 'bg-green-600 hover:bg-green-700 text-sm px-3 py-1 rounded';

        const btnPause = document.createElement('button');
        btnPause.textContent = 'Pause';
        btnPause.className = 'bg-yellow-500 hover:bg-yellow-600 text-sm px-3 py-1 rounded';

        const btnKill = document.createElement('button');
        btnKill.textContent = 'Kill';
        btnKill.className = 'bg-red-600 hover:bg-red-700 text-sm px-3 py-1 rounded';

        // Ajout des listeners pour ouvrir la modale avec message personnalisé
        btnStart.addEventListener('click', () => openModal('start', service.name));
        btnPause.addEventListener('click', () => openModal('pause', service.name));
        btnKill.addEventListener('click', () => openModal('kill', service.name));

        controls.append(btnInfo, btnStart, btnPause, btnKill);
        li.append(label, controls);
        list.appendChild(li);
      });
    }

    function openModal(action, serviceName) {
      currentAction = action;
      currentService = serviceName;
      modalMessage.textContent = `Voulez-vous vraiment ${action} le service "${serviceName}" ?`;
      modal.classList.remove('hidden');
    }

    function closeModal() {
      modal.classList.add('hidden');
      currentAction = null;
      currentService = null;
    }

    modalCancel.addEventListener('click', closeModal);

    modalConfirm.addEventListener('click', async () => {
      if (!currentAction || !currentService) return;

      // Envoi requête POST à ton API
      try {
        const response = await fetch(`/api/service/${currentAction}`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ service: currentService }),
        });

        if (!response.ok) {
          const error = await response.text();
          alert(`Erreur : ${error}`);
        } else {
          alert(`Service ${currentService} ${currentAction} commandé avec succès.`);
          // Optionnel : recharger la liste pour mettre à jour le status
          location.reload();
        }
      } catch (err) {
        alert(`Erreur réseau ou serveur : ${err.message}`);
      }

      closeModal();
    });

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

    renderList(services);

    searchInput.addEventListener('input', filterServices);
    statusFilter.addEventListener('change', filterServices);

  } catch (e) {
    console.error('Erreur chargement services:', e);
  }
});
