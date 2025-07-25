const express = require('express');
const path = require('path');
const si = require('systeminformation');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

// Stockage pour la bande passante (tx/sec et rx/sec) sur 24 points (ex: chaque minute)
const bandwidthHistoryTx = Array(24).fill(0);
const bandwidthHistoryRx = Array(24).fill(0);
let bandwidthIndex = 0;

// Mise à jour régulière des stats réseau (toutes les minutes)
async function updateBandwidthHistory() {
  try {
    const netStats = await si.networkStats();
    if (netStats && netStats.length > 0) {
      bandwidthHistoryTx[bandwidthIndex] = netStats[0].tx_sec;
      bandwidthHistoryRx[bandwidthIndex] = netStats[0].rx_sec;
      bandwidthIndex = (bandwidthIndex + 1) % 24;
    }
  } catch (e) {
    console.error('Erreur update bandwidth:', e.message);
  }
}

// Lancer la mise à jour toutes les minutes
setInterval(updateBandwidthHistory, 60 * 1000);
updateBandwidthHistory(); // appel initial

// Serve statics
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Dashboard API
app.get('/api/dashboard', async (req, res) => {
  try {
    const mem = await si.mem();
    const uptimeSec = si.time().uptime;
    const processes = await si.processes();
    const sshStats = parseSSHJournal();
    const servicesActive = getActiveServices();

    res.json({
      ram: {
        used: Math.round((mem.active / mem.total) * 100),
        free: Math.round((mem.available / mem.total) * 100)
      },
      bandwidth: {
        tx: [...bandwidthHistoryTx],
        rx: [...bandwidthHistoryRx]
      },
      ssh: sshStats,
      servicesActive,
      uptime: formatUptime(uptimeSec)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}j ${h}h ${m}m`;
}

// Lecture des logs SSH avec journalctl (nécessite que l'utilisateur ait accès)
function parseSSHJournal() {
  let attempts = Array(24).fill(0);
  let success = Array(24).fill(0);

  try {
    const logs = execSync('journalctl -u ssh.service --since "24 hours ago" --no-pager', { encoding: 'utf-8' });
    const lines = logs.split('\n');
    lines.forEach(line => {
      const match = line.match(/\b(\d{2}):\d{2}:\d{2}\b/);
      if (!match) return;
      const hour = parseInt(match[1]);
      if (/Failed password/.test(line)) attempts[hour]++;
      else if (/Accepted password/.test(line)) success[hour]++;
    });
  } catch (e) {
    console.error('Erreur lecture journal SSH:', e.message);
  }

  return { attempts, success };
}

// Récupère le nombre de services actifs via systemctl
function getActiveServices() {
  try {
    // Liste des services actifs (running)
    const output = execSync('systemctl list-units --type=service --state=running --no-pager --no-legend', { encoding: 'utf-8' });
    // Compter le nombre de lignes non vides
    const services = output.split('\n').filter(line => line.trim() !== '');
    return services.length;
  } catch (e) {
    console.error('Erreur lecture services actifs:', e.message);
    return 0;
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard disponible sur http://0.0.0.0:${PORT}`);
});
