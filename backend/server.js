const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const si = require('systeminformation');
const { execSync, exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'pi_dashboard_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Middleware de protection
function requireLogin(req, res, next) {
  console.log('Session user:', req.session.user);
  if (!req.session.user) return res.redirect('/login.html');
  next();
}

// Utilisateurs (modifie ici)
const USERS = {
  'a@gmail.com': 'a'
};

let bandwidthSamplesTx = Array.from({ length: 24 }, () => []);
let bandwidthSamplesRx = Array.from({ length: 24 }, () => []);
let lastRx = 0;
let lastTx = 0;
let lastNetStatsTime = Date.now();

function updateBandwidthHistory() {
  try {
    const stats = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = stats.split('\n');
    const nowDate = new Date();
    if (nowDate.getHours() === 0 && nowDate.getMinutes() === 0) {
      bandwidthSamplesTx = Array.from({ length: 24 }, () => []);
      bandwidthSamplesRx = Array.from({ length: 24 }, () => []);
    }
    let rx = 0;
    let tx = 0;

    lines.forEach(line => {
      if (line.includes(':')) {
        const [iface, data] = line.trim().split(':');
        if (!iface.startsWith('lo')) {
          const fields = data.trim().split(/\s+/);
          rx += parseInt(fields[0]);
          tx += parseInt(fields[8]);
        }
      }
    });

    const nowTs = Date.now();
    const deltaTime = (nowTs - lastNetStatsTime) / 1000;
    if (deltaTime === 0) return;

    const rxPerSec = (rx - lastRx) / deltaTime;
    const txPerSec = (tx - lastTx) / deltaTime;

    if (rxPerSec < 0 || txPerSec < 0) {
      lastRx = rx;
      lastTx = tx;
      lastNetStatsTime = nowTs;
      return;
    }

    const currentHour = nowDate.getHours();
    bandwidthSamplesRx[currentHour] = [];
    bandwidthSamplesTx[currentHour] = [];

    bandwidthSamplesRx[currentHour].push(rxPerSec);
    bandwidthSamplesTx[currentHour].push(txPerSec);

    lastRx = rx;
    lastTx = tx;
    lastNetStatsTime = nowTs;
  } catch (e) {
    console.error('Erreur lecture bande passante :', e.message);
  }
}

setInterval(updateBandwidthHistory, 60 * 1000);
updateBandwidthHistory();

async function getRaspberryPiTemperature() {
  const tempData = await si.cpuTemperature();
  return tempData.main || 0;
}

async function getCpuLoad() {
  const load = await si.currentLoad();
  return load.currentLoad;
}

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

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}j ${h}h ${m}m`;
}

function parseSSHJournal() {
  const attempts = Array(24).fill(0);
  const success = Array(24).fill(0);

  try {
    const logs = execSync(`journalctl -u ssh --since "24 hours ago" --no-pager`, { encoding: 'utf-8' });
    const lines = logs.split('\n');

    lines.forEach(line => {
      const dateMatch = line.match(/^\w+\s+\d+\s+(\d+):(\d+):/);
      if (!dateMatch) return;

      const hour = parseInt(dateMatch[1], 10);
      if (isNaN(hour) || hour < 0 || hour > 23) return;

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



app.get('/', requireLogin, (req, res) => {
  res.redirect('/dashboard.html');
});

app.get('/dashboard.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

app.get('/services.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/services.html'));
});

app.get('/settings.html', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/settings.html'));
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  console.log(`Tentative login: ${email}`);

  if (USERS[email] && USERS[email] === password) {
    req.session.user = email;
    console.log(`Utilisateur ${email} connecté`);
    return res.redirect('/dashboard.html');
  }

  console.log('Login échoué');
  res.status(401).send('Email ou mot de passe incorrect.');
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Erreur destruction session:', err);
      return res.status(500).send('Erreur lors de la déconnexion');
    }
    res.clearCookie('connect.sid', { path: '/' });
    res.redirect('/login.html');
  });
});

// Place express.static **ici, après les routes dynamiques**
app.use(express.static(path.join(__dirname, '../public'), {
  extensions: ['html'],
  index: false
}));


const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

app.get('/api/dashboard', requireLogin, async (req, res) => {
console.log('Requête reçue sur /api/dashboard');

  try {
    const mem = await si.mem();
    const uptimeSec = si.time().uptime;
    const sshStats = parseSSHJournal();
    const servicesActive = getActiveServices();
    console.log({ ram, uptime, servicesActive, sshStats });

    res.json({
      ram: {
        used: Math.round((mem.active / mem.total) * 100),
        free: Math.round((mem.available / mem.total) * 100)
      },
      bandwidth: {
        tx: bandwidthSamplesTx.map(avg),
        rx: bandwidthSamplesRx.map(avg)
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

app.post('/api/service/:action', requireLogin, (req, res) => {
  let action = req.params.action.toLowerCase();
  const { service } = req.body;

  if (!service) return res.status(400).send('Nom du service requis');
  if (!/^[\w@.\-]+$/.test(service)) return res.status(400).send('Nom de service invalide');
  if (action === 'pause') action = 'stop';
  if (!['start', 'stop', 'kill'].includes(action)) return res.status(400).send('Action non autorisée');

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
