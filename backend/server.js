const express = require('express');
const session = require('express-session');
const path = require('path');
const si = require('systeminformation');
const { execSync, exec } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 
app.use(session({
  secret: 'mon_super_secret', // A DEGAGER
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

// Middleware auth
function requireLogin(req, res, next) {
  if (req.session && req.session.loggedIn) {
    next();
  } else {
    res.redirect('/login.html');
  }
}

// Historique bande passante
// Variables globales pour la bande passante
let lastRxBytes = 0;
let lastTxBytes = 0;
let lastCheckTime = Date.now();

const perHourBuckets = {}; // { '16': [val1, val2, ...] }
let hourlyAveragesRx = Array(24).fill(0);
let hourlyAveragesTx = Array(24).fill(0);

function getCurrentHour() {
  return new Date().getHours();
}

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
    const hour = getCurrentHour();

    if (!perHourBuckets[hour]) perHourBuckets[hour] = { rx: [], tx: [] };
    perHourBuckets[hour].rx.push(rxPerSec);
    perHourBuckets[hour].tx.push(txPerSec);

    // ➕ Ajout IMMÉDIAT dans les moyennes pour affichage en direct
    const avgRxCurrent = perHourBuckets[hour].rx.reduce((a, b) => a + b) / perHourBuckets[hour].rx.length;
    const avgTxCurrent = perHourBuckets[hour].tx.reduce((a, b) => a + b) / perHourBuckets[hour].tx.length;

    hourlyAveragesRx[hour] = avgRxCurrent;
    hourlyAveragesTx[hour] = avgTxCurrent;

    // ➡️ Passage à l’heure suivante = archive l’heure précédente
    const previousHour = (hour + 23) % 24;
    if (perHourBuckets[previousHour] && perHourBuckets[previousHour].rx.length > 0) {
      const avgRx = perHourBuckets[previousHour].rx.reduce((a, b) => a + b) / perHourBuckets[previousHour].rx.length;
      const avgTx = perHourBuckets[previousHour].tx.reduce((a, b) => a + b) / perHourBuckets[previousHour].tx.length;

      hourlyAveragesRx[previousHour] = avgRx;
      hourlyAveragesTx[previousHour] = avgTx;

      delete perHourBuckets[previousHour];
    }

    lastRxBytes = iface.rx_bytes;
    lastTxBytes = iface.tx_bytes;
    lastCheckTime = now;

    console.log(`[${hour}h] RX: ${rxPerSec.toFixed(2)} B/s, TX: ${txPerSec.toFixed(2)} B/s`);

  } catch (e) {
    console.error('Erreur update bandwidth:', e.message);
  }
}


// Chaque 5 minutes
setInterval(updateBandwidthHistory, 5 * 60 * 1000);
updateBandwidthHistory();


// RPI Temp
async function getRaspberryPiTemperature() {
  const tempData = await si.cpuTemperature();
  return tempData.main || 0;
}

// CPU Load
async function getCpuLoad() {
  const load = await si.currentLoad();
  return load.currentLoad;
}

async function getRamLoad() {
  const mem = await si.mem();
  return Math.round((mem.active / mem.total) * 100);
}

// Services
function getServicesList() {
  return new Promise((resolve, reject) => {
    exec('systemctl list-units --type=service --all --no-pager --no-legend', (err, stdout) => {
      if (err) return reject(err);
      const services = stdout.trim().split('\n').map(line => {
        const parts = line.trim().split(/\s+/);
        return { name: parts[0], status: parts[3] };
      });
      resolve(services);
    });
  });
}

app.use(express.static(path.join(__dirname, '../public')));

// --- Authentification ---
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'a@gmail.com' && password === 'a') {
    req.session.loggedIn = true;
    res.redirect('/');
  } else {
    res.status(401).send('Identifiants incorrects');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Erreur lors de la déconnexion:', err);
      return res.redirect('/dashboard.html');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login.html');
  });
});

// --- Pages protégées ---
app.get('/', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/api/dashboard', requireLogin, async (req, res) => {
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
        tx: [...hourlyAveragesTx],
        rx: [...hourlyAveragesRx]
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

app.get('/api/services', requireLogin, (req, res) => {
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

app.get('/api/stats', requireLogin, async (req, res) => {
  try {
    const temp = await getRaspberryPiTemperature();
    const cpuLoad = await getCpuLoad();
    const mem = await si.mem();
    const services = await getServicesList();

    res.json({
      temperature: temp,
      cpuLoad: Math.round(cpuLoad),
      ramLoad: Math.round((mem.active / mem.total) * 100),
      servicesRunning: services.filter(s => s.status === 'running').length
    });
  } catch (err) {
    res.status(500).send('Erreur serveur');
  }
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

// --- Commande services ---
function validateAction(action) {
  return ['start', 'stop', 'kill'].includes(action);
}

function validateServiceName(service) {
  return /^[\w@.\-]+$/.test(service);
}

app.post('/api/service/:action', requireLogin, (req, res) => {
  let action = req.params.action.toLowerCase();
  const { service } = req.body;

  if (!service) return res.status(400).send('Nom du service requis');
  if (!validateServiceName(service)) return res.status(400).send('Nom de service invalide');
  if (action === 'pause') action = 'stop';
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
