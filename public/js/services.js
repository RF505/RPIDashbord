document.addEventListener('DOMContentLoaded', async () => {
  const list = document.querySelector('ul#services-list');

  try {
    const res = await fetch('/api/services');
    const services = await res.json();

    services.forEach(service => {
      const li = document.createElement('li');
      li.className = "flex justify-between items-center bg-gray-700 p-4 rounded";

      const label = document.createElement('span');
      label.className = "text-lg";
      label.textContent = `${service.name} (${service.status})`;

      const controls = document.createElement('div');
      controls.className = "space-x-2";

      const btnStart = document.createElement('button');
      btnStart.textContent = 'Start';
      btnStart.className = 'bg-green-600 hover:bg-green-700 text-sm px-3 py-1 rounded';

      const btnPause = document.createElement('button');
      btnPause.textContent = 'Pause';
      btnPause.className = 'bg-yellow-500 hover:bg-yellow-600 text-sm px-3 py-1 rounded';

      const btnKill = document.createElement('button');
      btnKill.textContent = 'Kill';
      btnKill.className = 'bg-red-600 hover:bg-red-700 text-sm px-3 py-1 rounded';

      controls.append(btnStart, btnPause, btnKill);
      li.append(label, controls);
      list.appendChild(li);
    });
  } catch (e) {
    console.error('Erreur chargement services:', e);
  }
});
