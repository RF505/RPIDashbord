async function updateSidebarStats() {
  try {
    const res = await fetch('/api/stats'); // À adapter selon ton API backend
    if (!res.ok) throw new Error('Erreur récupération stats');
    const data = await res.json();

    document.getElementById('temp-value').textContent = `${data.temperature.toFixed(1)}°C`;
    document.getElementById('cpu-load').textContent = data.cpuLoad.map(load => `${load}%`).join(' / ');
    document.getElementById('services-running').textContent = data.servicesRunning;
  } catch (error) {
    console.error('Erreur mise à jour sidebar stats:', error);
  }
}

// Mise à jour toutes les 10s
updateSidebarStats();
setInterval(updateSidebarStats, 10000);

console.log('Sidebar stats initialized');