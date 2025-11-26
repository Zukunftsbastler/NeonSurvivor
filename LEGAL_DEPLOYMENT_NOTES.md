# Rechtliche Hinweise & Deployment Checkliste

*Hinweis: Ich bin eine KI und darf keine Rechtsberatung leisten. Die folgenden Informationen basieren auf gängigen Best Practices für Hobby-Entwickler in Deutschland.*

## 1. Impressumspflicht (Deutschland)

### Brauche ich ein Impressum?
In Deutschland gilt die Impressumspflicht nach § 5 TMG für "geschäftsmäßige" Telemedien.
*   **Rein privat:** Nur für Familie/Freunde (passwortgeschützt) -> Kein Impressum.
*   **Öffentlich:** Sobald die Seite öffentlich zugänglich ist und dauerhaft angelegt ist (was bei einem Spiel mit Leaderboard der Fall ist), gehen Gerichte oft von einer Geschäftsmäßigkeit aus, auch wenn keine Gewinnerzielungsabsicht besteht (z.B. "Werbung" für dich als Entwickler).
*   **Empfehlung:** Um Abmahnungen zu vermeiden, ist ein Impressum **dringend empfohlen**.

### Adresse & Privatsphäre
*   **Pflicht:** Es muss eine **ladungsfähige Anschrift** angegeben werden (Straße, Hausnummer, Ort). Ein Postfach reicht nicht.
*   **Problem:** Als Privatperson musst du deine private Wohnanschrift angeben.
*   **Lösungen ohne Privatadresse:**
    *   **Impressums-Service / Virtual Office:** Es gibt Anbieter (z.B. *Autorenservices*, *Postflex*, *Dropscan* etc.), die dir gegen eine monatliche Gebühr (ca. 5-15€) eine ladungsfähige Adresse zur Verfügung stellen, die Post scannen und weiterleiten. Das ist die sauberste Lösung, wenn du deine Privatadresse schützen willst.
    *   **c/o Adresse:** Falls du die Erlaubnis hast, die Adresse von Verwandten/Freunden zu nutzen (mit "c/o Dein Name").

## 2. Datenschutzerklärung (DSGVO / GDPR)

Da dein Spiel externe Dienste nutzt, ist eine Datenschutzerklärung **zwingend erforderlich**.

### Warum?
Sobald ein Nutzer deine Seite aufruft, wird seine IP-Adresse an folgende Dienste übertragen (die im Code eingebunden sind):
1.  **Netlify:** Speichert Server-Logs (Access Logs).
2.  **Google Fonts:** Lädt Schriftarten von Google-Servern.
3.  **Tailwind CSS (CDN):** Lädt Stylesheets von einem Content Delivery Network.
4.  **Firebase (Google):** Wird für das Leaderboard (Datenbank) benötigt.

### Was muss drinstehen?
*   Name und Kontakt des Verantwortlichen (Du).
*   Hinweis auf Server-Logfiles (Netlify).
*   Hinweis auf die Nutzung von Google Fonts & CDNs (Berechtigtes Interesse Art. 6 Abs. 1 lit. f DSGVO: Schnelle Ladezeiten).
*   Hinweis auf Firebase (Datenverarbeitung in den USA).
*   Rechte der Nutzer (Auskunft, Löschung, etc.).

*Tipp: Nutze kostenlose Datenschutz-Generatoren (z.B. von eRecht24 oder Dr. Schwenke) für "Private Webseiten" oder "Kleinunternehmer".*

## 3. Technische Deployment Checkliste (Netlify)

Das Deployment auf Netlify ist sehr einfach, aber hier sind ein paar Optimierungen:

1.  **Drag & Drop:** Du kannst den Ordner einfach in Netlify Drop ziehen.
2.  **Git Integration (Empfohlen):** Verbinde Netlify mit deinem GitHub Repo. So wird bei jedem `git push` automatisch neu deployed.
    *   *Build Command:* (Leer lassen für dieses Projekt)
    *   *Publish Directory:* `.` (oder leer lassen, da `index.html` im Root liegt)

### Wichtig für Single Page Apps (SPA)
Da alles in einer `index.html` liegt, brauchst du normalerweise keine speziellen Redirect-Regeln (`_redirects`), solange du keine Unterseiten via URL aufrufst (z.B. `dein-spiel.de/level1`).

### Cookie Banner?
Dein Spiel nutzt `localStorage` für Highscores.
*   Technisch notwendige Speicherungen erfordern meist keine aktive Einwilligung, nur eine Information.
*   Wenn du später *Google Analytics* oder *Firebase Analytics* einbaust, brauchst du zwingend einen Cookie-Banner (Consent Tool), bevor diese laden.

## Zusammenfassung für dich
1.  **Impressum:** Ja, empfohlen. Wenn Privatsphäre wichtig ist -> **Impressums-Service mieten**.
2.  **Datenschutz:** Ja, Pflicht. Erstelle eine Seite (z.B. `/datenschutz.html`) und verlinke sie im Startscreen.
3.  **Cookie Banner:** Vorerst wohl nicht nötig, solange du nur technisch notwendige Dinge (Highscore) speicherst.
