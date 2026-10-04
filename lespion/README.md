# LE SPION

Ein Ratespiel für [perchance.org](https://perchance.org), gebaut auf der Technik von PROXIMA.
Vier Leute sitzen am Tisch. Drei kennen einen geheimen Begriff, einer ist der **Spion** und kennt nur
die Kategorie. Reihum gibt jeder einen kurzen Hinweis. Die Wissenden wollen den Spion entlarven,
ohne ihm den Begriff zu verraten. Der Spion will unauffällig bleiben und den Begriff erraten.

Aktueller Stand: **Einzelspieler** – du und drei KI-Agenten. Mehrspieler ist noch nicht gebaut
(siehe unten).

| Datei | Rolle |
|---|---|
| `lespion.html` | Die **Ladeschale**. Einmal in den HTML-Bereich des Perchance-Generators kopieren. |
| `lespion.app.html` | Das **komplette Spiel**: Stil, Markup und Skript. Hier wird gearbeitet. |
| `test/logik.test.js` | Prüft Spiellogik, Prompts und Ladeschale ohne Netz und ohne Browser. |

## Einrichten in Perchance

1. Neuen Generator anlegen.
2. **Linke Seite** (Listen-Bereich): die beiden Plugins einbinden, genau wie bei PROXIMA:
   ```
   ai = {import:ai-text-plugin}
   image = {import:text-to-image-plugin}
   ```
3. **Rechte Seite** (HTML-Bereich): den kompletten Inhalt von `lespion.html` einfügen.
4. Speichern. Ab jetzt holt die Ladeschale bei jedem Aufruf `lespion/lespion.app.html` aus dem
   Zweig `main` dieses Repositorys. Ein Push nach `main` ist also nach etwa einer Minute live.

Einen anderen Zweig ausprobieren, ohne `main` anzufassen: `#lsp-zweig=zweigname` an die
Generator-Adresse hängen. Mit `#lsp-zweig=standard` geht es zurück. In der Browserkonsole gibt es
dafür `LESPION_LADER.neu()`, `LESPION_LADER.plugins()` und `LESPION_LADER.vergiss()`, wie bei PROXIMA.

Das Repository muss **öffentlich** sein, sonst liefert `raw.githubusercontent.com` nur 404.

## Regeln

1. Rollen und Begriff werden zufällig verteilt. Auch du kannst der Spion sein.
2. Alle sehen die **Kategorie**. Wer kein Spion ist, sieht außerdem den **Begriff**.
3. Es gibt 2 bis 5 **Runden**. In jeder Runde gibt jeder, im Uhrzeigersinn um das 2×2-Raster,
   **einen Hinweis** mit höchstens acht Wörtern ab. Den Begriff selbst oder einen Wortteil davon
   zu nennen ist gesperrt; das Spiel lehnt solche Hinweise ab.
4. Der Spion darf **jederzeit einmal verdeckt raten**. Liegt er richtig, gewinnt er sofort. Liegt
   er falsch, verliert er sofort.
5. Nach der letzten Runde **stimmen alle ab**. Gleichstand oder falsche Mehrheit: Der Spion gewinnt.
6. Wird der Spion enttarnt, hat er **einen letzten Rateversuch**. Trifft er, gewinnt er trotzdem.

Optional gibt es ein **Zeitlimit pro Zug** (30 bis 120 s). Läuft es ab, wird abgeschickt, was im
Feld steht. Ist das Feld leer, „schweigt" der Spieler in dieser Runde.

Beim Raten werden Groß- und Kleinschreibung, Artikel, Plural, Umlaut-Schreibweisen
(`ue` statt `ü`) und bei längeren Wörtern ein Tippfehler toleriert.

## Die KI-Agenten

Jeder Agent bekommt bei jedem Schritt (Hinweis, Abstimmung, letzter Tipp) einen **eigenen**
`ai()`-Aufruf. Darin steht nur, was er selbst wissen darf:

* seine eigene Rolle,
* die Kategorie und, falls er kein Spion ist, den Begriff,
* die öffentlichen Hinweise aller Spieler,
* seine **eigenen** privaten Notizen aus früheren Zügen.

Wer sonst Spion ist und was die anderen Agenten notiert haben, steht in keinem seiner Prompts.
Der Test prüft das ausdrücklich. Verdächtigungen entstehen also nur aus den Hinweisen. Nach der
Partie zeigt **WAS DIE KI DACHTE** die privaten Notizen jedes Agenten.

Wenn ein Agent den Begriff ausplaudert, verwirft das Spiel den Hinweis und fragt bis zu zweimal neu.
Danach kommt ein neutraler Ersatzsatz, damit das Spiel nicht hängen bleibt. Ein KI-Spion rät
frühestens ab Runde 2, und nur wenn er sich zu mindestens 85 % sicher ist (`SPION_SCHWELLE`).

Die Qualität der Hinweise und Verdächtigungen hängt am Text-Modell von Perchance. Rechne mit
soliden, nicht mit brillanten Gegnern.

## Porträts

* Vier Porträts im 2×2-Raster. Jedes wird **einzeln** über das Perchance-Plugin `image()`
  gezeichnet, und zwar **auf dem eigenen Rechner**.
* Nach jedem Zug zeichnet der Rechner das Porträt des Sprechers neu, mit **neuer Miene** (vom
  Agenten gewählt, beim Menschen wählbar oder automatisch) und **neuer Kopfhaltung**. Am Ende
  jubeln die Gewinner und die Verlierer schauen enttäuscht.
* Jede Person behält ihren Seed. Das Gesicht bleibt dadurch ähnlich, aber nicht identisch: Eine
  andere Miene im Prompt verändert das Bild immer etwas.
* Es wird immer nur ein Bild gleichzeitig angefordert. Hat jemand mehrere Aufträge offen, zählt
  nur der neueste.
* Der **Bildstil** ist auf dem Startbildschirm und während der Partie (🎨 STIL) wählbar, auch als
  eigener Stiltext. Fremde Bildquellen wie in PROXIMA gibt es bewusst nicht.

## Mehrspieler: noch offen

Geplant: Chat und Tisch über die Mittel von Perchance (Kommentar-Plugin), jeder Rechner zeichnet
seine Porträts selbst. Zwei Punkte sind vor dem Bau zu klären:

* Kommentare im Perchance-Kommentar-Plugin sind **öffentlich und bleiben stehen**. Für Hinweise und
  Chat passt das. Geheime Daten (Begriff, Rolle) dürfen aber nicht darüber laufen.
* Ob das Plugin fremde Kommentare per Skript liefert (für Zugwechsel und Abstimmung), muss ich
  in einem echten Perchance-Generator prüfen. Aus der Entwicklungsumgebung ist perchance.org
  nicht erreichbar.

## Test

```
node test/logik.test.js
```

Er läuft bei jedem Push und Pull Request, der `lespion/` betrifft (`.github/workflows/lespion.yml`).
Er spielt mehrere komplette Partien mit gestellter KI durch und prüft dabei Sieg und Niederlage,
die Reihenfolge, den Filter gegen ausgeplauderte Begriffe und die Trennung der Agenten-Prompts.
