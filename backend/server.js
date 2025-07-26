const express = require('express');
const path = require('path');
const si = require('systeminformation');
const { execSync, exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(express.json()); // Pour parser le JSON du body

let lastRxBytes = 0;
let lastTxBytes = 0;
let lastCheckTime = Date.now();
let bandwidthHistoryTx = Array(24).fill(0);
let bandwidthHistoryRx = Array(24).fill(0);
let bandwidthIndex = 0;

async function updateBandwidthHistory() {
  try {
    const netStats = await si.networkStats();
    const iface = netStats.find(i => i.iface === 'eth0') || netStats.find(i => i.iface === 'wlan0') || netStats[0];
    if (!iface) return;

    const now = Date.now();
    const deltaTime = (now - lastCheckTime) / 1000;

    if (lastRxBytes === 0 && lastTxBytes === 0) {
      lastRxBytes = iface.rx_bytes;
      lastTxBytes = iface.tx_bytes;
      lastCheckTime = now;
      return;
    }

    const rxDiff = iface.rx_bytes - lastRxBytes;
    const txDiff = iface.tx_bytes - lastTxBytes;

    if (rxDiff < 0 || txDiff < 0) {
      lastRxBytes = iface.rx_bytes;
      lastTxBytes = iface.tx_bytes;
      lastCheckTime = now;
      return;
    }

    const rxPerSec = rxDiff / deltaTime;
    const txPerSec = txDiff / deltaTime;

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

setInterval(updateBandwidthHistory, 60 * 60 * 1000);
updateBandwidthHistory();

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const mem = await si.mem();
    const uptimeSec = si.time().uptime;
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
      servicesActive: servicesActive.length,
      uptime: formatUptime(uptimeSec)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/services', (req, res) => {
  exec('systemctl list-units --type=service --all --no-pager --no-legend', (err, stdout) => {
    if (err) return res.status(500).json({ error: 'Erreur récupération services' });

    const services = stdout.trim().split('\n').map(line => {
      const parts = line.trim().split(/\s+/);
      const name = parts[0];
      const status = parts[3];
      const description = parts.slice(4).join(' ');
      return { name, status, description };
    });

    res.json(services);
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}j ${h}h ${m}m`;
}

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
    const output = execSync('systemctl list-units --type=service --state=running --no-pager --no-legend', { encoding: 'utf-8' });
    const lines = output.trim().split('\n');

    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0],
        load: parts[1],
        active: parts[2],
        sub: parts[3]
      };
    });
  } catch (e) {
    console.error('Erreur lecture services actifs:', e.message);
    return [];
  }
}

// --- AJOUT DES ROUTES POUR START / PAUSE / KILL ---

// Helper pour valider action et nom de service
function validateAction(action) {
  return ['start', 'stop', 'kill'].includes(action);
}

function validateServiceName(service) {
  return /^[\w@.\-]+$/.test(service);
}

app.post('/api/service/:action', async (req, res) => {
  let action = req.params.action.toLowerCase();
  const { service } = req.body;

  if (!service) return res.status(400).send('Nom du service requis');
  if (!validateServiceName(service)) return res.status(400).send('Nom de service invalide');
  if (action === 'pause') action = 'stop'; // map pause => stop
  if (!validateAction(action)) return res.status(400).send('Action non autorisée');

  exec(`sudo systemctl ${action} ${service}`, (error, stdout, stderr) => {
    if (error) {
      console.error('Erreur commande systemctl:', stderr || error.message);
      return res.status(500).send(stderr || error.message);
    }
    res.status(200).send(`Service ${service} ${action} commandé avec succès.`);
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard disponible sur http://0.0.0.0:${PORT}`);
});
