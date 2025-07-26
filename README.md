# 📊 RPI Dashboard

Un tableau de bord web pour Raspberry Pi, inspiré de [Pi-hole](https://pi-hole.net/), conçu pour surveiller en temps réel l’état de la machine.

## 🚀 Fonctionnalités

- 🌡️ **Température du système**
- 🧠 **Utilisation CPU & RAM**
- 🔐 **Connexions SSH** :
  - Fréquence des connexions
  - Nombre de connexions réussies et échouées
- 🧩 **Services** :
  - Nombre de services actifs/inactifs
  - Contrôle des services (start/stop/restart)
- ⏱️ **Uptime** 
- 📶 **Surveillance de la bande passante** (upload/download)

---

## 📂 Structure

Le dashboard est conçu pour être léger, épuré et accessible depuis n’importe quel navigateur connecté au réseau local (ou non).

---

## 📚 Documentation

Voici quelques commandes systèmes importantes utilisées ou suggérées (ceci est un exemple) :

| Commande                          | Description                                      |
|----------------------------------|--------------------------------------------------|
| `top`                            | Voir l’utilisation du CPU et de la mémoire      |
| `systemctl status ssh`           | Statut du service SSH                           |
| `df -h`                           | Espace disque disponible (format lisible)       |
| `uptime`                         | Durée d’allumage de la machine                  |
| `free -h`                        | RAM utilisée et disponible                      |
| `ip -c a`                        | Adresse IP de la machine                        |

---

## 🔧 Dépendances

> *(à compléter selon ton stack : Express.js, Node.js, systeminformation, etc.)*

- Node.js
- systeminformation
- express
- socket.io (si tu utilises du temps réel)

---
