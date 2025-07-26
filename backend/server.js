const express = require('express');
const path = require('path');
const si = require('systeminformation');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;

let lastRxBytes = 0;
let lastTxBytes = 0;
let lastCheckTime = Date.now();
let bandwidthHistoryTx = Array(24).fill(0);
let bandwidthHistoryRx = Array(24).fill(0);
let bandwidthIndex = 0;

async function updateBandwidthHistory() {
  try {
    const netStats = await si.networkStats();
//    console.log('networkStats:', netStats);

    const iface = netStats.find(i => i.iface === 'eth0') || netStats.find(i => i.iface === 'wlan0') || netStats[0];
//    console.log('Interface choisie:', iface);

    if (!iface) return;

    const now = Date.now();
    const deltaTime = (now - lastCheckTime) / 1000; // secondes

    if (lastRxBytes === 0 && lastTxBytes === 0) {
      // Première mesure : on initialise juste
      lastRxBytes = iface.rx_bytes;
      lastTxBytes = iface.tx_bytes;
      lastCheckTime = now;
      return;
    }

    const rxDiff = iface.rx_bytes - lastRxBytes;
    const txDiff = iface.tx_bytes - lastTxBytes;

    if (rxDiff < 0 || txDiff < 0) {
      // Si compteur a reset, on réinitialise sans stocker
      lastRxBytes = iface.rx_bytes;
      lastTxBytes = iface.tx_bytes;
      lastCheckTime = now;
      return;
    }

    const rxPerSec = rxDiff / deltaTime;
    const txPerSec = txDiff / deltaTime;

//    console.log(`Calcul RX: ${rxDiff} octets en ${deltaTime}s => ${rxPerSec} B/s`);
//    console.log(`Calcul TX: ${txDiff} octets en ${deltaTime}s => ${txPerSec} B/s`);

    bandwidthHistoryRx[bandwidthIndex] = rxPerSec;
    bandwidthHistoryTx[bandwidthIndex] = txPerSec;

    bandwidthIndex = (bandwidthIndex + 1) % 24;

    lastRxBytes = iface.rx_bytes;
    lastTxBytes = iface.tx_bytes;
    lastCheckTime = now;

    console.log(`Bande passante (eth0) - RX: ${rxPerSec.toFixed(2)} B/s, TX: ${txPerSec.toFixed(2)} B/s`);
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
    const logs = execSync('journalctl -u ssh --since "24 hours ago" --no-pager', { encoding: 'utf-8' });
    const lines = logs.split('\n');

    lines.forEach(line => {
      const dateMatch = line.match(/^\w+\s+\d+\s+(\d+):/);
      if (!dateMatch) return;
      const hour = parseInt(dateMatch[1], 10);

      if (/Failed password/.test(line)) {
        attempts[hour]++;
      } else if (/session opened for user/i.test(line)) {
        success[hour]++;
      }
    });
  } catch (e) {
    console.error('Erreur lecture journalctl SSH:', e.message);
  }

  return { attempts, success };
}

function getActiveServices() {
  try {
    const count = execSync('systemctl list-units --type=service --state=running --no-pager --no-legend', { encoding: 'utf-8' });
    const value = parseInt(count.trim(), 10);
    console.log('Services actifs (comptés via wc -l):', value);
    return value;
  } catch (e) {
    console.error('Erreur lecture services actifs:', e.message);
    return 0;
  }
}



app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard disponible sur http://0.0.0.0:${PORT}`);
});
