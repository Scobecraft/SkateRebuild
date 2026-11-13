# Concrete Flow

Ein eigenständiges 3D-Skateboard-Spiel für **Windows 10 und 11** mit Flick-Trick-Steuerung, einem riesigen Megapark, dynamischem Wetter, Tag-Nacht-Zyklus, NPC-Skatern, Replay- und Fotomodus.

> Concrete Flow ist ein eigenes Spiel. Charaktere, Park-Layout, Musik und Grafiken sind eigene Entwürfe. Fototexturen und 3D-Props stammen aus der freien CC0-Bibliothek von Poly Haven (siehe unten).

## Download & Installation (Windows)

1. Unter **Releases** (oder im Reiter **Actions → Windows-Build → Artefakte**) die neueste Version laden:
   - `ConcreteFlow-…-Setup.exe` – Installer mit Startmenü- und Desktop-Verknüpfung
   - `ConcreteFlow-…-Portable.exe` – ohne Installation direkt starten
2. Starten, Controller anschließen, losfahren.

Windows SmartScreen kann beim ersten Start warnen, weil die EXE nicht signiert ist: **Weitere Informationen → Trotzdem ausführen**.

## Features

- **Flick-Steuerung** über den rechten Stick oder die Maus: Ollie, Kickflip, Heelflip, 360 Shove-It, Varial Kickflip, 360 Flip, Hardflip
- **Grinds und Slides** mit Balance (50-50, Boardslide, Crooked, Smith, Rock'n'Roll …), Grabs, Spins, Fakie-Landungen
- **Megapark** mit 16-m-Drop-in-Turm, Mega-Kicker und Gap, 7,5-m-Giga-Quarter, Halfpipe, Mini-Ramp, drei Bowls mit Coping, Street-Plaza mit Treppen, Handrails, Ledges, Hubba, Funbox und Banks
- **Punkte, Combos, Streaks, XP und Level**: Combos landen bringt Punkte und XP. Jede saubere Combo erhöht den Streak (+10 % Bonus pro Stufe, maximal +100 %). Über Level steigt man im Rang auf (Rookie bis Legende) und schaltet Outfits frei.
- **17 Challenges**, Highscore-Session (3 Minuten) und Free Skate
- **Tag-Nacht-Zyklus**: physikalischer Himmel mit Sonne, Mond und Sternen. Nachts gehen Flutlichter, Laternen und die Fenster der Skyline an.
- **Wetter**: klar, bewölkt, Regen (nasser, spiegelnder Boden), Gewitter mit Blitz und Donner, Nebel. Das Wetter wechselt automatisch oder lässt sich festlegen.
- **Map-Editor**: eigene Skateparks bauen – auf leerer Fläche oder mit dem Megapark als Basis
- **Realistischer Skater** mit echtem 3D-Kopfscan, anatomischem Körper, Händen mit Fingern, Hoodie, Jeans und Sneakern
- **NPC-Skater**, die durch den Park fahren, Tricks machen, die Halfpipe fahren und in den Bowls carven
- **Replay der letzten 2 Minuten** mit Zeitleiste, Zeitlupe, Einzelbild und frei fliegender Kamera
- **Fotomodus** mit Freecam, FOV, Belichtung, Filtern, Vignette, Uhrzeit- und Wetterregler. Fotos landen unter `Bilder\Concrete Flow`.
- **Controller**: Xbox, PlayStation und andere über XInput/Gamepad-API, mit **Vibration** bei Pop, Landung, Grind, Sturz und Donner
- **Musik und Sounds**: drei eigene, prozedural generierte Tracks (Lo-Fi, Punk, Boom-Bap) und synthetisierte Soundeffekte (Rollen, Grind, Wind, Regen …)
- **Grafik**: PBR-Fototexturen in 2K, HDR-Rendering mit SSAO, Bloom, ACES-Tonemapping, Farbkorrektur, FXAA, weiche 4K-Schatten und Umgebungsreflexionen. Drei Qualitätsstufen: Ultra, Hoch, Leistung.

## Steuerung

| Aktion | Controller | Tastatur / Maus |
|---|---|---|
| Anschieben / Bremsen | Ⓐ oder RT / Ⓑ oder LT | W / S |
| Lenken, Spin, Balance | Linker Stick | A / D |
| Ollie | Rechter Stick ↓ dann ↑ | Maus halten und ↓↑ ziehen, oder Leertaste |
| Kickflip / Heelflip | ↓ dann ↖ / ↗ | J / K |
| 360 Shove-It / Varial | ↓ dann ← / → | L / U |
| 360 Flip / Hardflip | Halbkreis ↓←↑ / ↓→↑ | I / O |
| Grabs | LB / RB | Q / E |
| Replay / Fotomodus | Steuerkreuz ↑ / ↓ | V / F |
| Reset · Pause · Kamera | View · Menu · R3 | R · Esc · C |
| Musik · Challenges | Ⓨ · Ⓧ | M · Tab |

## Map-Editor

Hauptmenü → **🛠 Map-Editor** → neue Map (leere Fläche oder Megapark-Basis) oder bestehende Map bearbeiten.

- **Objekte:** Kicker, Quarterpipe, Bank, Halfpipe, Spine, Funbox, Pyramide, Box/Manual-Pad, Ledge, Rail, Treppe mit Handrail, Betonbarriere, Bänke, Mülleimer, Pflanzkasten, Hydrant und Startpunkt. Höhe, Länge und Breite sind über Regler einstellbar.
- **Bearbeiten:** Platzieren auf einem 0,5-m-Raster, Drehen in 90°-Schritten, Verschieben, Duplizieren, Löschen, Undo/Redo.
- **Testfahrt** direkt aus dem Editor. Esc bringt dich zurück.
- **Speichern** im Spiel. **Export/Import** als `.cfmap.json`. Exportierte Maps landen unter `Dokumente\Concrete Flow\Maps` und lassen sich mit Freunden teilen.
- Eigene Maps spielst du über **Hauptmenü → Eigene Maps spielen**, als Free Skate oder Highscore-Session.

| Aktion | Maus / Tastatur | Controller |
|---|---|---|
| Objekt setzen / auswählen | Linksklick | Ⓐ |
| Kamera drehen / schieben / zoomen | Rechts ziehen / Shift+Rechts oder Mitte ziehen / Mausrad, WASD, Q/E | R-Stick / L-Stick / LT, RT |
| Drehen · Verschieben · Löschen | R · G · Entf | Ⓧ · – · Ⓑ |
| Objekt wählen | 1–9, Palette | LB / RB |
| Werte ändern | Regler oder [ ] | Steuerkreuz |
| Undo · Redo · Speichern · Duplizieren | Strg+Z · Strg+Y · Strg+S · Strg+D | – |
| Testfahrt | T | Ⓨ |

## Für Admins: verstecktes Modmenü

Das Modmenü ist in keinem Menü sichtbar. Es öffnet sich so:

- auf der Tastatur **`flowadmin`** tippen, oder
- **Strg + Umschalt + F10**, oder
- am Controller **LB + RB + LT + RT** halten und **R3** klicken

Das Menü bietet: God-Mode, unendliche Grind-Balance, Schwerkraft (Mond bis schwer), Pop-Stärke, Tempo, Zeitlupe, Uhrzeit, Tageslänge, Wetter, Anzahl der NPCs, Teleport, Level und XP, alle Outfits oder Challenges freischalten sowie eine Debug-Anzeige mit FPS.

## Entwicklung

```bash
npm install
npm start            # Spiel in Electron starten
npm run dist:win     # Windows-Installer + Portable-EXE nach dist/
```

Im Browser spielen: Den Ordner `game/` über einen lokalen Webserver ausliefern, zum Beispiel mit `python -m http.server` in `game/`, und `http://localhost:8000` öffnen.

Bei jedem Push auf `main` baut GitHub Actions automatisch die Windows-Version. Bei Tags (`v*`) entsteht zusätzlich ein GitHub-Release.

### Struktur

```
main.js              Electron-Hauptprozess (app://-Protokoll, Foto-Speicherort)
game/index.html      Oberfläche
game/lib/            Three.js r149 (MIT) + Addons
game/js/audio.js     Soundeffekte + prozedurale Musik
game/js/input.js     Controller, Tastatur, Maus, Flick-Erkennung, Vibration
game/js/world.js     Megapark, Physik-Oberflächen, Texturen, Bäume, Skyline
game/js/env.js       Tag-Nacht-Zyklus, Himmel, Wetter, Nachtbeleuchtung
game/js/player.js    Skate-Physik, Tricks, Grinds, Bails
game/js/skater.js    Charaktermodell + Animation
game/js/npc.js       NPC-Skater
game/js/props.js     3D-Props (Bänke, Barrieren, Zäune …)
game/js/progress.js  XP, Level, Streaks, Freischaltungen
game/js/replay.js    Replay-Aufnahme + Freecam
game/js/photo.js     Fotomodus
game/js/admin.js     Verstecktes Modmenü
game/js/editor.js    Map-Editor
game/js/game.js      Spielablauf, HUD, Menüs, Post-Processing
```

## Lizenzen / Credits

- Code: MIT
- [Three.js](https://threejs.org) r149: MIT-Lizenz (`game/lib/THREE_LICENSE`)
- Texturen und 3D-Modelle: [Poly Haven](https://polyhaven.com), Lizenz **CC0** (gemeinfrei). Verwendet wurden: concrete_floor_02, rough_concrete, wood_planks, red_bricks_04, asphalt_track, sparse_grass, cotton_jersey, denim_fabric, leather_white, bark_brown_02, rectangular_facade_tiles_02, concrete_road_barrier, painted_wooden_bench, modular_street_seating, metal_trash_can, fire_hydrant, planter_box_01 und modular_chainlink_fence.
- Kopf des Skaters: „Lee Perry-Smith Head“ von Infinite Realities (Lee Perry-Smith), Lizenz [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Bezogen über das Three.js-Beispielarchiv, zugeschnitten (Schultern entfernt) und mit Cap und Sonnenbrille kombiniert.
- Musik und Sounds: zur Laufzeit synthetisiert, eigene Kompositionen
