# Anleitung: Globales Leaderboard mit Firebase einrichten

Um ein echtes, weltweites Leaderboard für deine Freunde zu haben, nutzen wir **Firebase Firestore** (ein kostenloser Dienst von Google). Das ist "relativ einfach", da du nur ein Projekt anlegen und die Zugangsdaten kopieren musst.

## Schritt 1: Firebase Projekt erstellen
1.  Gehe auf [console.firebase.google.com](https://console.firebase.google.com/).
2.  Logge dich mit deinem Google-Account ein.
3.  Klicke auf **"Projekt hinzufügen"**.
4.  Gib dem Projekt einen Namen (z.B. "NeonSurvivor-Leaderboard").
5.  Google Analytics kannst du deaktivieren (vereinfacht den Datenschutz).
6.  Klicke auf **"Projekt erstellen"**.

## Schritt 2: Datenbank (Firestore) erstellen
1.  Wähle im Menü links **"Erstellen"** -> **"Firestore Database"**.
2.  Klicke auf **"Datenbank erstellen"**.
3.  Wähle bei den Sicherheitsregeln **"Im Testmodus starten"** (Das erlaubt erstmal jedem das Schreiben, wir sichern das später ab).
4.  Wähle einen Server-Standort (z.B. `eur3` für Europa/West).
5.  Klicke auf **"Aktivieren"**.

## Schritt 3: App registrieren & Zugangsdaten holen
1.  Klicke auf das **Zahnrad-Symbol** (Projektübersicht) oben links -> **"Projekteinstellungen"**.
2.  Scrolle nach unten zu "Deine Apps" und klicke auf das **Web-Symbol `</>`**.
3.  Gib einen Namen ein (z.B. "Neon Game") und klicke auf **"App registrieren"**.
4.  Nun wird dir ein Code-Block angezeigt ("firebaseConfig").
5.  Kopiere **nur den Teil zwischen den geschweiften Klammern `{ ... }`**, also API Key, AuthDomain, etc.

## Schritt 4: Code aktualisieren
1.  Öffne die Datei `index.html` in deinem Code-Editor.
2.  Suche nach dem Bereich `// --- KONFIGURATION: HIER FIREBASE DATEN EINFÜGEN ---`.
3.  Ersetze die Platzhalter in `firebaseConfig` mit deinen echten Daten aus Schritt 3.
4.  Setze `const MOCK_MODE = false;` (von `true` auf `false` ändern).

## Schritt 5: Sicherheitsregeln (Optional, aber empfohlen)
Im "Testmodus" kann theoretisch jeder Nutzer deine Datenbank löschen, wenn er hackt. Für ein einfaches Spiel mit Freunden ist das oft okay, aber besser ist folgende Regel:

1.  Gehe in der Firebase Console auf **Firestore Database** -> Reiter **"Regeln"**.
2.  Ersetze den Code durch:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leaderboard/{document=**} {
      // Jeder darf lesen
      allow read: if true;
      // Jeder darf schreiben, aber nur wenn "score" eine Zahl ist und Name nicht zu lang
      allow create: if request.resource.data.score is number 
                    && request.resource.data.name is string
                    && request.resource.data.name.size() < 20;
    }
  }
}
```
3.  Klicke auf **"Veröffentlichen"**.

**Fertig!** Wenn du das Spiel jetzt deployst, werden alle Scores in dieser zentralen Datenbank gespeichert und sind für alle Spieler sichtbar.
