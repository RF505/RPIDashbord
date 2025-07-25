const express = require('express');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const app = express();
const port = 3000;

// Fonction pour récupérer RAM utilisée
function getRamUsage() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return { used: Math.round((used / total) * 100), free: Math.round((free / total) * 100) };
}

// Fonction uptime formatée
function getUptime() {
  const seconds = os.uptime();
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}j ${hours}h ${minutes}m`;
}

// Services actifs via systemctl (Linux)
function getServicesActive() {
  return new Promise((resolve) => {
    exec('systemctl list-units --type=service --state=running | wc -l', (err, stdout) => {
      if (err) return resolve(0);
      resolve(parseInt(stdout.trim(), 10));
    });
  });
}

// SSH stats mock (à remplacer par vrai parsing)
function getSshStats() {
  return new Promise((resolve) => {
    resolve({
      attempts: Array(24).fill(0).map(() => Math.floor(Math.random() * 5)),
      success: Array(24).fill(0).map(() => Math.floor(Math.random() * 5)),
    });
  });
}

// Bande passante mock
function getBandwidth() {
  return new Promise((resolve) => {
    resolve(Array(24).fill(0).map(() => Math.floor(Math.random() * 100)));
  });
}

// API Dashboard
app.get('/api/dashboard', async (req, res) => {
  const ram = getRamUsage();
  const uptime = getUptime();
  const servicesActive = await getServicesActive();
  const ssh = await getSshStats();
  const bandwidth = await getBandwidth();

  res.json({ ram, uptime, servicesActive, ssh, bandwidth });
});

// Servir tous les fichiers statiques (html, js, css, partials, etc.)
app.use(express.static(path.join(__dirname)));

// Route racine -> dashboard.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`);
});
