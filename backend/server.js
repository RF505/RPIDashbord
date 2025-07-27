const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const si = require('systeminformation');
const { execSync, exec } = require('child_process');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware JSON + URL Encoded
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: 'pi_dashboard_secret', // change pour un secret fort en prod !
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // false si pas HTTPS
}));

// Utilisateurs (login simple)
const USERS = {
  'a': 'a'
};

// Middleware protection des routes
function requireLogin(req, res, next) {
  if (!req.session.user) {
    console.log('Accès non autorisé, redirection vers login');
    return res.redirect('/login.html');
  }
  next();
}

// Static files (ex: login.html)
app.use(express.static(path.join(__dirname, '../public'), {
  extensions: ['html'],
  index: false
}));

// Routes protégées
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

// Authentification POST
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

// Déconnexion
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// Démarrer serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Dashboard disponible sur http://0.0.0.0:${PORT}`);
});
