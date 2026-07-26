# Seegang

Ein Roguelite auf einem Radarschirm. Du bist ein Signal auf dem Schirm der
Hafenwache, fremde Kontakte laufen auf, und die Bordsysteme feuern selbsttätig
auf das nächste Ziel. Deine Aufgabe ist die Fahrt: ausweichen, positionieren,
und bei jeder Stufe entscheiden, womit du weitermachst.

Mobile first — die Steuerung ist für einen Daumen links und einen rechts
gebaut, Tastatur ist der Zweitweg.

## Spielen

```bash
npm install
npm run dev      # Entwicklungsserver, im Netz erreichbar unter der angezeigten IP
npm run build    # Produktionsbündel nach dist/
npm run preview  # gebautes Bündel lokal prüfen
```

Der Dev-Server bindet auf alle Schnittstellen (`host: true`), damit man auf dem
Telefon im selben WLAN testen kann — dafür ist das Spiel schließlich gebaut.

## Steuerung

| | Touch | Tastatur |
|---|---|---|
| Fahrt | Daumen auf der linken Bildschirmhälfte | `WASD` / Pfeiltasten |
| Notmanöver | Taste unten rechts | `Leertaste` |
| Pause | Taste oben Mitte | `Esc` oder `P` |

## Kernmechaniken

**Signalgeber.** Bis zu drei Waffen gleichzeitig, jede mit eigener Feuerpause.
Jede hat genau eine exklusive Mechanik, die keine andere über Feuerrate
erreichen kann:

| Signalgeber | Eigenart |
|---|---|
| Taktgeber | jeder 5. Impuls durchschlägt und trifft dreifach |
| Brandungsfächer | dreifacher Schaden unter 150 px, dafür Rückstoß |
| Peilstrahl | lädt auf, solange du **stillstehst** — bis vierfacher Schaden |
| Störsender | hohe, gleichmäßige Schlagzahl ohne Sonderregel |
| Echolot | Projektile kehren um und treffen auf dem Rückweg erneut |

**Statuseffekte und Synergien.** Vereisung, Korrosion, Grundmine und Bergung
wirken über den Zustand des Ziels, nicht über die Waffe — deshalb lohnt es
sich, zwei Signalgeber zu kombinieren:

- Vereisung + Grundmine → gefrorene Kontakte zersplittern (doppelter Flächenschaden)
- Korrosion + Grundmine → die Detonation reißt eine Korrosionswolke auf
- Bergung + Vereisung → dreifache Chance auf Rumpfreparatur

**Wagnisse.** Wird es zu ruhig, bietet das Spiel einen Handel an: mehr Gefahr
gegen mehr Ertrag, gültig für den Rest der Fahrt. Phasen der Übermacht bleiben
möglich — aber wer zu stark geworden ist, bekommt einen Grund, sich freiwillig
wieder in Gefahr zu bringen, und die Bestenliste belohnt es.

**Neuauswurf und Streichung.** Drei Neuauswürfe pro Fahrt, und Kartentypen
lassen sich dauerhaft aus dem Pool nehmen.

**Abschussfolge.** Der Punktefaktor wächst mit der Abschussrate und bricht bei
jedem Rumpftreffer auf 1 ein. Jede volle Stufe wird quittiert — mit Ring, Text
und einem Ton, der mit der Stufe steigt. Der Bestenlisteneintrag sagt damit
etwas über die Spielweise aus, nicht nur über Sitzfleisch.

## Rückmeldung und Ton

Das Spiel gibt sich Mühe, jeden Treffer als Ereignis lesbar zu machen:

- **Trefferstopp** — ein paar Bilder Stillstand bei schweren Einschlägen. Das mit
  Abstand wirksamste Mittel für Wucht.
- **Zeitlupe vor der Auswahl** — die Welt rollt über eine halbe Sekunde aus,
  statt hart anzuhalten.
- **Schockwellen, Kameraruckeln, Bildblitze**, gestaffelt nach Bedeutung: Ein
  gewöhnlicher Kontakt gibt einen Ring, ein Leitschiff hält kurz die Zeit an.
- **Signale auf gekrümmter Bahn** — aufgefasste Signale schwingen mit Schweif
  heran, und ein Funke trägt sie auf einem Bogen zur Erfahrungsleiste, die
  beim Ankommen aufblitzt.
- **Kartenwahl** — die gewählte Karte ploppt auf, die übrigen treten zurück.

**Der Ton ist vollständig generativ.** Keine Audiodateien, kein zusätzlicher
Abruf, keine Fremdquelle in der Content-Security-Policy: 21 Klänge aus
Oszillatoren, gefiltertem Rauschen und einer sparsamen Rückkopplungsverzögerung
als Raum ([`src/audio/`](src/audio/)). Der Radar-Sweep gibt mit einem Ping pro
Umlauf den Grundpuls, Signalaufnahmen steigen eine pentatonische Leiter hinauf,
und jeder Signalgeber hat seinen eigenen Anschlag.

Die Tonerzeugung startet erst bei der ersten Nutzergeste — an Zeigegerät,
Tastatur und Startknopf aufgehängt, damit auch reine Tastaturbedienung Ton bekommt.

## Einstellungen

Erreichbar auf dem Startbildschirm **und** in der Pause — also bevor der erste
Blitz ausgelöst hat. Einzeln abschaltbar und dauerhaft gespeichert:

| Schalter | Betrifft |
|---|---|
| Ton | alle Klänge |
| Bildruckeln | Kamerazittern bei Einschlägen |
| Blitze | bildschirmfüllende Aufheller |
| Trefferstopp | kurzes Anhalten der Zeit |
| Zeitlupe | Ausrollen vor Auswahlbildschirmen |
| Vibration | Haptik auf Geräten, die sie können |

Meldet das System `prefers-reduced-motion`, sind Ruckeln, Blitze und
Trefferstopp von vornherein aus. Bewegungsempfindlichkeit und Photosensibilität
sind echte Anforderungen, keine Kür.

## Technik

Kein Framework, keine Laufzeit-Abhängigkeiten im Browser. Das gebaute Bündel
liegt bei rund **60 kB JavaScript und 11 kB CSS** (22 kB / 3 kB gzip). Es wird
**nichts von fremden Servern nachgeladen** — keine Schriftarten, kein CDN.

- **Vite** als Bündler, mehrseitig (Spiel und Impressum)
- **Canvas 2D**, Leuchten über vorgerenderte Sprites statt `shadowBlur`
- **Web Audio**, vollständig synthetisiert — keine Audiodateien
- **ioredis** ausschließlich in den Netlify-Funktionen, nie im Browser

### Aufbau

```
src/
  main.js              Spielschleife und Ablaufsteuerung
  styles.css           gesamtes CSS
  config/              Balancing und Art Direction — hier wird geschraubt
    theme.js             Palette, Titel, Radar-Sweep
    rarities.js          Beaufort-Skala und Ziehgewichte
    weapons.js           Signalgeber, Traits, Statuseffekte, Synergien
    enemies.js           Kontakttypen, Verhalten, Skalierung
    upgrades.js          Karten und ihre Wirkung
    pacts.js             Wagnisse
  core/                world (Leinwand, Listen), state, clock, input, storage, settings
  entities/            player, enemy, bullet, orb, fx
  systems/             combat, director, spatial
  audio/               synth (Signalweg), sfx (benannte Klänge)
  render/              renderer (Radarschirm), glow (Sprite-Cache), juice (Wucht)
  ui/                  hud, cards, screens, settings-panel
netlify/functions/     save-scores, get-scores
```

Wer am Balancing dreht, kommt mit `src/config/` aus. Wer die Optik ändern will,
mit `src/config/theme.js` und `src/render/`.

### Zeitrechnung

Zwei getrennte Uhren:

- `clock.now` (`core/clock.js`) ist die **Spielzeit**. Sie steht bei Pause still
  und wird von der Slow-Motion-Rampe gedehnt. Alles, was Spielverhalten steuert
  — Feuerpausen, Cooldowns, Schutzfenster, Wellensteuerung — liest sie.
- `performance.now()` bleibt der Wanduhr vorbehalten, etwa der Fahrtdauer für
  die Bestenliste.

Sämtliche Bewegung skaliert mit der tatsächlich verstrichenen Zeit. Das Spiel
läuft auf 30, 60, 120 und 144 Hz gleich schnell — nachgemessen liegt die
Projektilstrecke über 30 bis 240 Hz innerhalb von 0,2 %.

## Deployment

Netlify, konfiguriert in `netlify.toml`:

- Build `npm run build`, Verzeichnis `dist`
- Funktionen aus `netlify/functions`
- Content-Security-Policy erlaubt ausschließlich eigene Quellen
- gehashte Assets dauerhaft im Cache, HTML nie

### Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `REDIS_URL` | Verbindung zur Bestenliste (Pflicht) |
| `RATE_SALT` | Salz für die IP-Hashes des Rate-Limits (empfohlen) |

Ohne `REDIS_URL` läuft das Spiel weiter; die Bestenliste bleibt dann leer und
Einträge werden mit einer Meldung abgelehnt. Lokal (`localhost` oder `file:`)
wird ohnehin nur im Browser gespeichert.

### Bestenliste

Der Eintrag ist **freiwillig** und geschieht erst auf ausdrückliche Aktion.
Serverseitig wird geprüft:

- Punktestand gegen die gemeldete Fahrtdauer plausibilisiert
- höchstens 10 Einträge pro Minute und IP (die IP wird nur als kurzlebiger
  Hash verwendet, nie gespeichert)
- die Liste wird auf 100 Einträge getrimmt

Ein reines Client-Spiel lässt sich nie vollständig gegen Manipulation sichern.
Die Prüfungen heben die Hürde deutlich, ohne gutes Spiel zu bestrafen.

## Rechtliches

`impressum.html` enthält Impressum und Datenschutzerklärung und beschreibt
genau das, was die Anwendung tatsächlich tut.

> **Offen:** Im Abschnitt zur Bestenliste steht ein markierter Kasten, in den
> der tatsächliche Redis-Anbieter samt Sitz und Serverstandort eingetragen
> werden muss. Das ist Pflichtangabe — bitte vor dem nächsten Deployment
> ausfüllen und den Kasten entfernen.

## Analyse

[`ANALYSE.md`](ANALYSE.md) dokumentiert die Bestandsaufnahme des Prototyps, aus
der dieser Umbau hervorgegangen ist — inklusive der Rechnungen zu Balancing und
Skalierung.

## Lizenz

Apache-Lizenz 2.0, siehe [`LICENSE`](LICENSE).
