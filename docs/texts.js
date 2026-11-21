// Daily family texts on the start page. Edit or add freely; a general one is picked at random on each visit, special days stay fixed.
window.DAILY_TEXTS = {
  general: [
    "Familie ist der Ort, an dem man nichts beweisen muss, um geliebt zu werden.",
    "Das schönste Geschenk steht auf keiner Liste: Zeit miteinander.",
    "Egal wie weit wir auseinander wohnen, an Weihnachten rücken wir zusammen.",
    "Ruf heute doch mal jemanden aus der Familie an. Einfach so.",
    "Wir sind nicht perfekt, aber wir sind füreinander da. Und das reicht.",
    "Ein Wunschzettel ist auch ein kleiner Liebesbrief: Er sagt, ich vertraue darauf, dass ihr mich kennt.",
    "Gemeinsam lachen, gemeinsam essen, mal streiten und uns wieder vertragen. So geht Familie.",
    "Die schönsten Erinnerungen entstehen oft am Küchentisch, nicht unterm Weihnachtsbaum.",
    "Danke, dass ihr da seid. Das sagt man viel zu selten.",
    "Eine Kerze verliert nichts, wenn sie eine andere anzündet. Mit Liebe ist es genauso.",
    "Wer eine Familie hat, hat immer einen Ort, an den er zurückkehren kann.",
    "Heute ist ein guter Tag, um jemandem zu sagen, dass er dir wichtig ist.",
    "Kleine Gesten wärmen oft mehr als große Geschenke.",
    "Wir teilen nicht nur Plätzchen, sondern Geschichten, die sonst niemand kennt.",
    "Familie heißt: Einer fängt den anderen auf, auch wenn es mal holpert.",
    "Vorfreude ist das halbe Fest. Und mit euch ist sie doppelt so groß.",
    "Was zählt, ist nicht, was unter dem Baum liegt, sondern wer drumherum sitzt.",
    "Manche Traditionen sind alt, manche beginnen gerade. Welche fangen wir dieses Jahr an?",
    "Zusammenhalt ist, wenn keiner fragt, ob er helfen soll, sondern einfach mit anpackt.",
    "Ein warmes Wort kostet nichts und bleibt lange im Herzen.",
    "Wir müssen nicht immer einer Meinung sein, um zusammenzugehören.",
    "Schreib heute jemandem aus der Familie eine liebe Nachricht. Es wird ihn freuen.",
    "Die Lichter draußen leuchten heller, wenn es drinnen warm ist.",
    "Jeder von uns ist ein Teil des Ganzen. Ohne dich wäre es nicht dasselbe.",
    "Geschenke packt man aus. Liebe packt man ein, jeden Tag ein bisschen mehr.",
    "Familie ist unser erstes Zuhause und oft das, das wir am meisten brauchen.",
    "Erinnerst du dich an ein Weihnachten von früher? Erzähl es beim nächsten Treffen.",
    "Zeit verschenken heißt: Ich habe an dich gedacht, bevor du fragen musstest.",
    "Wir wachsen, wir verändern uns, aber wir bleiben verbunden.",
    "Ein volles Haus ist manchmal anstrengend. Aber es ist das schönste Geräusch der Welt.",
    "Verzeihen ist auch ein Geschenk, vielleicht sogar das wertvollste.",
    "Gemeinsam ist man nie ganz allein, auch nicht an grauen Dezembertagen.",
    "Was wir füreinander tun, bleibt, auch wenn das Geschenkpapier längst weg ist.",
    "Familie ist, wenn jemand weiß, wie du deinen Tee trinkst.",
    "Ein bisschen Geduld, ein bisschen Humor und viel Herz: das Rezept für schöne Feiertage.",
    "Freu dich heute über etwas Kleines. Das Große kommt von ganz allein.",
    "Wer anderen eine Freude macht, beschenkt sich gleich mit.",
    "Unsere Familie ist wie eine Lichterkette: Jedes Licht macht das Ganze heller.",
    "Das Beste an Weihnachten? Dass wir es zusammen feiern.",
    "Heute schon gelacht? Familie ist der beste Grund dafür.",
  ],
  // 1. to 4. Advent; these win over every other text on that Sunday.
  advent: [
    "Erster Advent: Die erste Kerze brennt. Möge sie uns daran erinnern, wie schön es ist, zusammenzugehören.",
    "Zweiter Advent: Zwei Lichter, doppelte Wärme. Wie gut, dass wir einander haben.",
    "Dritter Advent: Drei Kerzen brennen, und das Fest ist ganz nah. Danke, dass ihr meine Familie seid.",
    "Vierter Advent: Alle Kerzen leuchten. Bald sitzen wir zusammen, und darauf freuen wir uns am meisten.",
  ],
  // "month-day"
  special: {
    "12-6": "Nikolaustag: Heute darf man sich freuen wie ein Kind. Wer hat die Stiefel geputzt?",
    "12-24": "Frohe Weihnachten! Das größte Geschenk sind wir füreinander. Schön, dass es dich gibt.",
    "12-25": "Erster Feiertag: Zeit für Ruhe, gutes Essen und die Menschen, die man liebt.",
    "12-26": "Zweiter Feiertag: Noch ein Stück Kuchen, noch eine Geschichte, noch ein bisschen beisammen sein.",
    "12-31": "Silvester: Danke für dieses Jahr mit euch. Auf ein neues voller gemeinsamer Momente!",
  },
};

window.dailyTextFor = (date) => {
  const T = window.DAILY_TEXTS;
  const y = date.getFullYear();
  const day = new Date(y, date.getMonth(), date.getDate());
  const eve = new Date(y, 11, 24);
  const fourthAdvent = new Date(y, 11, 24 - eve.getDay());
  const key = `${date.getMonth() + 1}-${date.getDate()}`;
  if (key === "12-24") return T.special[key]; // Christmas Eve beats a 4th Advent on the same Sunday
  for (let n = 1; n <= 4; n++) {
    const sunday = new Date(fourthAdvent);
    sunday.setDate(fourthAdvent.getDate() - (4 - n) * 7);
    if (sunday.getTime() === day.getTime()) return T.advent[n - 1];
  }
  if (T.special[key]) return T.special[key];
  // A new random text on every visit, never the same one twice in a row.
  let last = -1;
  try { last = Number(localStorage.getItem("wunschzettel-last-text") ?? -1); } catch {}
  let i = Math.floor(Math.random() * (T.general.length - 1));
  if (i >= last && last >= 0) i++;
  try { localStorage.setItem("wunschzettel-last-text", String(i)); } catch {}
  return T.general[i];
};
