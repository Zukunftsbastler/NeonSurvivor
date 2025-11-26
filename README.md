# Neon Survivor

**Neon Survivor** ist ein "Bullet Hell Roguelite", inspiriert von Titeln wie "Death Must Die" und "Vampire Survivors". Entwickelt als Mobile-First Web-App, bietet es intensive Action, prozedurale Gegnerwellen und endlose Wiederspielbarkeit in einer stilvollen Neon-Ästhetik.

> *Erstellt komplett mit Gemini 3.0 Pro Vibe Coded mit einem einzigen Prompt.*

## 🌌 Narrative

In den Tiefen des digitalen Abgrunds, wo Datenströme zu tödlichen Neon-Konstrukten verschmelzen, bist du der letzte "Survivor". Gefangen in einer Endlosschleife aus Licht und Zerstörung, ist dein einziges Ziel: Überleben. Die Zeit ist dein Feind, und mit jeder Sekunde wächst der Widerstand des Systems. Wie lange kannst du dem unausweichlichen "Game Over" entkommen?

## 🎮 Gameplay

### Steuerung (Mobile First)
*   **Bewegung:** Virtueller Joystick (linke Bildschirmhälfte) steuert deinen Avatar.
*   **Kampf:** Auto-Fire System visiert automatisch den nächsten Gegner an.
*   **Dash:** Ein spezieller Button (rechte Seite) ermöglicht schnelles Ausweichen mit Cooldown.

### Kernmechaniken
*   **Time-Survival:** Die Schwierigkeit (Gegner-HP, Geschwindigkeit, Spawn-Rate) steigt exponentiell mit der Zeit.
*   **Roguelite-Progression:** Sammle XP-Orbs von besiegten Gegnern. Bei einem Level-Up wählst du aus zufälligen "Boon"-Karten mächtige Upgrades (z.B. Multishot, Speed-Boosts, Blitz-Schaden).
*   **Director System:** Ein dynamisches System im Hintergrund passt die Spawn-Rate basierend auf deiner Performance an, um den perfekten "Flow State" zu gewährleisten.

## 🛠️ Tech Stack & Code Übersicht

Das gesamte Spiel ist als **Single-Page Application (SPA)** in einer einzigen `index.html` Datei implementiert.

*   **Frontend:**
    *   **Vanilla JavaScript (ES6+):** Keine Frameworks, purer Code für maximale Performance.
    *   **HTML5 Canvas:** Für das Rendering der Spielwelt, Partikeleffekte und flüssige 60 FPS Animationen.
    *   **Tailwind CSS:** Für das UI-Overlay (HUD, Menüs, Karten).
*   **Backend / Daten:**
    *   **Mock-Backend:** Aktuell wird `localStorage` verwendet, um Highscores lokal zu speichern und ein Leaderboard zu simulieren. Der Code ist für eine einfache Integration von **Firebase Firestore** vorbereitet.
*   **Design:**
    *   Geometrische Formen mit Canvas-Glow-Effekten für hohe Lesbarkeit auf kleinen Screens.

### Code Struktur
Der Code in der `index.html` ist modular aufgebaut:
1.  **Game State Management:** Verwaltet Score, Zeit, Level und den Spielstatus (Start, Play, Pause, GameOver).
2.  **Entities (Klassen):** `Player`, `Enemy` (verschiedene Typen), `Bullet`, `Orb` (XP), `Particle`.
3.  **Game Loop:** Eine klassische `requestAnimationFrame` Schleife, die Update-Logik und Rendering trennt.
4.  **Input Handling:** Unterstützt sowohl Touch-Events (Multi-Touch für gleichzeitiges Bewegen & Dashen) als auch Maus/Tastatur (WASD + Space) für Desktop-Tests.
5.  **Director System:** Überwacht die "Kill-Rate" des Spielers und reguliert dynamisch das Spawning.

## 🚀 Deployment

Das Spiel ist so konzipiert, dass es sofort auf jedem statischen Webhost (GitHub Pages, Vercel, Netlify) läuft. Einfach die `index.html` öffnen oder hosten.

---
*Projekt erstellt für Testzwecke zur Demonstration von KI-gestützter Spielentwicklung.*
