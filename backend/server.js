const express = require('express');
const path = require('path');
const si = require('systeminformation');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Serve statics
app.use(express.static(path.join(__dirname, '../public')));

// Dashboard API
app.get('/api/dashboard', async (req, res) => {
  try {
    const mem = await si.mem();
    const uptimeSec = si.time().uptime;
    const processes = await si.processes();
    const netStats = await si.networkStats();
    const sshStats = parseSSHLog();

    res.json({
      ram: {
        used: Math.round((mem.active / mem.total) * 100),
        free: Math.round((mem.available / mem.total) * 100)
      },
      bandwidth: generateHourlyData(netStats[0]?.tx_sec || 0),
      ssh: sshStats,
      servicesActive: processes.running,
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

function generateHourlyData(baseRate) {
  return Array(24).fill().map(() => Math.round(baseRate * (Math.random() + 0.5)));
}

function parseSSHLog() {
  const logPath = '/var/log/auth.log';
  let attempts = Array(24).fill(0);
  let success = Array(24).fill(0);

  try {
    const log = fs.readFileSync(logPath, 'utf-8');
    const lines = log.split('\n');
    const now = new Date();

    lines.forEach(line => {
      const dateMatch = line.match(/^\w+\s+\d+\s+(\d+):/);
      if (!dateMatch) return;
      const hour = parseInt(dateMatch[1]);

      if (/sshd/.test(line)) {
        if (/Failed password/.test(line)) {
          attempts[hour]++;
        } else if (/Accepted password/.test(line)) {
          success[hour]++;
        }
      }
    });
  } catch (e) {
    console.error("Erreur lecture auth.log (besoin sudo ?)", e.message);
  }

  return { attempts, success };
}

app.listen(PORT, () => {
  console.log(`🌐 Dashboard disponible sur http://localhost:${PORT}`);
});
