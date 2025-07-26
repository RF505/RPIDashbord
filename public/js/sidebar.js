document.addEventListener('DOMContentLoaded', () => {
  const tempElem = document.getElementById('temp-value');
  const cpuElem = document.getElementById('cpu-load');
  const servicesElem = document.getElementById('services-running');

  async function updateSidebar() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();

      tempElem.textContent = `${data.temperature.toFixed(1)}°C`;
      cpuElem.textContent = `CPU ${data.cpuLoad}% / RAM ${data.ramLoad}%`;
      servicesElem.textContent = data.servicesRunning;
    } catch (e) {
      console.error('Erreur fetch sidebar data:', e);
    }
  }

  updateSidebar();
  setInterval(updateSidebar, 10000);
});
