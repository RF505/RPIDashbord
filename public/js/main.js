async function fetchDashboardData() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('Erreur API');
  return await res.json();
}

function createRamChart(data) {
  return new Chart(document.getElementById('ramChart'), {
    type: 'doughnut',
    data: {
      labels: ['Utilisée', 'Libre'],
      datasets: [{
        data: [data.used, data.free],
        backgroundColor: ['#a855f7', '#4ade80']
      }]
    },
    options: {
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#e5e7eb',
            font: { size: 14, weight: 'bold' }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

function createBandwidthChart(txData, rxData) {
    const txKB = txData.map(bps => (bps / 1024).toFixed(2));
    const rxKB = rxData.map(bps => (bps / 1024).toFixed(2));


  return new Chart(document.getElementById('bandwidthChart'), {
    type: 'line',
    data: {
      labels: [...Array(24).keys()].map(h => h + ":00"),
      datasets: [
        {
          label: 'TX kB/s',
          data: txMB,
          backgroundColor: 'rgba(34,197,94,0.2)',
          borderColor: '#22c55e',
          tension: 0.3,
          fill: true
        },
        {
          label: 'RX kB/s',
          data: rxMB,
          backgroundColor: 'rgba(59,130,246,0.2)',
          borderColor: '#3b82f6',
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      scales: { y: { beginAtZero: true } }
    }
  });
}



function createSshChart(data) {
  return new Chart(document.getElementById('sshChart'), {
    type: 'bar',
    data: {
      labels: [...Array(24).keys()].map(h => h + ":00"),
      datasets: [
        {
          label: 'Tentatives',
          data: data.attempts,
          backgroundColor: '#f59e0b'
        },
        {
          label: 'Réussies',
          data: data.success,
          backgroundColor: '#3b82f6'
        }
      ]
    },
    options: {
      scales: { y: { beginAtZero: true } },
      responsive: true
    }
  });
}

async function initDashboard() {
  try {
    const data = await fetchDashboardData();

    document.querySelector('.services-actifs').textContent = data.servicesActive;
    document.querySelector('.uptime').textContent = data.uptime;

    createRamChart(data.ram);
    createBandwidthChart(data.bandwidth.tx, data.bandwidth.rx);
    createSshChart(data.ssh);
  } catch (e) {
    console.error('Erreur Dashboard:', e);
  }
}


document.addEventListener('DOMContentLoaded', initDashboard);
