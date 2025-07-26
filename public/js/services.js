document.addEventListener('DOMContentLoaded', async () => {
  const list = document.querySelector('ul#services-list');

  try {
    const res = await fetch('/api/services');
    const services = await res.json();

    services.forEach(service => {
      const li = document.createElement('li');
      li.className = "bg-gray-700 p-4 rounded flex flex-col space-y-2";

      // Ligne principale : nom + boutons
      const topRow = document.createElement('div');
      topRow.className = "flex justify-between items-center";

      // Label nom + statut
      const label = document.createElement('span');
      label.className = "text-lg font-semibold flex items-center gap-2";

      // Couleur de l’état
      let statusColor = "text-gray-400";
      if (service.status === "active") statusColor = "text-green-500";
      else if (service.status === "dead") statusColor = "text-red-500";

      const nameText = document.createElement('span');
      nameText.textContent = service.name;

      const statusText = document.createElement('span');
      statusText.textContent = `(${service.status})`;
      statusText.className = `${statusColor} font-normal`;

      label.append(nameText, statusText);

      // Bouton Information
      const btnInfo = document.createElement('button');
      btnInfo.textContent = 'Information';
      btnInfo.className = 'bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1 rounded';

      // Contrôles
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

      controls.append(btnInfo, btnStart, btnPause, btnKill);
      topRow.append(label, controls);
      li.appendChild(topRow);

      // Zone d'information (cachée)
      const description = document.createElement('div');
      description.className = 'text-sm italic hidden';
      description.textContent = `Informations supplémentaires sur le service ${service.name}...`;
      li.appendChild(description);

      // Toggle affichage
      btnInfo.addEventListener('click', () => {
        description.classList.toggle('hidden');
      });

      list.appendChild(li);
    });
  } catch (e) {
    console.error('Erreur chargement services:', e);
  }
});
