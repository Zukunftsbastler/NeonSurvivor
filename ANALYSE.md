# Neon Survivor — Analyse & Verbesserungsansätze

> **Status: umgesetzt.** Dieses Dokument ist die Bestandsaufnahme des
> Prototyps (einzelne `index.html`, Commit `345419f`) und beschreibt den Stand
> *vor* dem Umbau. Alle 32 Punkte der Umsetzungsreihenfolge sind inzwischen in
> der modularen Fassung unter `src/` realisiert; das Spiel heißt dort
> **Seegang**. Die Analyse bleibt als Begründung erhalten — die Rechnungen zu
> Balancing und Skalierung sind weiterhin die Grundlage der neuen Werte.
> Aktuelle Struktur und Mechaniken: siehe [`README.md`](README.md).
>
> Die Zeilenverweise unten zeigen auf die **alte** `index.html` und lassen sich
> nur noch über die Git-Historie auflösen (`git show 345419f:index.html`).

Stand: 2026-07-26 · Bezug: `index.html` (1151 Zeilen, Commit `345419f`)

Diese Analyse betrachtet das Spiel unter drei Leitfragen, die du gestellt hast:

1. **Warum hört die Interaktion irgendwann auf?** → [Teil A](#teil-a--warum-das-spiel-aufhört-dich-zu-brauchen)
2. **Warum gewinnen schnellfeuernde Waffen — und wie stärkt man die anderen, ohne zu nerfen?** → [Teil B](#teil-b--warum-feuerrate-gewinnt)
3. **Woran erkennt man die KI-Herkunft, und wie bekommt man sie raus?** → [Teil C](#teil-c--der-ki-geruch)

Dazu kommen [konkrete Bugs](#teil-d--bugs-nach-schwere-sortiert), [Mobile-Performance](#teil-e--mobile-performance--robustheit) und ein [Umsetzungsplan](#umsetzungsreihenfolge).

**Grundhaltung dieser Analyse:** Das Spiel funktioniert. Die Basis — Auto-Fire, Orb-Sog, Dash, Kartenwahl — trägt. Alle Vorschläge sind additiv oder strukturell; keiner verlangt, existierenden Spaß wegzunehmen.

---

## Kurzfassung

**Das Kernproblem ist ein strukturelles, kein numerisches.** Jedes Upgrade im Spiel fließt in genau eine Zahl: Schaden-pro-Sekunde auf den nächstgelegenen Gegner. `damage`, `fireRate` und `projectileCount` multiplizieren sich zum selben Produkt. Wenn es nur eine Größe zu optimieren gibt, gibt es keine Entscheidung — nur „welche Zahl ist größer". Und weil Gegner ausschließlich stumpf auf dich zulaufen und beim Kontakt sofort sterben, gibt es auch keine zweite Aufgabe neben „DPS".

Daraus folgt alles Weitere:

- Die Interaktion hört auf, weil **Spielergeschwindigkeit multiplikativ wächst, Gegnergeschwindigkeit aber nur zu 10 % der Schwierigkeit** ([Zeile 614](index.html#L614)). Ab ca. Minute 5 kann dich nichts mehr einholen.
- Ab Level ~20 gibt es **gar keine Karten mehr** — die XP-Kurve (×1.5 pro Level) macht Level 23 mit ~1,5 Mio. XP praktisch unerreichbar. Genau der Moment, den du beschreibst: maximal stark *und* keine Entscheidungen mehr.
- Zwei Upgrades erzeugen bei hoher Seltenheit **negative Werte** und brechen das Spiel komplett ([Teil D.1](#d1--kritisch-negative-cooldowns-bei-hoher-seltenheit)) — u. a. permanente Unverwundbarkeit.
- Die Uzi gewinnt, weil `rate` **multiplikativ** wirkt, während der Ausgleichs-Stat `count` anderer Waffen **additiv** ist und im Multishot-Skalierung untergeht. Shotgun und Helix werden mit jedem Multishot-Upgrade *relativ schlechter*.

**Der KI-Geruch** ist kein Detail-, sondern ein Haltungsproblem: An jeder Weggabelung wurde die statistisch wahrscheinlichste Option gewählt. Das Gegenmittel ist nicht „mehr Politur", sondern *eine* willkürliche, konsequent durchgehaltene Festlegung.

---

## Teil A — Warum das Spiel aufhört, dich zu brauchen

### A.1 Du bist schneller als alles andere — dauerhaft

Die Gegner-Skalierung in [Zeile 614](index.html#L614):

```js
this.speed = baseSpeed * (1 + (mult - 1) * 0.1);
```

Der Faktor `0.1` dämpft die Geschwindigkeitsskalierung auf ein Zehntel. Gemessen:

| Minute | `difficultyMultiplier` | Runner-Speed | Tank-Speed | Basic-HP | Schaden/Treffer |
|-------:|----------------------:|-------------:|-----------:|---------:|----------------:|
| 1 | 1.50 | 3.68 | 1.05 | 45 | 15 |
| 5 | 3.50 | 4.38 | 1.25 | 105 | 35 |
| 10 | 6.00 | 5.25 | 1.50 | 180 | 60 |
| 20 | 11.00 | 7.00 | 2.00 | 330 | 110 |

Der Spieler startet bei Speed **4.0** — aber `Thrusters` multipliziert ([Zeile 283](index.html#L283)). Zwei „Selten"-Karten reichen für 9.6, eine „Göttlich"-Karte allein für 9.6. Der Dash liegt konstant bei **12.0**.

**Konsequenz:** Nach wenigen Upgrades kannst du dem gesamten Schwarm dauerhaft davonlaufen. Die einzige Bedrohung wäre Einkesselung — aber:

### A.2 Gegner sterben beim Berühren, also gibt es keinen Druck

[Zeile 661-665](index.html#L661-L665):

```js
if (dist < this.radius + player.radius) {
    player.takeDamage(this.damage);
    this.hp = 0;
}
```

Ein Gegner, der dich erreicht, **löst sich auf**. Eine Horde von 100 Gegnern richtet also einmalig Schaden an und verschwindet. Es gibt keinen anhaltenden Druck, keine Zone, die man verlassen muss, keinen Grund, sich zu *positionieren* statt nur zu *fliehen*. Nebeneffekt: Der Gegner gibt dabei weder XP noch Score (`takeDamage` wird umgangen) — du wirst doppelt bestraft und lernst, dass Kontakt immer schlecht ist. Das ist die einzige „Regel", die das Spiel dir beibringt.

### A.3 Die Kartenauswahl versiegt

XP-Bedarf bei `xpToNext = floor(xpToNext * 1.5)` ([Zeile 567](index.html#L567)):

| Level | Bedarf für nächstes Level | Kumuliert |
|------:|--------------------------:|----------:|
| 10 | 3.829 | 11.293 |
| 15 | 29.071 | 87.023 |
| 20 | 220.753 | 662.073 |
| 22 | 496.693 | 1.489.895 |
| 25 | 1.676.337 | 5.028.829 |

Bei `xpValue = floor(10 * mult)` — Minute 10 also 60 XP pro Gegner — sind Level 21/22 die realistische Obergrenze. **Danach läuft das Spiel ohne jede Entscheidung weiter.** Das ist wörtlich der Punkt, den du beschreibst.

### A.4 Alle Ressourcen sind kostenlos

Es gibt im gesamten Spiel **keine einzige verwaltbare Ressource**: keine Munition, kein Nachladen, keine Hitze, keine Energie, keinen Manabalken. Schießen ist gratis und passiert automatisch. Der Dash ist gratis (i-Frames ohne Kosten, [Zeile 574](index.html#L574)). XP-Orbs kommen von selbst. Es bleibt schlicht nichts übrig, worüber der Spieler eine Entscheidung treffen *könnte*.

### A.5 Lösungsansätze

Sortiert nach Wirkung-pro-Aufwand. Alle sind mobile-kompatibel (keiner braucht zusätzliche Eingaben).

#### A.5.1 Gegner sollen überleben und Druck aufbauen ⭐ *größter Einzelhebel*

Kontakt darf den Gegner nicht töten. Stattdessen ein Treffer-Cooldown pro Gegner plus ein Rückstoß:

```js
// in Enemy.update, ersetzt Zeile 661-665
if (dist < this.radius + player.radius) {
    if (this.contactCd <= 0) {
        player.takeDamage(this.damage);
        this.contactCd = 45;                       // ~0.75 s bei 60 fps
        const a = Math.atan2(this.y - player.y, this.x - player.x);
        this.x += Math.cos(a) * 12;                // Rückstoß statt Tod
        this.y += Math.sin(a) * 12;
    }
}
if (this.contactCd > 0) this.contactCd -= timeScale;
```

Damit wird eine Umzingelung zu einer Situation, aus der man sich *herausarbeiten* muss. Movement bekommt zum ersten Mal eine Aufgabe. Der Dash wird von einem Unverwundbarkeitsknopf zu einem Fluchtwerkzeug mit Timing.

Gegenprobe Mobile: keine neue Eingabe, keine neue UI. ✓

#### A.5.2 Gegner-Geschwindigkeit realistisch skalieren, aber gedeckelt

Der Faktor `0.1` ist zu niedrig, `1.0` wäre zu brutal. Sinnvoll: schnellere Annäherung an einen Zielwert knapp unter Spielergeschwindigkeit.

```js
// statt: baseSpeed * (1 + (mult - 1) * 0.1)
this.speed = baseSpeed * (1 + (1 - Math.exp(-(mult - 1) * 0.35)) * 0.8);
```

Sättigt bei +80 % statt linear zu kriechen. Wichtiger als der genaue Wert ist: **Gegner müssen dich einholen können, wenn du stehen bleibst.**

#### A.5.3 Gegnertypen, die anders funktionieren als „lauf geradeaus"

Aktuell verhalten sich alle drei Typen identisch — sie unterscheiden sich nur in HP/Speed/Größe. Das ist der eigentliche Mangel an Abwechslung. Vorschläge, alle mit wenigen Zeilen umsetzbar:

| Typ | Verhalten | Was es vom Spieler verlangt |
|---|---|---|
| **Schütze** | Hält Abstand (~250 px), feuert langsame Projektile | Ausweichen; Nahdistanz erzwingen |
| **Kreiser** | Umkreist den Spieler, nähert sich spiralförmig | Auto-Aim wird unzuverlässig, aktives Positionieren |
| **Teiler** | Zerfällt beim Tod in 2 kleinere | Bestraft blindes Flächenfeuer |
| **Panzer (Front)** | Nur von hinten/seitlich verwundbar | Macht *Blickrichtung* relevant → siehe B.5.1 |
| **Anker** | Langsam, erzeugt Zone, die Spieler verlangsamt | Zwingt zur Prioritätsentscheidung im Zielen |

Schon zwei davon (Schütze + Kreiser) verändern das Spielgefühl fundamental, weil Wegrennen aufhört, die universelle Antwort zu sein.

#### A.5.4 XP-Kurve flach genug halten, dass Karten nie aufhören

```js
// statt: this.xpToNext = Math.floor(this.xpToNext * 1.5);
this.xpToNext = Math.floor(80 + Math.pow(this.level, 1.7) * 22);
```

Ergibt Level 20 bei ~4.100 XP, Level 40 bei ~13.000 XP — Level-Ups werden seltener, hören aber nie auf. Der Entscheidungs-Loop bleibt bis zum Tod bestehen. **Das ist die direkteste Antwort auf „irgendwann ist keine Interaktion mehr nötig".**

#### A.5.5 Reroll & Banish ⭐ *bestes Aufwand-Nutzen-Verhältnis*

Zwei Buttons auf dem Level-Up-Screen, begrenztes Kontingent (z. B. 3 Rerolls pro Run, aufstockbar durch eine eigene Karte):

- **Reroll** — drei neue Karten
- **Bannen** — Kartentyp für den Rest des Runs aus dem Pool entfernen

Das erzeugt sofort echte Optimierungsentscheidungen („lohnt sich der Reroll für dieses Build?") und ist auf Mobile trivial — zwei zusätzliche Tap-Targets auf einem Screen, der ohnehin pausiert ist. Aufwand: ~30 Zeilen.

#### A.5.6 Pakt-System: freiwillig die Schwierigkeit zurückholen ⭐ *beantwortet dein Anliegen am direktesten*

Du willst Phasen der Übermacht behalten, aber Optimierungsdruck zurück. Der saubere Weg dafür ist, **den Spieler die Schwierigkeit selbst hochdrehen zu lassen** — gegen Belohnung. Alle 90 Sekunden (oder wenn HP über 90 % *und* seit 30 s kein Treffer) erscheint ein Angebot:

| Pakt | Preis | Belohnung |
|---|---|---|
| „Überlast" | +40 % Spawn-Rate | +25 % XP-Gewinn |
| „Blutzoll" | Max-HP halbiert | +50 % Schaden |
| „Blindflug" | Auto-Aim-Reichweite −50 % | Doppelte Orb-Werte |
| „Beschleunigung" | Gegner +30 % Speed | Score-Multiplikator ×1.5 |

Das ist das Modell aus *Death Must Die* / *Hades' Pakt der Schande* und löst genau dein Problem: Der Spieler, der zu stark geworden ist, hat einen Grund, sich freiwillig wieder in Gefahr zu bringen — und die Bestenliste belohnt es. Übermacht bleibt möglich, wird aber zu einer Entscheidung statt zu einem Zustand.

#### A.5.7 Score, der Können abbildet

Aktuell gilt `state.score += this.xpValue` ([Zeile 711](index.html#L711)) — Score ist identisch mit gesammelter XP, also reines Überlebens-Nebenprodukt. Die optimale Strategie für die Bestenliste ist damit *passives Ausharren*. Besser:

```js
// Kill-Combo: Multiplikator steigt mit Kill-Frequenz, verfällt bei Treffer
state.combo = Math.min(10, state.combo + 0.1);
state.score += this.xpValue * state.combo;
// in Player.takeDamage(): state.combo = 1;
```

Damit wird der Bestenlisten-Eintrag zu einer Aussage über Spielweise, nicht über Sitzfleisch.

---

## Teil B — Warum Feuerrate gewinnt

### B.1 Die Formel

Aus [Zeile 501](index.html#L501) und [Zeile 511-541](index.html#L511-L541):

```
DPS = (stats.damage × w.damage) × (stats.projectileCount + w.count)
      ────────────────────────────────────────────────────────────
                   (stats.fireRate × w.rate)
```

Der entscheidende Konstruktionsfehler steht in dieser Formel offen da:

| Waffen-Stat | Wirkungsart | Konsequenz |
|---|---|---|
| `w.damage` | **multiplikativ** | wirkt dauerhaft, skaliert mit allem |
| `w.rate` | **multiplikativ** | wirkt dauerhaft, skaliert mit allem |
| `w.count` | **additiv** | verpufft, sobald `projectileCount` wächst |
| `w.pierce` | keine Skalierung | statisch |
| `w.spread` | keine Skalierung | statisch |

**Waffen, die ihre Stärke mit `count` bezahlen (Shotgun +4, Helix +2), werden mit jedem Multishot-Upgrade relativ schwächer** — ihr Bonus wird zum Rundungsfehler, während ihr multiplikativer Malus (`damage 0.6` bzw. `0.8`) für immer bleibt.

Gemessen:

| Waffe | DPS-Faktor bei 1 Projektil | DPS-Faktor bei 20 Projektilen | Verhältnis |
|---|---:|---:|---:|
| Blaster | 1.00 | 20.00 | 1.0× |
| Shotgun | 1.36 | 6.55 | **0.33×** |
| Railgun | 1.33 | 26.67 | 1.33× |
| **Uzi** | **2.00** | **40.00** | **2.0×** |
| Helix | 1.60 | 11.73 | 0.59× |

Die Shotgun startet als beste Waffe und endet 6× schlechter als die Uzi. Der Spieler erlebt das als „schnelle Waffen sind besser" — tatsächlich ist es „Waffen, deren Vorteil additiv ist, verlieren".

### B.2 Die Uzi ist auch ohne Multishot einfach besser

`damage: 0.4` bei `rate: 0.2` heißt: Der Schaden wird auf 40 % gedrückt, die Feuerrate auf das 5-fache erhöht. Netto **2.0** — doppelt so gut wie der Blaster (1.0), ohne jeden Nachteil. Die Waffenwerte wurden nie gegeneinander budgetiert. Ein faires Budget wäre `damage / rate ≈ konstant`.

### B.3 Multishot streut nicht

[Zeile 519](index.html#L519): `const totalSpread = w.spread;` — konstant, unabhängig von der Projektilzahl. Bei 20 Blaster-Projektilen mit `spread: 0.1` liegen alle in einem **5,7°-Kegel**, also 0,3° auseinander: Sie treffen alle denselben Gegner. Bei der Railgun (`spread: 0.0`) liegen sie sogar exakt übereinander.

Multishot ist damit **kein Streuungs-Upgrade, sondern ein reiner Schadensmultiplikator** — und macht die Shotgun-Identität („viele Projektile, breit gestreut") vollständig bedeutungslos, weil jede Waffe zur Shotgun wird, nur besser.

### B.4 Die Seltenheit der Waffenkarte tut nichts

In [Zeile 349-377](index.html#L349-L377) wählt `weapon_swap` eine **rein zufällige** Basiswaffe. `rarity.mult` beeinflusst nur die Chance auf einen Statuseffekt (`rarity.id * 0.15`), nicht die Waffenstärke. Eine „Transzendent"-Waffenkarte kann also eine schlechtere Waffe liefern als die aktuelle — und weil `weapon_swap` **ersetzt statt hinzuzufügen** ([Zeile 253](index.html#L253)), ist die Karte oft eine Falle. Der Spieler lernt schnell, Waffenkarten zu meiden.

### B.5 Lösungsansätze — stärken statt nerfen

Dein Wunsch war ausdrücklich: keine Nerfs. Der Weg dahin ist, **den anderen Waffen und Stats Wertachsen zu geben, die Feuerrate nicht kaufen kann.** Feuerrate bleibt exakt so stark wie jetzt — sie ist nur nicht mehr die einzige Antwort.

#### B.5.1 Waffen bekommen exklusive Mechaniken statt nur Zahlen ⭐

Jede Waffe braucht *eine* Sache, die sie kann und die anderen nicht:

| Waffe | Exklusive Mechanik | Wertachse |
|---|---|---|
| **Railgun** | Lädt auf, während du **nicht** feuerst; voller Schuss durchschlägt alles auf einer Linie und hinterlässt eine kurze Schadenszone | Positionierung, Timing |
| **Shotgun** | Projektile im Nahbereich (< 150 px) verursachen **dreifachen** Schaden; Rückstoß schiebt den Spieler zurück | Risiko-Nähe, Mobilität |
| **Helix** | Projektile fliegen auf Spiralbahnen und **kehren zurück** — Treffer auf Hin- und Rückweg | Flächendeckung, Aufstellung |
| **Blaster** | Jeder 5. Schuss ist ein aufgeladener Durchschlagsschuss | verlässlicher Allrounder |
| **Uzi** | *(bleibt wie sie ist — hoher, stetiger Einzelziel-DPS)* | Bosse, Elites |

Das Entscheidende: Die Shotgun-Nahbereichsregel ist eine Achse, die die Uzi nicht durch Feuerrate erreichen kann. Der Spieler wählt dann nach **Spielstil**, nicht nach Zahl.

#### B.5.2 Streuung an Projektilzahl koppeln

```js
// ersetzt Zeile 519
const totalSpread = w.spread * (1 + Math.log2(1 + totalCount) * 0.55);
```

Damit wird Multishot von einem reinen Multiplikator zu einer **Form-Entscheidung**: breiter Fächer räumt Massen, trifft aber Einzelziele schlechter. Die Railgun behält `spread: 0` und wird zur echten Einzelziel-/Durchschlagswaffe. Die Shotgun bekommt ihre Identität zurück.

*Kein Nerf im engeren Sinne*: Der Gesamtschaden pro Sekunde bleibt identisch, er verteilt sich nur auf mehr Gegner statt auf einen.

#### B.5.3 Waffen-Slots statt Ersetzen

Zwei bis drei Waffenslots; `weapon_swap` fügt hinzu oder ersetzt gezielt. Alle Waffen feuern parallel mit eigenem Cooldown. Das macht die Waffenkarte sofort attraktiv und schafft Build-Entscheidungen („Railgun für Elites + Uzi für Masse"). Zusätzlich sollte `rarity.mult` die Waffenwerte tatsächlich beeinflussen:

```js
newWeapon.damage *= 1 + (rarity.id * 0.18);
newWeapon.name = `${rarity.name} ${newWeapon.name}`;
```

#### B.5.4 Die „langweiligen" Stats offensiv machen ⭐

Aktuell sind vier von acht Upgrades reine Komfort-Stats. Jedes bekommt eine Kampfrelevanz:

| Karte | Heute | Vorschlag |
|---|---|---|
| **Thrusters** (Speed) | nur Bewegung | Projektile erben Spielergeschwindigkeit; bei Vollgeschwindigkeit +X % Schaden („Momentum") |
| **Attractor** (Magnet) | nur Komfort | Jeder 25. eingesammelte Orb löst eine Nova aus; Orbs im Sog verursachen Kontaktschaden |
| **Nano Hull** (HP) | nur Sicherheit | HP wird ausgebbar: Pakt-System (A.5.6) und ein Upgrade „je 100 fehlende HP +8 % Schaden" |
| **Dash Engine** | nur Cooldown | Dash **durch** Gegner verursacht Schaden und friert sie kurz ein; Kill während Dash setzt Cooldown zurück |

Der Dash-Vorschlag ist besonders wertvoll: Er verwandelt den Dash von einem Unverwundbarkeits-Knopf in ein **Positionierungs-Werkzeug mit Belohnung** — und das ist genau die Art von Interaktion, die dem Endgame fehlt.

#### B.5.5 Optional: Hitze als Rhythmus, nicht als Strafe

Falls du dich später doch an die Feuerraten-Dominanz herantrauen willst, ohne Zahlen zu senken: Feuern erzeugt Hitze, Überhitzung sperrt kurz. Der DPS-*Höchstwert* der Uzi bleibt unverändert — sie wird nur zu einer Burst-Waffe mit Rhythmus, und langsame Waffen überhitzen nie. Das ist technisch ein Buff für alle anderen, kein Nerf für die Uzi. Auf Mobile ohne zusätzliche Eingabe darstellbar (Balken am Dash-Button).

*Ich würde damit warten,* bis B.5.1–B.5.4 umgesetzt sind — möglicherweise löst sich das Problem vorher.

#### B.5.6 Synergien zwischen Statuseffekten

Die vier Effekte (`freeze`, `poison`, `explosive`, `vampire`) wirken heute isoliert. Kombinationen erzeugen Build-Tiefe fast kostenlos:

- **Cryo + Blast** → gefrorene Gegner *zersplittern*: doppelter Explosionsschaden
- **Toxic + Blast** → Explosion hinterlässt Giftwolke
- **Vampiric + Cryo** → Lebensraub gegen gefrorene Ziele verdreifacht

Aufwand: ~20 Zeilen in der Treffer-Behandlung ([Zeile 957-988](index.html#L957-L988)). Ertrag: Der Spieler fängt an, gezielt auf Kombinationen hinzuarbeiten — das ist Optimierungsdruck ohne jeden Nerf.

---

## Teil C — Der KI-Geruch

Du hast das richtig wahrgenommen, und es lässt sich präzise benennen.

### C.1 Die Diagnose

**KI-Output riecht nach KI, weil an jeder Weggabelung die statistisch wahrscheinlichste Option gewählt wurde.** Nicht die schlechteste — die *modale*. Das Ergebnis ist überall kompetent und nirgends überraschend. Es fehlt nicht Qualität, sondern **Haltung**: eine willkürliche Festlegung, die jemand getroffen hat und dann konsequent durchhält.

Konkret nachweisbar:

**Im Code selbst** — die deutlichsten Spuren sind die stehen gebliebenen Selbstgespräche:

- [Zeile 262](index.html#L262): `// Slight dmg penalty removed for fun scaling? No, keep balance but scaled`
- [Zeile 276](index.html#L276): `// Diminishing returns formula simpler: fireRate / (1+v)? Let's do simple reduction but capped logically` *(— und dann ist sie nicht gedeckelt, siehe D.1)*
- [Zeile 498-500](index.html#L498-L500): `// Auto Fire (Independent of timeScale for Matrix feeling, or scaled? ...) // Actually, standard delta time logic is safer.`
- [Zeile 618](index.html#L618): `// 3. Visuelle Mutation (Der "Lean"-Trick)`
- Abschnitts-Überschriften mit `(NEW)` und `(UPDATED)` ([Zeile 209](index.html#L209), [Zeile 863](index.html#L863)) — Diff-Marker, die nie entfernt wurden
- [Zeile 1121](index.html#L1121) / [Zeile 1125](index.html#L1125): Kommentare, die beschreiben, was *entfernt* wurde

Kein Mensch schreibt Kommentare, die eine noch nicht getroffene Entscheidung protokollieren. Das ist die auffälligste Signatur im ganzen Projekt.

**In der Benennung:**

- Die Sprache springt: „Waffenschmied" (deutsch) steht neben „Power Core", „Nano Hull", „Overclock", „Thrusters", „Attractor", „Dash Engine". Ebenso „Uzi" und „Shotgun" (real) neben „Blaster" und „Helix" (generisch-SciFi).
- Die 8-stufige Seltenheitsleiter Gewöhnlich → Transzendent ist die **exakte Standardliste** aus MMO/Gacha-Spielen. Vorhersagbarer geht es nicht.
- Die vier Effekte Cryo / Toxic / Blast / Vampiric sind die kanonischen vier Elemente jedes Loot-Spiels.
- Die Namen sind **Adjektive aus einem Statblatt, keine Substantive aus einer Welt**. „Power Core" beschreibt eine Funktion; es erzählt nichts.

**In der Grafik:**

- Alles ist ein Primitiv: Kreis, Quadrat, Dreieck ([Zeile 686-697](index.html#L686-L697)). Keine Silhouette hat eine Identität.
- `ctx.shadowBlur` auf **jedem** Objekt in gleicher Intensität → alles glüht gleich stark, nichts hat Priorität. Das ist der „alles leuchtet"-Look, der flach wirkt.
- [Zeile 620](index.html#L620): `hsl(${hue}, 100%, 50%)` — volle Sättigung, mittlere Helligkeit. Das ist der rohe Farbkreis, kein Farbkonzept. Es sieht aus wie ein Colorpicker, nicht wie Art Direction.
- Das 50-px-Gitter in `#111` ([Zeile 927-931](index.html#L927-L931)) ist der meistverwendete „Cyberpunk"-Platzhalter überhaupt.
- `#00f3ff` + `#ff00ff` sind die zwei am häufigsten verwendeten „Neon"-Hexwerte im Netz.
- Regenbogen-Rahmen für die höchste Stufe ([Zeile 47-57](index.html#L47-L57)) — der Default-Signalgeber für „besonders".
- Orbitron ist die meistgenutzte „futuristische" Google-Schrift.

**Und explizit:** Die README verkauft die KI-Herkunft aktiv („Erstellt komplett mit Gemini 3.0 Pro Vibe Coded mit einem einzigen Prompt", „Projekt erstellt für Testzwecke zur Demonstration von KI-gestützter Spielentwicklung"), das Impressum ebenfalls („Quelle: Erstellt mit Unterstützung von KI"). Wenn das Spiel nicht mehr als Demo firmieren soll, ist das die erste Stellschraube.

### C.2 Die Idee: eine spezifische Festlegung, konsequent durchgehalten

**Die Methode ist wichtiger als mein konkreter Vorschlag:** Wähle *eine* Welt, die nicht die naheliegendste ist, und leite dann **jeden** Namen, **jede** Farbe und **jede** Form aus ihr ab. Nichts darf mehr „weil futuristisch" heißen. Der Effekt tritt nicht durch bessere Grafik ein, sondern durch **Konsequenz** — Menschen erkennen Absicht daran, dass sie sich wiederholt.

Drei Skizzen zur Auswahl. Wichtig: Alle drei behalten die technische Basis (dunkler Hintergrund, leuchtende Vektorformen) *unverändert* bei — es ändern sich nur Vokabular und Palette.

---

**Skizze 1 — Hafenradar** *(mein Favorit)*

Du bist kein „Survivor im digitalen Abgrund", sondern ein **Signal auf einem Hafenradar**. Gegner sind *Kontakte*. Das Gitter wird zum Radarschirm mit umlaufender Sweep-Linie. Passt zu Flensburg, und — entscheidend — Radarschirme sind *tatsächlich* leuchtende Vektorgrafik auf Schwarz. Die Ästhetik wird begründet statt behauptet.

- **Palette:** Phosphorgrün `#33ff66` + Bernstein `#ffb000` auf `#020604`. Zwei Farben, klare Rollen: Grün = du/System, Bernstein = Kontakt/Gefahr. Statt zwei Neonfarben ohne Bedeutung.
- **Vokabular:** Waffen → *Signalgeber*, *Störsender*, *Echolot*, *Peiler*. Upgrades → *Ruderanlage* (Speed), *Rumpfschott* (HP), *Bordfunk* (Magnet), *Notmanöver* (Dash). Seltenheiten → nautische Klassifikation: *Wache · Kurs · Manöver · Sturm · Havarie*. Alles deutsch, alles aus einer Domäne.
- **Mechanik-Bonus, den die Fiktion schenkt:** Die Sweep-Linie ist keine Deko — Kontakte werden erst sichtbar, wenn der Sweep sie erfasst, und verblassen danach. Das erzeugt **Anspannung durch unvollständige Information** — und trifft damit direkt Teil A: Man kann nicht mehr passiv spielen, wenn man nicht weiß, was hinter einem ist. *Eine Fiktion, die eine Mechanik hervorbringt, ist der Beweis, dass die Festlegung trägt.*

---

**Skizze 2 — BTX / Bildschirmtext, 1984**

Ein westdeutsches Btx-Terminal, das aus dem Ruder läuft. Kachelgrafik, 8 Farben, sichtbare Rasterzeilen, Systemmeldungen in Versalien. Upgrades heißen *Seite 20481 abrufen*. Extrem spezifisch, sehr witzig, und die technische Beschränkung (nur 8 Farben, alles kachelbasiert) **erzwingt** von allein Konsequenz — der stärkste Schutz gegen den generischen Look.

---

**Skizze 3 — Tiefsee-Sonar**

Absolute Dunkelheit, Sicht nur durch Ping-Impulse. Gegner sind Biolumineszenz. Palette: kaltes Weiß, Tiefblau, ein einzelnes giftiges Magenta für Gefahr. Sehr atmosphärisch, ähnliche Mechanik-Chance wie Skizze 1.

### C.3 Grafische Maßnahmen, die unabhängig vom Thema wirken

Diese fünf Punkte entfernen den generischen Eindruck auch ohne Themenwechsel — und **Punkt 1 ist gleichzeitig der größte Mobile-Performance-Gewinn im gesamten Projekt** (siehe [E.2](#e2--shadowblur-ist-der-teuerste-fehler)):

1. **`shadowBlur` ersetzen.** Statt Blur pro Objekt: Glow-Sprites einmalig in ein Offscreen-Canvas rendern und blitten, oder zwei bis drei konzentrische Striche mit fallender Deckkraft zeichnen. Sieht **besser** aus (harter Kern + weicher Halo statt gleichförmigem Matsch), ist art-direktierbar und läuft um ein Vielfaches schneller.

2. **Palette auf 4–5 Farben mit festen Rollen begrenzen.** Hintergrund / Spieler / Bedrohung / Belohnung / Akzent. Volle Sättigung nur für **eine** Rolle reservieren, dann trägt sie Bedeutung. Aktuell ist alles gleich laut, also ist nichts wichtig.

3. **Gegner über Silhouette und Bewegung unterscheiden, nicht über Farbton.** Der HSL-Shift ([Zeile 620](index.html#L620)) ist die billigste denkbare Differenzierung — und auf einem 5-Zoll-Display kaum lesbar. Stattdessen: ein Gegner aus drei rotierenden Strichsegmenten, einer als pulsierender hohler Ring, einer als zitterndes Punktecluster. **Bewegung ist die günstigste und unverwechselbarste Art Direction, die Canvas bietet** — und sie kostet keine Assets.

4. **Das Gitter reagieren lassen** oder streichen. Ein Hintergrund, der auf Kills pulsiert, sich zum Spieler hin verzerrt oder mit dem Takt der Schwierigkeit atmet, wirkt gestaltet. Ein statisches 50-px-Raster wirkt wie ein Platzhalter.

5. **Typografie differenzieren.** Orbitron für Überschriften ist in Ordnung; Zahlen (Score, Schaden, Timer) in einer Monospace setzen. Zahlen in einer breiten Displayschrift lesen sich wie Dekoration, Zahlen in Monospace wie **Daten** — und das ist es, was HUD-Werte sein sollen.

### C.4 Aufräumarbeiten

- Alle selbst-narrierenden Kommentare entfernen (C.1), `(NEW)`/`(UPDATED)` aus Überschriften streichen.
- „CLICK TO SELECT" ([Zeile 898](index.html#L898)) in einem Mobile-First-Spiel → „TIPPEN" oder ganz weg.
- README neu schreiben: Sie beschreibt ein `localStorage`-Mock-Backend und „Vorbereitung für Firebase Firestore" — tatsächlich läuft ein Redis-Leaderboard über Netlify Functions. Die Beschreibung ist überholt.
- Impressum: Es nennt **Firebase** als Datenempfänger ([impressum.html:63-64](impressum.html#L63-L64)). Eingesetzt wird Redis via `REDIS_URL` über Netlify Functions. **Das ist eine sachlich falsche Datenschutzerklärung** und sollte korrigiert werden — siehe [F.1](#f1--datenschutzerklärung-stimmt-nicht-mit-der-technik-überein).

---

## Teil D — Bugs, nach Schwere sortiert

### D.1 🔴 KRITISCH: Negative Cooldowns bei hoher Seltenheit

[Zeile 276](index.html#L276) und [Zeile 304](index.html#L304) verwenden `x *= (1 - (v * 0.5))` ohne jede Untergrenze. Bei hohen Seltenheitsmultiplikatoren wird der Faktor **negativ**:

| Seltenheit | `mult` | Overclock → `fireRate ×` | Dash Engine → `cooldown ×` |
|---|---:|---:|---:|
| Mythisch | 8.5 | 0.575 | 0.363 |
| Göttlich | 14.0 | 0.300 | **−0.050** 💥 |
| Transzendent | 25.0 | **−0.250** 💥 | **−0.875** 💥 |

**Folgen:**

- Negative `fireRate` → `now - this.lastShot > -100` ist **immer wahr** → die Waffe feuert **jeden Frame**, dauerhaft, unabhängig von der Waffe.
- Negative `dashCooldown` → der Dash ist **immer verfügbar**. Da [Zeile 574](index.html#L574) (`if (this.isDashing) return;`) Schaden während des Dashes komplett unterdrückt, bedeutet gedrückt gehaltener Dash-Button **permanente Unverwundbarkeit**.

Das ist mit hoher Wahrscheinlichkeit **die eigentliche Ursache deiner Beobachtung**, dass irgendwann keine Interaktion mehr nötig ist — und es ist kein seltener Sonderfall: Die Wahrscheinlichkeit für „Göttlich oder besser" liegt pro Karte bei **3–5 %**, bei 3 Karten pro Level-Up also bei ~10 % pro Level. Über 20 Level tritt es fast sicher mindestens einmal ein.

**Fix** — additive Stapelung mit natürlich abnehmendem Grenznutzen, mathematisch nie ≤ 0:

```js
// haste, Zeile 276
apply: (p, v) => {
    p.hasteStacks = (p.hasteStacks || 0) + v;
    p.stats.fireRate = 400 / (1 + p.hasteStacks);
}

// dash, Zeile 304
apply: (p, v) => {
    p.dashStacks = (p.dashStacks || 0) + v;
    p.stats.dashCooldown = Math.max(250, 2000 / (1 + p.dashStacks));
}
```

Zusätzlich sollte der Dash i-Frames zeitlich begrenzen statt an `isDashing` zu koppeln, damit ein kurzer Cooldown nicht zu Dauer-Immunität führen kann.

### D.2 🔴 KRITISCH: Das Spiel läuft auf 120-Hz-Geräten doppelt so schnell

Die gesamte Bewegungslogik nutzt `timeScale`, das **nur** für die Slow-Motion-Rampe gesetzt wird ([Zeile 934-939](index.html#L934-L939)) und sonst konstant `1.0` ist. Die verstrichene Zeit `dt` wird für Bewegung nie verwendet:

- [Zeile 484-485](index.html#L484-L485): `this.x += activeVector.x * moveSpeed * timeScale;`
- [Zeile 658](index.html#L658), [Zeile 732](index.html#L732), [Zeile 754](index.html#L754): Gegner, Projektile, Orbs — alle framebasiert
- [Zeile 853](index.html#L853): `spawnTimer--` pro Frame

**Auf jedem iPhone mit ProMotion (120 Hz), jedem iPad Pro und vielen Android-Flaggschiffen läuft das komplette Spiel mit doppelter Geschwindigkeit.** Bei Framedrops wird es entsprechend langsamer. Für ein Mobile-First-Spiel ist das der gravierendste technische Mangel — und vermutlich verwandt mit dem Bug, den du in `748a16d` („Speed nach Restart") behoben hast.

**Fix** — `timeScale` an die tatsächliche Framezeit koppeln:

```js
// in gameLoop, ersetzt Zeile 934
const frameScale = Math.min(dt / 16.667, 3);   // gedeckelt gegen Tab-Wechsel-Sprünge
let timeScale = frameScale;
if (state.resumeRampStart > 0) {
    const diff = performance.now() - state.resumeRampStart;
    if (diff < 1000) timeScale = frameScale * Math.max(0.1, diff / 1000);
    else state.resumeRampStart = 0;
}
```

Alle framebasierten Konstanten (Freeze `120`, Poison `180`, Bullet-`life`) bleiben dabei korrekt, weil sie ebenfalls mit `timeScale` dekrementiert werden. `spawnTimer--` muss zu `spawnTimer -= timeScale` werden.

### D.3 🟠 Kein `touchcancel`-Handler → Spieler läuft unkontrolliert weiter

[Zeile 1054](index.html#L1054) behandelt nur `touchend`. Kommt ein Anruf, eine Systembenachrichtigung oder eine Wischgeste dazwischen, feuert der Browser `touchcancel` — der Joystick bleibt aktiv, und die Figur läuft **dauerhaft in eine Richtung**, bis sie stirbt. Auf Mobile passiert das regelmäßig.

```js
controlsDiv.addEventListener('touchcancel', e => { /* gleiche Logik wie touchend */ });
```

### D.4 🟠 Kein Auto-Pause bei App-Wechsel

Es gibt keinen `visibilitychange`-Handler. Wechselt man die App, läuft `requestAnimationFrame` gedrosselt weiter; bei Rückkehr springt `dt` auf mehrere Sekunden und `state.elapsedTime` macht einen Sprung ([Zeile 942](index.html#L942)) — die Schwierigkeit schnellt hoch, während die Figur ungeschützt dastand. Auf Mobile ist App-Wechsel der Normalfall.

```js
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === 'PLAY') state.paused = true;
    lastTime = 0;   // dt-Sprung nach Rückkehr verhindern
});
```

Ein manueller Pause-Button fehlt ebenfalls komplett — auf Mobile praktisch unverzichtbar.

### D.5 🟠 Dash in reiner Vertikalrichtung geht diagonal

[Zeile 475](index.html#L475):

```js
this.dashVector = { x: dx || 1, y: dy };
```

Bei `dx === 0, dy === -1` (gerade nach oben) macht `dx || 1` daraus `x: 1` → **Diagonal-Dash statt nach oben**. Betrifft alle vier Achsenrichtungen und ist mit Tastatur wie Joystick reproduzierbar. Zusätzlich wird der Vektor nicht normalisiert: Ein leicht ausgelenkter Joystick erzeugt einen schwachen Dash.

```js
let dvx = dx, dvy = dy;
if (dvx === 0 && dvy === 0) dvx = 1;
const dl = Math.hypot(dvx, dvy) || 1;
this.dashVector = { x: dvx / dl, y: dvy / dl };
```

### D.6 🟡 Slow-Motion-Rampe verschenkt Gratis-Schaden

Nach jedem Level-Up läuft die Welt eine Sekunde lang bis zu 10× langsamer ([Zeile 934-939](index.html#L934-L939)) — aber `player.lastShot` nutzt `performance.now()` in Echtzeit ([Zeile 502](index.html#L502)). Der Spieler feuert also mit voller Rate in eine eingefrorene Welt. Bei häufigen Level-Ups ist das ein spürbarer Exploit. Fix: Schuss-Cooldown ebenfalls mit `timeScale` skalieren.

### D.7 🟡 Überheilung ohne Deckelung

[Zeile 290](index.html#L290): `p.stats.hp += v * 1.5;` ohne `Math.min(maxHp, …)`. Eine „Transzendent"-Karte gibt +500 Max-HP und heilt **750** — die HP-Leiste läuft über 100 % ([Zeile 826](index.html#L826) begrenzt die Breite nicht).

```js
p.stats.maxHp += v;
p.stats.hp = Math.min(p.stats.maxHp, p.stats.hp + v * 1.5);
```

### D.8 🟡 Das Luck-System bewirkt fast nichts

`getRarity` ([Zeile 308-331](index.html#L308-L331)) soll die Seltenheitschance mit dem Level steigern. Tatsächlich gemessen:

| Level | Gewöhnlich | Legendär | Göttlich | Transzendent |
|---:|---:|---:|---:|---:|
| 1 | 26.2 % | 8.4 % | 2.3 % | 0.6 % |
| 20 | 15.7 % | 11.0 % | 3.1 % | 0.9 % |
| 50 | 9.6 % | 12.5 % | 3.6 % | 1.1 % |

Zwei Befunde: Erstens bewegt sich fast nichts (Transzendent 0.6 % → 1.1 % über 50 Level). Zweitens — und wichtiger — **die Startverteilung ist viel zu großzügig**: Schon auf Level 1 ist jede vierte Karte „Legendär oder besser". Die Seltenheitsleiter hat damit von Anfang an kaum Bedeutung, und der „Aufstieg" ist nicht spürbar. Die Basisgewichte der oberen Stufen müssten drastisch sinken, damit die Level-Progression überhaupt Wirkung entfalten kann.

### D.9 🟡 Explosionsschaden ist O(n²)

[Zeile 979-986](index.html#L979-L986): Bei jedem Treffer einer Blast-Waffe wird über **alle** Gegner iteriert. Mit 20 Projektilen pro Schuss und 100 Gegnern sind das bis zu 2.000 Distanzprüfungen pro Frame — jede mit `takeDamage`, das seinerseits ein DOM-Popup erzeugt. Ein räumliches Raster (Grid-Bucketing) löst das; alternativ genügt vorerst eine Deckelung der betroffenen Gegner pro Explosion.

### D.10 🟢 Kleinere Punkte

- **Großbuchstaben-Steuerung:** [Zeile 1021](index.html#L1021) nutzt `input.keys[e.key]` — bei gehaltener Umschalttaste liefert `e.key` `'W'` statt `'w'`, die Steuerung setzt aus. `e.key.toLowerCase()` verwenden.
- **Toter CSS-Code:** `#joystick-zone` ([Zeile 60-70](index.html#L60-L70)) — das Element existiert im DOM nicht.
- **Nickname-Versalien:** Das Feld hat die Klasse `uppercase`, der Wert wird aber unverändert übernommen ([Zeile 1101](index.html#L1101)) — Anzeige und Speicherung weichen ab.
- **Poison skaliert an der Waffe vorbei:** [Zeile 650](index.html#L650) nutzt `player.stats.damage * 0.2` statt des Projektilschadens — der Effekt ignoriert die Waffe, an der er hängt.
- **`hitList` mit `includes`:** [Zeile 954](index.html#L954) — lineare Suche pro Gegner pro Frame; bei `pierce: 99` (Railgun) wächst die Liste. `Set` verwenden.
- **Kontakt-Tod umgeht `takeDamage`:** [Zeile 664](index.html#L664) setzt `hp = 0` direkt → kein Orb, kein Score, kein Partikel. Erledigt sich mit Fix [A.5.1](#a51-gegner-sollen-überleben-und-druck-aufbauen--größter-einzelhebel).
- **`pickupRange`-Kreis:** [Zeile 558](index.html#L558) zeichnet einen Kreis mit Radius `pickupRange`. Nach zwei Attractor-Karten (7.25× je „Transzendent") liegt der bei über 5.000 px — der Kreis verschwindet aus dem Bild, der Sog umfasst den gesamten Screen.

---

## Teil E — Mobile-Performance & Robustheit

Da Mobile-First die Vorgabe ist, hier die Punkte mit dem größten Messeffekt.

### E.1 Frame-Rate-Abhängigkeit

Siehe [D.2](#d2--kritisch-das-spiel-läuft-auf-120-hz-geräten-doppelt-so-schnell). Der wichtigste Punkt der gesamten Liste.

### E.2 `shadowBlur` ist der teuerste Fehler

`ctx.shadowBlur` wird gesetzt in `Player.draw` ([547](index.html#L547)), `Enemy.draw` ([676](index.html#L676)), `Bullet.draw` ([738](index.html#L738)) und `Orb.draw` ([764](index.html#L764)) — also **für jedes einzelne Objekt in jedem Frame**. Canvas-2D-Schatten sind auf mobilen GPUs mit Abstand die teuerste Operation; jeder Aufruf erzwingt einen separaten Rendering-Durchgang.

Bei 100 Gegnern + bis zu mehreren hundert Projektilen + Partikeln sind das über 500 Blur-Durchgänge pro Frame. Auf Mittelklasse-Android ist das der limitierende Faktor, lange bevor die Spiellogik es wäre.

**Fix** — Glow einmalig vorrendern und blitten:

```js
const glowCache = new Map();
function getGlowSprite(color, radius) {
    const key = color + '|' + radius;
    if (glowCache.has(key)) return glowCache.get(key);
    const s = document.createElement('canvas');
    const size = radius * 4;
    s.width = s.height = size;
    const g = s.getContext('2d');
    const grad = g.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0,    color);
    grad.addColorStop(0.35, color);
    grad.addColorStop(1,    'transparent');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, s);
    return s;
}
// im Draw: ctx.drawImage(getGlowSprite(this.color, this.radius), this.x - r*2, this.y - r*2);
```

Erwartete Größenordnung: **5–10× schnelleres Rendering** auf Mobilgeräten. Gleichzeitig sieht es besser aus (siehe [C.3](#c3-grafische-maßnahmen-die-unabhängig-vom-thema-wirken)) — der seltene Fall, in dem Performance- und Gestaltungsfix identisch sind.

### E.3 DOM-Zugriffe in der Spielschleife

`updateHud()` ([Zeile 824-835](index.html#L824-L835)) macht **sieben** `getElementById`-Aufrufe plus Style-Schreibvorgänge — und wird aufgerufen:

- jeden Frame ([Zeile 1015](index.html#L1015)),
- bei **jedem** Gegnertod ([Zeile 713](index.html#L713)),
- bei **jedem** XP-Gewinn ([Zeile 570](index.html#L570)),
- bei jedem Vampir-Proc ([Zeile 971](index.html#L971)).

Bei 40 Kills pro Sekunde sind das mehrere hundert Layout-relevante DOM-Schreibvorgänge pro Frame. Fixes:

1. Element-Referenzen **einmalig** in Konstanten auflösen.
2. Nur bei tatsächlicher Wertänderung schreiben (letzten Wert cachen).
3. Aus `takeDamage`/`gainXp` entfernen — der Frame-Aufruf genügt.
4. HUD auf ~10 Hz drosseln statt 60/120 Hz.

### E.4 Popup-Flut

`createPopup` wird bei **jedem einzelnen Treffer** aufgerufen ([Zeile 706](index.html#L706)) — plus bei jedem Gift-Tick ([Zeile 651](index.html#L651)). Mit 20 Projektilen und Splash-Schaden entstehen leicht mehrere hundert Popups pro Frame, jedes mit `ctx.font = '12px Orbitron'` (Font-Wechsel sind teuer) und `fillText`.

Sinnvoll: Popups pro Gegner **aggregieren** (Schaden aufaddieren, ein Popup aktualisieren), harte Obergrenze (~40 gleichzeitig), Font einmal pro Frame setzen. Bei sehr hohem DPS sind Einzelzahlen ohnehin nicht mehr lesbar.

### E.5 Kein `devicePixelRatio`

[Zeile 399-404](index.html#L399-L404) setzt `canvas.width = window.innerWidth` — also 1 CSS-Pixel = 1 Canvas-Pixel. Auf jedem modernen Telefon (DPR 2–3) wird das Bild hochskaliert und ist **sichtbar unscharf**. Das trägt spürbar zum „billigen" Eindruck bei.

Empfehlung: DPR bei **2** deckeln (bei DPR 3 wären es die 9-fache Pixelmenge) — und erst **nach** dem `shadowBlur`-Fix aktivieren, sonst frisst der Gewinn aus E.2 sich selbst auf.

```js
function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width  = window.innerWidth;
    height = window.innerHeight;
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
```

### E.6 Speicherzuweisung pro Frame

[Zeile 946-1006](index.html#L946-L1006) erzeugt mit `Array.filter` **fünf neue Arrays pro Frame**, dazu laufend `new Particle`/`new Popup`. Auf Mobilgeräten führt das zu GC-Pausen, die sich als Mikroruckler zeigen. Abhilfe: In-Place-Kompaktierung (Rückwärts-Schleife mit `splice`) oder Objekt-Pools für Partikel und Projektile.

### E.7 iOS-Viewport

`window.innerHeight` ändert sich auf iOS Safari beim Ein-/Ausblenden der Adressleiste und feuert `resize` mitten im Spiel. Empfehlung: `visualViewport`-API oder `100dvh`, plus Entprellung von `resize`.

### E.8 Netzwerk-Last beim Start

`cdn.tailwindcss.com` ([Zeile 8](index.html#L8)) ist der **Laufzeit-Compiler** (~100 KB JS), der bei jedem Seitenaufruf CSS im Browser generiert. Er ist ausdrücklich nicht für den Produktivbetrieb gedacht. Dazu kommt Google Fonts über `@import` ([Zeile 12](index.html#L12)), das den Renderpfad blockiert.

Da das Spiel nur eine Handvoll Tailwind-Klassen nutzt, wäre der sauberste Weg: **benötigtes CSS inline schreiben** (schätzungsweise 2–3 KB) und die Schrift selbst hosten. Ergebnis: schnellerer Start auf Mobilfunk, kein FOUC — und die beiden CDN-Abschnitte der Datenschutzerklärung entfallen ersatzlos.

### E.9 Weitere Mobile-Punkte

- **Kein Wake Lock:** Der Bildschirm schaltet sich während des Spiels ab, wenn nicht getippt wird — was im aktuellen Endgame buchstäblich der Normalfall ist. `navigator.wakeLock.request('screen')` behebt das.
- **`user-scalable=no`** ([Zeile 5](index.html#L5)): blockiert Zoom, was ein Accessibility-Problem ist. Für ein Canvas-Spiel vertretbar, aber `touch-action: none` allein würde genügen.
- **Level-Up-Karten auf kleinen Displays:** `flex-col` unter 768 px mit `p-6` je Karte ([Zeile 120](index.html#L120)) — auf einem iPhone SE (375 × 667) wird es eng, und `body { overflow: hidden }` verhindert Scrollen. Die dritte Karte kann unerreichbar werden. Kompakteres Padding unter `sm` oder `overflow-y: auto` auf dem Container.
- **Kein Haptik-Feedback:** `navigator.vibrate(10)` bei Treffern/Level-Up ist auf Android eine sehr günstige Verbesserung des Spielgefühls.

---

## Teil F — Sonstiges

### F.1 Datenschutzerklärung stimmt nicht mit der Technik überein

[impressum.html:63-64](impressum.html#L63-L64) nennt **Firebase (Google)** als Empfänger der Highscore-Daten mit Verarbeitung in den USA. Tatsächlich schreiben [save-scores.js](netlify/functions/save-scores.js) und [get-scores.js](netlify/functions/get-scores.js) in eine **Redis-Instanz** über `process.env.REDIS_URL`. Firebase kommt im gesamten Projekt nicht vor.

Die Erklärung muss den tatsächlichen Dienst, dessen Standort und die Speicherdauer benennen. Da eine Adresse im Impressum steht, ist das kein rein kosmetischer Punkt.

Ebenfalls anzupassen: Die Abschnitte zu Google Fonts und Tailwind CDN entfallen, sobald [E.8](#e8-netzwerk-last-beim-start) umgesetzt ist — was den einfachsten Weg zur Korrektheit darstellt.

### F.2 Bestenliste ist manipulierbar

`saveHighscore` ([Zeile 156](index.html#L156)) wird clientseitig aufgerufen; die serverseitige Prüfung in [save-scores.js:13](netlify/functions/save-scores.js#L13) validiert nur den Typ. Ein `fetch` aus der Browser-Konsole genügt für einen beliebigen Score.

Vollständig lösbar ist das bei einem reinen Client-Spiel nicht. Pragmatisch machbar:

- **Plausibilitätsprüfung serverseitig:** Spieldauer mitschicken und gegen einen realistischen Maximalscore prüfen (`score <= f(dauer)`).
- **Rate-Limiting** pro IP.
- Ein einfaches HMAC über `(name, score, dauer)` erhöht die Hürde, ohne echte Sicherheit zu bieten.

Für ein Hobbyprojekt ist Plausibilitätsprüfung + Rate-Limiting der richtige Aufwand.

### F.3 Redis-Verbindung pro Request

Beide Functions öffnen eine neue Redis-Verbindung pro Aufruf ([save-scores.js:17](netlify/functions/save-scores.js#L17), [get-scores.js:5](netlify/functions/get-scores.js#L5)) und rufen `client.quit()` ohne `await` auf. Bei Lastspitzen kann das Verbindungen erschöpfen. Client außerhalb des Handlers instanziieren (Wiederverwendung zwischen warmen Invocations) und `await client.quit()` bzw. dauerhaft offen lassen.

Zusätzlich: `get-scores.js` liefert im Fehlerfall Status 500 **mit** leerem Array — der Client behandelt beides schon korrekt, aber Status 200 mit leerer Liste wäre sauberer.

### F.4 Bestenliste wächst unbegrenzt

`zadd` fügt jeden Score als eigenes Member hinzu ([save-scores.js:20](netlify/functions/save-scores.js#L20)), mit `Date.now()` im Schlüssel. Das Sorted Set wächst dauerhaft, obwohl nur Top 10 gelesen werden. Ein `ZREMRANGEBYRANK neon_leaderboard 0 -101` nach jedem Schreiben begrenzt es auf 100 Einträge.

---

## Umsetzungsreihenfolge

Nach Wirkung-pro-Aufwand. Die ersten beiden Blöcke verändern das Spielerlebnis bereits deutlich.

### Block 1 — Fundament (halber Tag, sehr hohe Wirkung)

| # | Maßnahme | Ref |
|---|---|---|
| 1 | Negative Cooldowns beheben | [D.1](#d1--kritisch-negative-cooldowns-bei-hoher-seltenheit) |
| 2 | `timeScale` an `dt` koppeln | [D.2](#d2--kritisch-das-spiel-läuft-auf-120-hz-geräten-doppelt-so-schnell) |
| 3 | `touchcancel` + `visibilitychange` + Pause-Button | [D.3](#d3--kein-touchcancel-handler--spieler-läuft-unkontrolliert-weiter), [D.4](#d4--kein-auto-pause-bei-app-wechsel) |
| 4 | Dash-Vektor korrigieren | [D.5](#d5--dash-in-reiner-vertikalrichtung-geht-diagonal) |
| 5 | Überheilung deckeln | [D.7](#d7--überheilung-ohne-deckelung) |

### Block 2 — Der Spielspaß-Kern (1–2 Tage, beantwortet deine Hauptfrage)

| # | Maßnahme | Ref |
|---|---|---|
| 6 | Gegner überleben Kontakt, Treffer-Cooldown + Rückstoß | [A.5.1](#a51-gegner-sollen-überleben-und-druck-aufbauen--größter-einzelhebel) |
| 7 | XP-Kurve abflachen — Karten hören nie auf | [A.5.4](#a54-xp-kurve-flach-genug-halten-dass-karten-nie-aufhören) |
| 8 | Reroll & Banish | [A.5.5](#a55-reroll--banish--bestes-aufwand-nutzen-verhältnis) |
| 9 | Streuung an Projektilzahl koppeln | [B.5.2](#b52-streuung-an-projektilzahl-koppeln) |
| 10 | Gegner-Speed-Skalierung anheben | [A.5.2](#a52-gegner-geschwindigkeit-realistisch-skalieren-aber-gedeckelt) |
| 11 | Seltenheits-Grundgewichte straffen | [D.8](#d8--das-luck-system-bewirkt-fast-nichts) |

### Block 3 — Mobile-Performance (1 Tag)

| # | Maßnahme | Ref |
|---|---|---|
| 12 | `shadowBlur` → Glow-Sprites | [E.2](#e2--shadowblur-ist-der-teuerste-fehler) |
| 13 | HUD-DOM-Zugriffe cachen und drosseln | [E.3](#e3-dom-zugriffe-in-der-spielschleife) |
| 14 | Popups aggregieren und deckeln | [E.4](#e4-popup-flut) |
| 15 | `devicePixelRatio` (nach 12) | [E.5](#e5-kein-devicepixelratio) |
| 16 | Tailwind/Fonts inline statt CDN | [E.8](#e8-netzwerk-last-beim-start) |
| 17 | Wake Lock, Vibration, Karten-Layout klein | [E.9](#e9-weitere-mobile-punkte) |

### Block 4 — Tiefe (mehrere Tage, das eigentliche Spiel)

| # | Maßnahme | Ref |
|---|---|---|
| 18 | Pakt-System | [A.5.6](#a56-pakt-system-freiwillig-die-schwierigkeit-zurückholen--beantwortet-dein-anliegen-am-direktesten) |
| 19 | Waffen-Exklusivmechaniken | [B.5.1](#b51-waffen-bekommen-exklusive-mechaniken-statt-nur-zahlen-) |
| 20 | Neue Gegnertypen (Schütze, Kreiser) | [A.5.3](#a53-gegnertypen-die-anders-funktionieren-als-lauf-geradeaus) |
| 21 | Waffen-Slots + Seltenheit wirkt auf Waffen | [B.5.3](#b53-waffen-slots-statt-ersetzen) |
| 22 | Statuseffekt-Synergien | [B.5.6](#b56-synergien-zwischen-statuseffekten) |
| 23 | Offensive Nebenstats | [B.5.4](#b54-die-langweiligen-stats-offensiv-machen-) |
| 24 | Kill-Combo-Score | [A.5.7](#a57-score-der-können-abbildet) |

### Block 5 — Identität

| # | Maßnahme | Ref |
|---|---|---|
| 25 | Thema festlegen, Vokabular ableiten | [C.2](#c2-die-idee-eine-spezifische-festlegung-konsequent-durchgehalten) |
| 26 | Palette auf 4–5 Farben mit Rollen | [C.3](#c3-grafische-maßnahmen-die-unabhängig-vom-thema-wirken) |
| 27 | Gegner über Silhouette/Bewegung differenzieren | [C.3](#c3-grafische-maßnahmen-die-unabhängig-vom-thema-wirken) |
| 28 | Selbst-narrierende Kommentare entfernen | [C.4](#c4-aufräumarbeiten) |
| 29 | README aktualisieren | [C.4](#c4-aufräumarbeiten) |

### Block 6 — Rechtliches & Backend

| # | Maßnahme | Ref |
|---|---|---|
| 30 | Datenschutzerklärung korrigieren (Firebase → Redis) | [F.1](#f1-datenschutzerklärung-stimmt-nicht-mit-der-technik-überein) |
| 31 | Score-Plausibilisierung + Rate-Limiting | [F.2](#f2-bestenliste-ist-manipulierbar) |
| 32 | Redis-Verbindung wiederverwenden, Liste trimmen | [F.3](#f3-redis-verbindung-pro-request), [F.4](#f4-bestenliste-wächst-unbegrenzt) |

---

## Der eine Satz

Wenn nur eine Sache umgesetzt wird, dann [D.1](#d1--kritisch-negative-cooldowns-bei-hoher-seltenheit) — die negativen Cooldowns. Sie erzeugen permanente Unverwundbarkeit und unendliche Feuerrate und sind mit hoher Wahrscheinlichkeit die konkrete technische Ursache hinter dem Eindruck, dass irgendwann keine Interaktion mehr nötig ist.

Wenn zwei: zusätzlich [A.5.4](#a54-xp-kurve-flach-genug-halten-dass-karten-nie-aufhören) — die XP-Kurve. Sie bestimmt, ob das Spiel überhaupt weiter Entscheidungen von dir verlangt.
