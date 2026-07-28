# Konzept: Ausbaustufe 2 — Vielfalt, Tiefe, Emergenz

Entwurf, Stand 2026-07-27 · Bezug: `main` @ `9cfaa86`

> **Status: umgesetzt.** Alle vier Stufen sind gebaut. Was die Messung am
> Entwurf geändert hat, steht unter [Was die Messung geändert hat](#was-die-messung-geändert-hat).

Dieses Dokument beschrieb die Erweiterung, bevor sie implementiert wurde.

**Deine sechs Anforderungen und wo sie beantwortet werden:**

| Wunsch | Antwort |
|---|---|
| Aktive Upgrades anzeigen (zugeklappt) | [Teil A — Bordbuch](#teil-a--das-bordbuch) |
| Mehr Upgrade-Arten fürs Überleben | [Teil C — Systeme](#teil-c--systeme) |
| ~10 gleichwertige Strategien | [Teil D — Kurse](#teil-d--die-kurse-strategien) |
| Emergenz durch Wechselwirkung | [Teil B — Wirkketten](#teil-b--wirkketten-der-motor-der-emergenz) |
| Gegner werden mit Standzeit gefährlicher | [Teil E — Gefechtserfahrung](#teil-e--gefechtserfahrung) |
| Mehr Gegner, Aussehen aus Eigenschaften | [Teil F — Merkmale](#teil-f--merkmale-form-folgt-funktion) |

---

## Kurzfassung

Der heutige Stand hat **8 Kartentypen**, die alle in dieselbe Zahl fließen: Schaden
pro Sekunde. Das ist besser als der Prototyp — aber es ist immer noch *eine* Achse
mit Verzierungen. Echte Emergenz entsteht nicht durch *mehr* Karten, sondern durch
**Karten, die aufeinander zeigen**.

Der Vorschlag ruht auf drei Bauteilen:

1. **Wirkketten** — jedes Schadensereignis trägt Marken (`druckwelle`, `kälte`,
   `zersetzung`, `geleit`, …). Verstärker wirken auf **Marken**, nicht auf
   einzelne Waffen. Ein „+40 % Druckwelle" hebt gleichzeitig die Grundmine, die
   Wasserbombe, die Schleppnetz-Nova und die Salven der Geleitboote. Das ist der
   Multiplikator, aus dem Vielfalt entsteht — ohne dass ich N×M Sonderfälle
   von Hand verdrahte.

2. **Systeme** — eigenständige Mechanismen (Lenzpumpe, Geleitboot, Minenleger,
   Wellenbrecher …), die man erwirbt und dann **ausbaut**. Sie feuern selbst und
   tragen Marken, hängen also automatisch an den Wirkketten.

3. **Kopplungen** — Regeln, die eine Marke in eine andere umleiten: *„Kälte-Treffer
   lösen eine kleine Druckwelle aus."* Sie sind die eigentlichen Emergenzerzeuger,
   weil sie aus zwei unabhängigen Zweigen einen dritten machen.

Dazu kommt gegnerseitig **Gefechtserfahrung**: Kontakte, die lange auf dem Schirm
bleiben, steigen in Stufen auf und werden sichtbar gefährlicher. Das erzeugt
Priorisierungsdruck und macht „alles einfach am Leben lassen" zur schlechtesten
Strategie.

**Ehrliche Einordnung vorweg:** „Zehn gleichwertige Strategien" ist ein Ziel, kein
Zustand, den man beim ersten Wurf trifft. Der Entwurf enthält deshalb einen
[Messaufbau](#teil-g--wie-wir-gleichwertig-überhaupt-prüfen), mit dem sich
Gleichwertigkeit nachrechnen statt behaupten lässt.

---

## Teil A — Das Bordbuch

Ein zugeklapptes Feld auf dem Ausrüstungsbildschirm, das den vollständigen
Fahrtstand zeigt. Auch auf dem Wagnis- und Pausenbildschirm erreichbar.

```
┌──────────────────────────────────────────────┐
│ ▸ BORDBUCH                    Stufe 14 · 3♻ │   ← zugeklappt
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ ▾ BORDBUCH                    Stufe 14 · 3♻ │
│                                              │
│ SIGNALGEBER                                  │
│  Peilstrahl (Vereisung)      Sturm           │
│  Echolot                     Frischer Wind   │
│  ─ Platz frei ─                              │
│                                              │
│ SYSTEME                                      │
│  Geleitboot            ●●●○○   3 Boote       │
│  Lenzpumpe             ●●○○○   1,4 Rumpf/s   │
│  Wasserbombe           ●○○○○   alle 38 s     │
│                                              │
│ VERSTÄRKUNG                                  │
│  Sendeleistung   +118 %   ████████░░         │
│  Kälte           +85 %    ██████░░░░         │
│  Geleit          +60 %    ████░░░░░░         │
│  Druckwelle      +15 %    █░░░░░░░░░         │
│                                              │
│ KOPPLUNGEN                                   │
│  ⚡ Eisbruch — gefrorene Ziele zersplittern  │
│                                              │
│ WAGNISSE                                     │
│  Volle Fahrt · Ballast über Bord             │
└──────────────────────────────────────────────┘
```

**Warum das mehr ist als Anzeige:** Sobald es Wirkketten gibt, muss der Spieler
sehen können, *welche Marken er verstärkt hat* — sonst kann er nicht erkennen,
dass die angebotene „Kühlanlage" seine drei Kältequellen gleichzeitig hebt. Das
Bordbuch ist die Voraussetzung dafür, dass Emergenz überhaupt *lesbar* wird.

**Mobil:** `<details>`-Element, standardmäßig zu. Der zugeklappte Kopf zeigt die
zwei wichtigsten Zahlen. Aufgeklappt scrollt das Feld innerhalb seiner eigenen
Höhe, damit die Karten darunter erreichbar bleiben.

**Zusätzlich:** Eine Karte, die eine bereits gehaltene Marke verstärkt, bekommt
im Kartentext eine Zeile *„wirkt auf 3 deiner Quellen"*. Das ist der billigste
denkbare Weg, Synergie sichtbar zu machen, ohne ein Handbuch zu schreiben.

---

## Teil B — Wirkketten: der Motor der Emergenz

### Marken

Jedes Schadens- oder Wirkereignis trägt ab jetzt eine oder mehrere Marken:

| Marke | Bedeutung | Heutige Quellen |
|---|---|---|
| `impuls` | direkter Projektiltreffer | alle Signalgeber |
| `druckwelle` | Flächenwirkung | Grundmine, Schleppnetz-Nova |
| `kälte` | verlangsamt, friert ein | Vereisung, Manöver-Durchfahrt |
| `zersetzung` | Schaden über Zeit | Korrosion |
| `manöver` | am Notmanöver hängend | Durchfahrt |
| `geleit` | autonome Einheiten | *(neu)* |
| `zone` | ortsfeste Dauerwirkung | Korrosionswolke |
| `signal` | Wirtschaft, XP, Aufnahme | Schleppnetz |
| `nahbereich` | unter 150 px | Brandungsfächer |
| `fernbereich` | über 400 px | Peilstrahl |
| `bergung` | Heilung, Lebensraub | Bergung |

### Verstärker wirken auf Marken

Statt „+15 % Schaden" heißt eine Karte künftig „**Sprengkopf** — +22 % Wirkung
auf Druckwelle". Sie hebt damit *alles*, was diese Marke trägt — auch Systeme,
die man erst später erwirbt. Das ist der Unterschied zwischen additivem Zuwachs
und einem Build, der sich rückwirkend verstärkt.

| Verstärker | Marke |
|---|---|
| Sendeleistung | `impuls` |
| Sprengkopf | `druckwelle` |
| Kühlanlage | `kälte` |
| Beizmittel | `zersetzung` |
| Geleitordnung | `geleit` |
| Revierkenntnis | `zone` |
| Rudergänger | `manöver` |
| Peilempfänger | `signal` |
| Enterhaken | `nahbereich` |
| Entfernungsmesser | `fernbereich` |
| Bergungsgeschirr | `bergung` |

### Kopplungen — hier entsteht das Unvorhergesehene

Kopplungen sind seltene Karten, die eine Marke in eine andere **umleiten**. Sie
sind der Grund, warum zwei Spieler mit denselben Karten unterschiedlich spielen.

| Kopplung | Regel |
|---|---|
| **Eisbruch** | Druckwelle gegen gefrorene Ziele wirkt doppelt *(existiert heute)* |
| **Schmauchspur** | Jede Druckwelle hinterlässt eine Zersetzungswolke |
| **Kielwasserdruck** | Jede Durchfahrt löst am Endpunkt eine Druckwelle aus |
| **Peilkopplung** | Jedes 10. aufgenommene Signal feuert eine Gratissalve |
| **Beizbeute** | Ziele, die an Zersetzung sterben, lassen doppelte Signale fallen |
| **Prisenkommando** | Bergungstreffer heilen auch die Geleitboote — und sie schlagen härter, solange sie unbeschädigt sind |
| **Untiefe** | Zonen verlangsamen zusätzlich (Marke `zone` erhält `kälte`) |
| **Frostbruch** | Kältetreffer auf ein bereits gefrorenes Ziel zersplittern es sofort |
| **Rückkopplung** | Fernbereichstreffer laden das Notmanöver auf |
| **Steuerbordfeuer** | Nahbereichstreffer verkürzen die Feuerpause aller Signalgeber |
| **Kettenschlag** | Druckwellen, die ≥3 Ziele fassen, lösen eine zweite, kleinere aus |
| **Signalpeilung** | Fassreichweite zählt zusätzlich als Zielerfassungsreichweite |

**Das ist der Kern des Vorschlags.** Zwölf Kopplungen über elf Marken erzeugen
mehr Kombinationen, als ich von Hand entwerfen könnte — und der Spieler entdeckt
sie, statt sie vorgesetzt zu bekommen.

### Karten-Angebot: gegen Verdünnung

Mit über 40 Kartentypen würde reine Zufallsziehung dazu führen, dass man seinen
Build nie ausbauen kann. Deshalb **drei Plätze mit unterschiedlicher Rolle**:

| Platz | Zieht aus |
|---|---|
| 1 — **Vertiefung** | nur, was du schon besitzt (System-Ausbau, passende Marke) |
| 2 — **Breite** | nur, was du noch nicht besitzt |
| 3 — **Frei** | alles, inkl. Kopplungen und Signalgeber |

Damit ist ein Build immer entwickelbar, und trotzdem kommt in jedem Level-Up
etwas Neues ins Bild. Neuauswurf und Streichung bleiben wie sie sind.

---

## Teil C — Systeme

Eigenständige Mechanismen. Man erwirbt sie einmal und baut sie danach in Stufen
aus (max. 5). Jedes trägt Marken und hängt damit automatisch an den Wirkketten.
**Höchstens 4 Systemplätze**, damit Entscheidungen weh tun.

### Überleben (dein ausdrücklicher Wunsch)

| System | Wirkung | Marken |
|---|---|---|
| **Lenzpumpe** | Rumpf regeneriert stetig; Stufen erhöhen die Rate | `bergung` |
| **Wellenbrecher** | Lädt einen Schild auf, der einen Treffer vollständig schluckt; Nachladen nach Zeit ohne Treffer | — |
| **Rettungsinsel** | Einmal pro Fahrt: statt zu sterben, mit 30 % Rumpf und 3 s Schutz weiter | — |
| **Schotten dicht** | Dauerhafte Schadensminderung, die mit fallendem Rumpf steigt | — |
| **Nebelwand** | Bei Treffer: Kontakte verlieren dich für 2 s | `zone` |

### Angriff

| System | Wirkung | Marken |
|---|---|---|
| **Geleitboot** | 1–5 Begleiter kreisen und feuern selbständig | `geleit`, `impuls` |
| **Wasserbombe** | Alle N Sekunden: großflächige Detonation um dich | `druckwelle` |
| **Minenleger** | Legt im Fahrtwasser Seeminen ab | `zone`, `druckwelle` |
| **Ölspur** | Hinterlässt eine brennende Spur | `zone`, `zersetzung` |
| **Schleppanker** | Verlangsamt dauerhaft alles in Reichweite | `kälte`, `zone` |
| **Suchscheinwerfer** | Rotierender Lichtkegel, Dauerschaden, deckt Getauchte auf | `fernbereich` |
| **Bordflieger** | Startet Aufklärer, die einzelne Ziele verfolgen | `geleit` |
| **Überschlag** | Treffer springen auf nahe Ziele über | `impuls` |
| **Funkfeuer** | Setzt einen Köder, der Kontakte anzieht | `zone`, `signal` |
| **Prallblech** | Gegnerprojektile prallen ab und treffen ihre Absender | `nahbereich` |

**Zur Wasserbombe (deine „Smart Bomb"):** bewusst *nicht* als Notknopf, sondern
mit fester Taktung. Ein manuell auslösbarer Bildschirmräumer wäre auf Mobil ein
zweiter Knopf — und würde die Aufmerksamkeit vom Fahren wegziehen. Die Taktung
lässt sich über Stufen und `druckwelle`-Verstärker verkürzen, damit bleibt der
Ausbaupfad erhalten.

---

## Teil D — Die Kurse (Strategien)

Elf Kurse. Jeder hat eine **Kernquelle**, einen **Ausbaupfad**, eine **eigene
Antwort auf Bedrängnis** und eine **Schwäche**. Die Schwäche ist das Wichtigste:
Ohne sie sind es keine Strategien, sondern nur Geschmacksrichtungen.

| # | Kurs | Kern | Skaliert über | Schwäche |
|---|---|---|---|---|
| 1 | **Scharfschütze** | Peilstrahl, Stillstand-Ladung | `fernbereich`, `impuls` | Massen, Bedrängnis |
| 2 | **Brandung** | Nahbereichsbonus | `nahbereich`, Rumpf | verlangt ständiges Risiko |
| 3 | **Sprengmeister** | Grundmine, Wasserbombe | `druckwelle` | Einzelziele, Leitschiffe |
| 4 | **Kaltwasser** | Vereisung, Schleppanker | `kälte` | geringer Grundschaden |
| 5 | **Beizerei** | Korrosion, Ölspur | `zersetzung` | tötet langsam, schlecht gegen Schnellboote |
| 6 | **Geleitzug** | Geleitboote, Bordflieger | `geleit` | wenig Steuerung, schwach gegen Verstreute |
| 7 | **Revierkontrolle** | Minen, Zonen, Funkfeuer | `zone` | verlangt Standhalten, schlecht auf der Flucht |
| 8 | **Rammfahrt** | Notmanöver als Waffe | `manöver` | fehlerintolerant, Cooldown-abhängig |
| 9 | **Peilstation** | Signalwirtschaft, Novas | `signal` | braucht Anlaufzeit, früh schwach |
| 10 | **Bergungsdienst** | Lebensraub, Lenzpumpe | `bergung` | niedriger Spitzenschaden |
| 11 | **Panzerfahrt** | Wellenbrecher, Prallblech, Schotten | Rumpf, Konter | tötet passiv, langsam |

### Wie Kurse sich begünstigen — und wie nicht

Absichtlich **nicht** alles mit allem. Ein Teil der Paare ist neutral, damit
Entscheidungen Kosten haben:

```
        Scharf  Brand  Spreng  Kalt  Beiz  Geleit  Revier  Ramm  Peil  Berg  Panzer
Scharf     —      ·      ·      +     ·      ·       ·      ·     +     ·      ·
Brandung   ·      —      +      ·     ·      ·       ·      +     ·     +      +
Spreng     ·      +      —      ++    +      ·       +      +     ·     ·      ·
Kaltwass   +      ·      ++     —     ·      +       ++     ·     ·     +      ·
Beizerei   ·      ·      +      ·     —      ·       ++     ·     +     ·      ·
Geleitzug  ·      ·      ·      +     ·      —       ·      ·     +     +      +
Revier     ·      ·      +      ++    ++     ·       —      ·     +     ·      +
Rammfahrt  ·      +      +      ·     ·      ·       ·      —     ·     ·      +
Peilstat   +      ·      ·      ·     +      +       +      ·     —     ·      ·
Bergung    ·      +      ·      +     ·      +       ·      ·     ·     —      +
Panzer     ·      +      ·      ·     ·      +       +      +     ·     +      —

++ starke Kopplung   + spürbar   · unabhängig
```

Zwei Beobachtungen dazu:

- **Kaltwasser + Sprengmeister** (Eisbruch) und **Revier + Beizerei** (Schmauchspur)
  sind die stärksten Paare. Sie sollen es sein: erkennbare, belohnende Entdeckungen.
- **Scharfschütze** ist mit Absicht der einsamste Kurs — er ist stark für sich und
  koppelt kaum. Wer ihn fährt, spielt auf Präzision statt auf Aufbau.

---

## Teil E — Gefechtserfahrung

Kontakte, die lange auf dem Schirm überleben, steigen in Stufen auf. Alle
**18 Sekunden** eine Stufe, höchstens vier.

| Stufe | Name | Wirkung | Sichtbar an |
|---|---|---|---|
| 0 | Neuzugang | — | schlicht |
| 1 | Eingespielt | +10 % Tempo, +15 % Rumpf, −8 % Feuerpause | 1 Wimpel |
| 2 | Erfahren | zusätzlich +10 % Schaden | 2 Wimpel, Kontur heller |
| 3 | Veteran | zusätzlich Rückstoß-Immunität | 3 Wimpel, Doppelkontur |
| 4 | Flaggschiff | zusätzlich +25 % Tempo, zieht Nachbarn mit | Wimpelkette, Aura |

**Warum Wimpel:** Naval signal flags sind auf einen Blick zählbar, brauchen keine
Farbe (bleiben also im Palettenbudget) und kosten drei Striche im Zeichenpfad.
Der Spieler liest die Bedrohung, ohne eine Zahl zu lesen.

**Was das am Spiel ändert:**

- Liegenlassen wird bestraft. Wer nur wegläuft, hat nach zwei Minuten ein Feld
  voller Veteranen.
- Flächenschaden gewinnt an Wert gegenüber Einzelziel — aber nur, wenn er
  *schnell genug* tötet.
- Es entsteht eine echte Zielpriorität, die es bisher nicht gab: das älteste
  Ding zuerst.
- **Nebenwirkung, die ich für gut halte:** Der Aufklärer, der sich langsam
  hereinschraubt, wird dadurch von einer Randerscheinung zu einer Uhr, die tickt.

**Ausgleich:** Erfahrung erhöht auch den Signalwert (+20 % je Stufe). Ein Feld
voller Veteranen ist gefährlich *und* lohnend — das soll eine Versuchung sein,
kein reiner Straftermin.

---

## Teil F — Merkmale: Form folgt Funktion

Statt weitere Gegnertypen von Hand zu entwerfen: **Rumpfformen × Merkmale**.

### Neue Rümpfe (zu den 7 bestehenden)

| Rumpf | Verhalten |
|---|---|
| **Minenleger** | legt ortsfeste Seeminen |
| **Träger** | entlässt kleine Drohnen |
| **Rammer** | lädt auf, dann gerader Sturmlauf (deutlich angekündigt) |
| **Funkstörer** | stört im Umkreis die Zielerfassung |
| **Bergungsschiff** | heilt Kontakte in der Nähe |
| **Geist** | phasenweise unverwundbar, dafür berechenbar getaktet |

### Merkmale (0–2 je Kontakt)

Jedes Merkmal ist gleichzeitig **Mechanik und Aussehen**:

| Merkmal | Mechanik | Wird gezeichnet als |
|---|---|---|
| **Gepanzert** | −40 % Schaden aus `impuls`, normal aus `druckwelle` | eckige Außenklammer |
| **Getaucht** | nur während des Sweeps angreifbar | Kontur gestrichelt |
| **Magnetisch** | zieht den Spieler leicht an | zwei Feldlinienbögen |
| **Verstrahlt** | hinterlässt beim Tod eine Zersetzungszone | Sprenkelmuster |
| **Gekoppelt** | teilt Schaden mit einem Partner | sichtbare Trosse zum Partner |
| **Schwer** | rückstoßimmun, langsamer | verdickte Kontur |
| **Flink** | weicht Projektilen seitlich aus | Bewegungsstriche |
| **Vereist** | resistent gegen `kälte`, anfällig für `druckwelle` | Kristallsplitter |

**Das ist die Antwort auf deine Frage.** Sieben Rümpfe × acht Merkmale (0–2)
ergeben rechnerisch über 200 unterscheidbare Erscheinungen — jede davon aus der
Mechanik abgeleitet, keine davon von Hand gezeichnet. Wer eine gestrichelte
Kontur sieht, weiß: *warten, bis der Sweep drüber geht*. Das Aussehen **ist** die
Information.

Merkmale erscheinen ab bestimmten Fahrtminuten und werden mit der Schwierigkeit
wahrscheinlicher.

**Gegenmittel-Kopplung:** Weil „Gepanzert" gegen `impuls` schützt, aber nicht
gegen `druckwelle`, entsteht ein echter Grund, eine zweite Schadensart zu haben.
Das ist der Hebel, mit dem sich einseitige Builds bestrafen lassen, ohne
irgendetwas zu nerfen.

### Visuelles Budget

Bei bis zu 110 Kontakten darf nicht jeder drei Verzierungen tragen. Regel:
**höchstens zwei Merkmale plus Wimpel**, Merkmalsgrafik nur als Strich (kein
zusätzliches Leuchten), und ab 70 gleichzeitigen Kontakten werden Merkmale nur
noch für die 30 nächstgelegenen gezeichnet.

---

## Teil G — Wie wir „gleichwertig" überhaupt prüfen

Elf Kurse gleich stark zu behaupten wäre unseriös. Der bestehende Kopflos-Prüfstand
lässt sich zu einem **Kurs-Simulator** ausbauen:

- Ein Bot spielt eine Fahrt mit einer **vorgegebenen Kartenpolitik** („wähle immer
  die Karte, die dem Kurs *Kaltwasser* am nächsten liegt").
- 40 Fahrten je Kurs mit festen Startwerten.
- Ausgegeben wird je Kurs: mittlere Fahrtzeit, Streuung, mittlere Punkte,
  Stufe bei Minute 5, Tode je Minute.

Zielkorridor: **Median-Fahrtzeit aller Kurse innerhalb ±25 %**. Was heraussticht,
wird nachgezogen — nach oben, nicht nach unten, wie schon bei den Signalgebern.

Der Bot ersetzt kein Spielgefühl. Er fängt aber die grobe Schieflage ab, bevor
du sie beim Spielen suchen musst.

---

## Umsetzung in vier Stufen

Jede Stufe ist für sich lauffähig und spielbar.

### Stufe 1 — Fundament (unsichtbar, aber Voraussetzung für alles)

- Marken-System in der Schadensauflösung
- Verstärker auf Marken umstellen (die 8 bestehenden Karten neu verdrahtet)
- **Bordbuch**, inkl. „wirkt auf N deiner Quellen" auf den Karten
- Drei-Plätze-Angebot (Vertiefung / Breite / Frei)

*Danach spielt sich das Spiel fast wie heute — aber alles Weitere wird billig.*

### Stufe 2 — Systeme

- Systemplätze, Ausbaustufen, Bordbuch-Anzeige
- Die fünf Überlebenssysteme (Lenzpumpe, Wellenbrecher, Rettungsinsel,
  Schotten dicht, Nebelwand)
- Fünf Angriffssysteme (Geleitboot, Wasserbombe, Minenleger, Ölspur, Schleppanker)

### Stufe 3 — Gegnerseite

- Gefechtserfahrung mit Wimpeln
- Merkmale samt Zeichnung und visuellem Budget
- Sechs neue Rümpfe

### Stufe 4 — Emergenz und Abgleich

- Die zwölf Kopplungen
- Die restlichen Systeme
- Kurs-Simulator, Messung, Nachziehen

---

## Was mir daran Sorgen macht

Drei Punkte, die ich nicht wegargumentieren will:

1. **Das Spiel wird komplexer, und Komplexität ist nicht gratis.** Heute versteht
   man in 30 Sekunden, was passiert. Mit Marken, Systemen und Kopplungen braucht
   es länger. Gegenmaßnahmen: Bordbuch, „wirkt auf N Quellen", Merkmale, die man
   *sehen* statt lesen muss. Trotzdem bleibt ein Rest.

2. **Mobile Rechenlast.** Geleitboote, Minen, Zonen, Drohnen und Merkmalsgrafik
   sind alles zusätzliche Objekte. Der heutige Kopfraum ist groß (Median 0,045 ms
   bei 8,3 ms Budget), aber nicht unbegrenzt. Jede Stufe wird gegen den
   Prüfstand gemessen, und die Entitätsbudgets stehen von Anfang an fest.

3. **Elf Kurse sind viel.** Es kann sein, dass sich drei davon als
   Geschmacksvarianten desselben Kurses erweisen und wir zusammenlegen. Ich würde
   das lieber nach der Messung entscheiden als jetzt.

---

## Teil H — Getroffene Entscheidungen

*Am 2026-07-27 entschieden:*

| Frage | Entscheidung |
|---|---|
| Reihenfolge | **Alles am Stück** — alle vier Stufen, Meldung am Ende |
| Systemplätze | **4** — Knappheit erzwingt Profil |
| Notknopf | **Nein**, Wasserbombe auf fester Taktung |
| Rettungsinsel | **Ja**, aber selten und teuer |
| Merkmale auf Leitschiffe | **Ja, ab Minute 6** (Vorschlag übernommen) |

<details>
<summary>Ursprüngliche Fragestellung</summary>


**1. Systemplätze — wie knapp?**
Vier Plätze machen die Wahl schmerzhaft und Builds scharf. Sechs Plätze machen
Fahrten üppiger und verzeihender. Mein Vorschlag: **vier**, weil Knappheit die
Voraussetzung dafür ist, dass Kurse sich unterscheiden.

**2. Manuell auslösbares System?**
Ich habe die Wasserbombe bewusst auf feste Taktung gelegt (kein zweiter Knopf auf
Mobil). Wenn du einen echten Notknopf willst, wäre die saubere Variante: **der
Manöver-Knopf bekommt einen langen Druck** — kurz = Notmanöver, lang = Wasserbombe.
Sag, ob du das willst.

**3. Rettungsinsel — zweites Leben ja oder nein?**
Ein zweites Leben verändert den Charakter einer Fahrt stark und entwertet
sorgfältiges Spiel ein Stück weit. Ich würde es aufnehmen, aber als seltene,
teure Karte. Alternative: streichen.

**4. Sollen Merkmale auch auf Leitschiffe?**
Ein „Gepanzertes, Getauchtes Leitschiff" ist ein kleiner Boss — spannend, aber
möglicherweise unfair früh. Vorschlag: ja, aber erst ab Minute 6.

**5. Reihenfolge.**
Stufe 1 ist unsichtbar und trotzdem die meiste Arbeit. Wenn du zuerst etwas
Sicht- und Spielbares willst, kann ich das Bordbuch und zwei, drei Systeme
vorziehen — der Umbau auf Marken wird dann aber nachträglich teurer. Meine
Empfehlung bleibt: Fundament zuerst.

---

</details>

---

*Umsetzung läuft. Es wird nicht committet, solange du es nicht ausdrücklich sagst.*


---

## Was die Messung geändert hat

Der Kurs-Simulator hat drei Annahmen des Entwurfs widerlegt.

**1. Merkmale und Gefechtserfahrung machen das Spiel nicht schwerer, sondern
ergiebiger.** Ich hatte vermutet, sie würden die Abschusszahl drücken. Ein
Isolationstest über 500 s mit identischer Kartenpolitik zeigte das Gegenteil:

| Konfiguration | Abschüsse |
|---|---:|
| vollständig | 3.505 |
| ohne Merkmale | 2.709 |
| ohne Gefechtserfahrung | 3.362 |
| nur alte Gegnertypen | 3.142 |
| ohne alles | 2.070 |

Mehr Gegnertypen und der Erfahrungsbonus auf den Signalwert bringen unterm
Strich mehr Ziele und mehr Ausbeute, nicht weniger.

**2. Widerstände dürfen sich nicht frei multiplizieren.** Panzerung × Gepanzert
× Getaucht ergab bis zu 85 % Minderung. „Getaucht" allein kam einer
Unverwundbarkeit gleich, weil der Sweep einen Kontakt nur etwa ein Fünftel der
Zeit anmalt. Jetzt: Untergrenze 25 % Gesamtwirkung, „Getaucht" auf 0,4 statt 0,12.

**3. Verstärker ohne Quelle sind tote Karten.** Ein „+13 % Kälte" nützt nichts,
wenn keine Kältequelle an Bord ist. Sie erscheinen deshalb nur noch im
Vertiefungs-Platz; der Breite-Platz bietet ausschließlich Dinge an, die neue
Quellen *schaffen*. Wirkung in der Messung: Tode je Fahrt 180 → 142,
Abschüsse 2.031 → 2.520.

Außerdem bekam das Angebot **Gewichte** statt Gleichverteilung — sonst ging eine
Waffenkarte unter dreißig gleichrangigen Einträgen unter (in einer 500-s-Messung
wurde keine einzige angeboten), und Kopplungen wären so häufig gewesen wie
Grundausstattung.

## Was die Messung NICHT zeigen konnte

Der Simulator vergleicht elf Kurse unter identischen Bedingungen und findet sie
innerhalb von 9 % beieinander — **aber nur bis etwa acht Karten Tiefe**. So weit
kommt der Bot in fünf Minuten. Ob die Kurse auch mit zwanzig Karten gleichwertig
bleiben, ist damit *nicht* belegt: Genau dort entstehen die Kopplungen und die
zweistufigen Systeme, auf denen der Entwurf beruht.

Zwei Versuche, den Bot tiefer zu bringen, sind gescheitert, und der Grund ist
lehrreich: Eine fliehende Fahrweise senkt den Durchsatz um das Fünffache, weil
sie auch von den Signalen wegführt, die die Kontakte fallen lassen. Eine
kreisende sammelt beiläufig ein, kommt aber trotzdem nicht über acht Karten,
solange jede Stufe nur eine Karte gibt.

Für die Tiefe braucht es echtes Spiel.


---

## Nachjustierung nach dem ersten Spieltest (2026-07-27)

Drei echte Fahrten ergaben 2:39 bis 4:29 bei Stufe 6–11 — also **5 bis 10 Karten
je Fahrt**. Der Simulator hatte das fast exakt vorhergesagt, was für das
Instrument spricht und gegen die Auslegung: Allein die Systeme umfassen zwanzig
mögliche Karten (4 Plätze × 5 Stufen), dazu zwölf Kopplungen. Die
Emergenz-Ebene, um die es beim ganzen Umbau ging, war schlicht unerreichbar.

Zwei Eingriffe, beide gemessen:

**1. Aufstiegskurve von 42 auf 18** (`XP_CURVE` in `entities/player.js`).

**2. Systemstufen richten sich nach der Seltenheit.** Vorher hatte die
Seltenheit bei Systemkarten *überhaupt keine Wirkung* — eine „Sturm"-Systemkarte
war identisch mit einer aus Windstille. Jetzt bringt sie 1–3 Stufen auf einmal,
und ein neu eingebautes System startet auf Stufe 2 statt 1.

| Messwert (500 s, gleiche Kartenpolitik) | vorher | nachher |
|---|---:|---:|
| Stufe | 26 | 38 |
| gewählte Karten | 25 | 37 |
| Spielertode | 142 | 95 |
| Abschüsse | 2.520 | 3.008 |
| erreichte Kopplungen | 7 | 12 |

Im Kurs-Simulator stiegen Stufe und Kartenzahl von 9/8 auf 12/11, und alle elf
Kurse blieben im Zielkorridor.

Der Rückgang der Tode von 142 auf 95 ist kein Zufall: Wer schneller aufsteigt,
wird schneller stark — die Kurve korrigiert sich also teilweise selbst. Ob das
Spiel dadurch zu leicht wird, muss der nächste Spieltest zeigen.
