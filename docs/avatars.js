// 40 Christmas avatars (20 people, 20 animals), drawn as 64x64 SVG. The id is stored per user (1-40).
(() => {
  const INK = "#2b1d16";
  const RED = "#d7263d";
  const GREEN = "#2e8b57";
  const GOLD = "#f2c14e";
  const BG = { green: "#1f6f4a", red: "#b8323f", gold: "#d99a2b", navy: "#24406e", plum: "#6d3b73", teal: "#1f7a7a", ice: "#5b8fb9" };

  // ---------- shared parts ----------
  const eyes = (x1, x2, y, r = 1.8) =>
    `<circle cx="${x1}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x2}" cy="${y}" r="${r}" fill="${INK}"/>` +
    `<circle cx="${x1 + 0.6}" cy="${y - 0.6}" r="0.55" fill="#fff"/><circle cx="${x2 + 0.6}" cy="${y - 0.6}" r="0.55" fill="#fff"/>`;
  const cheeks = (x1, x2, y) =>
    `<circle cx="${x1}" cy="${y}" r="2.6" fill="#ff6f7d" opacity=".4"/><circle cx="${x2}" cy="${y}" r="2.6" fill="#ff6f7d" opacity=".4"/>`;
  const smile = (y = 42, w = 4) =>
    `<path d="M${32 - w} ${y} Q32 ${y + 3.5} ${32 + w} ${y}" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  const mirror = (d) => d.replace(/([ML])\s*([\d.]+)/g, (_, c, x) => `${c}${(64 - parseFloat(x)).toFixed(1)}`);
  const at = (dy, inner) => (dy ? `<g transform="translate(0 ${dy})">${inner}</g>` : inner);

  const santaHat = (dy = 0) => at(dy,
    `<path d="M15 25 C17 11 33 4 45 8 C50 10 53 15 52 21 L48 25 Z" fill="${RED}"/>` +
    `<circle cx="52" cy="21" r="4.3" fill="#fff"/><rect x="13" y="22" width="38" height="7.5" rx="3.75" fill="#fff"/>`);
  const elfHat = (dy = 0) => at(dy,
    `<path d="M16 25 L27 3.5 Q30 1 31.5 5 L48 25 Z" fill="${GREEN}"/><circle cx="28" cy="4.5" r="3.2" fill="${GOLD}"/>` +
    `<path d="M14 24 h36 v4 l-4.5 3 -4.5 -3 -4.5 3 -4.5 -3 -4.5 3 -4.5 -3 -4.5 3 -4.5 -3 z" fill="${RED}"/>`);
  const beanie = (color, cuff, stripe = true, dy = 0) => at(dy,
    `<path d="M16 27 Q16 11 32 11 Q48 11 48 27 Z" fill="${color}"/>` +
    (stripe ? `<path d="M17 19.5 Q32 14.5 47 19.5 L47.6 23 Q32 18 16.4 23 Z" fill="#fff" opacity=".85"/>` : "") +
    `<rect x="15" y="23" width="34" height="7" rx="3.5" fill="${cuff}"/><circle cx="32" cy="10" r="4.6" fill="#fff"/>`);
  const earmuffs = (color, dy = 0) => at(dy,
    `<path d="M16.5 36 Q16.5 15 32 15 Q47.5 15 47.5 36" fill="none" stroke="#5b3a29" stroke-width="2.6"/>` +
    `<circle cx="16.5" cy="37" r="5.8" fill="${color}"/><circle cx="47.5" cy="37" r="5.8" fill="${color}"/>` +
    `<circle cx="15" cy="35.5" r="1.8" fill="#fff" opacity=".45"/><circle cx="46" cy="35.5" r="1.8" fill="#fff" opacity=".45"/>`);
  const antlerHeadband = () => {
    const l = "M22.5 21 L18.5 8 M20.2 13.5 L13.5 10 M18.5 8 L15.5 4 M19 10 L22 5.5";
    return `<path d="M16.5 32 Q16.5 18 32 18 Q47.5 18 47.5 32" fill="none" stroke="${RED}" stroke-width="2.6"/>` +
      `<path d="${l} ${mirror(l)}" fill="none" stroke="#8b5a2b" stroke-width="2.6" stroke-linecap="round"/>`;
  };
  const halo = () => `<ellipse cx="32" cy="14" rx="11" ry="3.2" fill="none" stroke="${GOLD}" stroke-width="2.8"/>`;
  const holly = (x, y, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="M0 0 C-3 -4 -9 -3 -10 1 C-7 0 -5 3 -2 2 Z" fill="${GREEN}"/><path d="M0 0 C3 -4 9 -3 10 1 C7 0 5 3 2 2 Z" fill="#3fa06a"/>` +
    `<circle cx="-1.6" cy="-1.2" r="2" fill="${RED}"/><circle cx="1.6" cy="-1.2" r="2" fill="${RED}"/><circle cx="0" cy="-3.6" r="2" fill="#e8394f"/></g>`;
  const scarf = (color, stripe = "#fff", dy = 0) => at(dy,
    `<path d="M17 50 Q32 57 47 50 L48 56.5 Q32 63.5 16 56.5 Z" fill="${color}"/>` +
    `<path d="M38 54.5 L41 64 H47 L44.5 53 Z" fill="${color}"/>` +
    `<path d="M20 53.5 Q32 59 44 53.5" fill="none" stroke="${stripe}" stroke-width="1.6" stroke-dasharray="3 3" opacity=".8"/>`);
  const bellCollar = (dy = 0) => at(dy,
    `<path d="M18 52 Q32 58 46 52" fill="none" stroke="${RED}" stroke-width="3.5" stroke-linecap="round"/>` +
    `<circle cx="32" cy="57.5" r="3.4" fill="${GOLD}"/><path d="M30.2 58.5 h3.6" stroke="#9a6b12" stroke-width="1"/>`);
  const glasses = () =>
    `<g fill="none" stroke="#3a3a3a" stroke-width="1.4"><circle cx="26.5" cy="35.5" r="4.3"/><circle cx="37.5" cy="35.5" r="4.3"/><path d="M30.8 35.5 h2.4"/></g>`;
  const sweater = (color) =>
    `<path d="M10 64 Q12 50 32 50 Q52 50 54 64 Z" fill="${color}"/>` +
    `<path d="M18 58 l3 -3 3 3 3 -3 3 3 3 -3 3 3 3 -3 3 3 3 -3 3 3" fill="none" stroke="#fff" stroke-width="1.3" opacity=".7"/>`;

  // ---------- people ----------
  const SKIN = ["#fbdcc0", "#f1c19a", "#d9a07a", "#b67a52", "#8a5638"];
  const HAIR = { dark: "#3b2416", brown: "#6b3e1f", blond: "#e0b04a", red: "#b5502b", grey: "#d4d4d4", black: "#1d1a1a", white: "#f4f4f4" };

  const hairBack = {
    long: (c) => `<path d="M15 36 Q15 19 32 19 Q49 19 49 36 L50 55 Q32 59 14 55 Z" fill="${c}"/>`,
    pigtails: (c) => `<circle cx="13.5" cy="43" r="5.5" fill="${c}"/><circle cx="50.5" cy="43" r="5.5" fill="${c}"/>`,
  };
  const hairTop = {
    short: (c) => `<path d="M17 33 Q16 20 32 20 Q48 20 47 33 Q44 26 36 25.5 Q30 29 22 27.5 Q18.5 29 17 33 Z" fill="${c}"/>`,
    long: (c) => `<path d="M17 34 Q16 20 32 20 Q48 20 47 34 Q45 26 32 25 Q19 26 17 34 Z" fill="${c}"/>`,
    curly: (c) => [[19, 30, 4.6], [21.5, 24.5, 5], [27, 21, 5.2], [33.5, 20.2, 5.2], [39.5, 22, 5], [44, 26.5, 4.8], [45.5, 31, 4]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`).join(""),
    bun: (c) => `<circle cx="32" cy="16" r="5.5" fill="${c}"/>` + hairTop.long(c),
    none: () => "",
  };

  function person({ skin, hair = "short", hairColor = HAIR.brown, hat, beard, specs, top, scarfColor, shirt = RED, bg }) {
    const s = SKIN[skin];
    let out = `<rect width="64" height="64" fill="${bg}"/>`;
    if (hairBack[hair]) out += hairBack[hair](hairColor);
    out += sweater(shirt);
    out += `<circle cx="17.5" cy="37" r="3.2" fill="${s}"/><circle cx="46.5" cy="37" r="3.2" fill="${s}"/>`;
    out += `<circle cx="32" cy="36" r="15" fill="${s}"/>`;
    out += (hairTop[hair] || hairTop.short)(hairColor);
    out += eyes(26.5, 37.5, 35.5) + cheeks(23.5, 40.5, 40.5);
    if (beard) {
      out += `<path d="M17 37 Q17 58 32 59 Q47 58 47 37 Q44 44 38 44.5 Q32 47 26 44.5 Q20 44 17 37 Z" fill="${HAIR.white}"/>` +
        `<path d="M24.5 43.2 Q28.5 40 32 42.6 Q35.5 40 39.5 43.2 Q36 46 32 44.6 Q28 46 24.5 43.2 Z" fill="#fff" stroke="#ddd" stroke-width=".6"/>`;
    } else {
      out += smile(42);
    }
    if (specs) out += glasses();
    if (scarfColor) out += scarf(scarfColor);
    if (top) out += top;
    if (hat) out += hat;
    return out;
  }

  const people = [
    { label: "Weihnachtsmann", skin: 0, hair: "none", hat: santaHat(), beard: true, shirt: RED, bg: BG.green },
    { label: "Weihnachtsfrau", skin: 0, hair: "long", hairColor: HAIR.grey, specs: true, hat: santaHat(), shirt: RED, bg: BG.teal },
    { label: "Wichtel", skin: 1, hair: "short", hairColor: HAIR.brown, hat: elfHat(), shirt: GREEN, bg: BG.red },
    { label: "Wichtelin", skin: 2, hair: "pigtails", hairColor: HAIR.red, hat: elfHat(), shirt: GREEN, bg: BG.gold },
    { label: "Engel", skin: 0, hair: "long", hairColor: HAIR.blond, top: halo(), shirt: "#f4f1ea", bg: BG.navy },
    { label: "Engel mit Locken", skin: 3, hair: "curly", hairColor: HAIR.black, top: halo(), shirt: "#f4f1ea", bg: BG.plum },
    { label: "Mit Bommelmütze", skin: 1, hair: "short", hairColor: HAIR.blond, hat: beanie(RED, "#a51c2e"), scarfColor: GREEN, shirt: GREEN, bg: BG.ice },
    { label: "Mit grüner Mütze", skin: 4, hair: "short", hairColor: HAIR.black, hat: beanie(GREEN, "#1f6b41"), scarfColor: RED, shirt: "#24406e", bg: BG.gold },
    { label: "Mit Ohrenschützern", skin: 2, hair: "long", hairColor: HAIR.brown, top: earmuffs("#e85d75"), scarfColor: "#f4f1ea", shirt: "#6d3b73", bg: BG.teal },
    { label: "Mit Brille und Ohrenschützern", skin: 3, hair: "short", hairColor: HAIR.dark, specs: true, top: earmuffs("#f4f1ea"), shirt: GREEN, bg: BG.red },
    { label: "Rentier-Haarreif", skin: 0, hair: "long", hairColor: HAIR.red, top: antlerHeadband(), shirt: GREEN, bg: BG.green },
    { label: "Rentier-Haarreif mit Locken", skin: 4, hair: "curly", hairColor: HAIR.black, top: antlerHeadband(), shirt: RED, bg: BG.navy },
    { label: "Mit Weihnachtsmütze", skin: 3, hair: "long", hairColor: HAIR.dark, hat: santaHat(), shirt: GREEN, bg: BG.teal },
    { label: "Mit Brille und Mütze", skin: 1, hair: "short", hairColor: HAIR.brown, specs: true, hat: santaHat(), shirt: "#24406e", bg: BG.plum },
    { label: "Opa", skin: 0, hair: "short", hairColor: HAIR.grey, specs: true, hat: beanie("#24406e", "#1a2f52", false), scarfColor: RED, shirt: "#8b5a2b", bg: BG.gold },
    { label: "Oma", skin: 1, hair: "bun", hairColor: HAIR.grey, specs: true, top: holly(38, 18, 0.8), shirt: "#6d3b73", bg: BG.red },
    { label: "Mit Stechpalme", skin: 2, hair: "long", hairColor: HAIR.blond, top: holly(26, 22, 0.9), scarfColor: RED, shirt: GREEN, bg: BG.navy },
    { label: "Mit Dutt", skin: 4, hair: "bun", hairColor: HAIR.black, top: earmuffs(GOLD), shirt: RED, bg: BG.green },
    { label: "Lockenkopf mit Mütze", skin: 2, hair: "curly", hairColor: HAIR.brown, hat: santaHat(), shirt: GREEN, bg: BG.gold },
    { label: "Elf mit Brille", skin: 3, hair: "short", hairColor: HAIR.red, specs: true, hat: elfHat(), shirt: RED, bg: BG.ice },
  ].map((p) => ({ label: p.label, svg: person(p) }));

  // ---------- animals ----------
  const reindeer = () => {
    const l = "M25 26 L20 12 M21.7 17 L14 13 M20 12 L17.5 6 M20.8 14.5 L24.5 8";
    return `<path d="${l} ${mirror(l)}" fill="none" stroke="#7a4a24" stroke-width="3" stroke-linecap="round"/>` +
      `<ellipse cx="18" cy="31" rx="6.5" ry="3.2" transform="rotate(-25 18 31)" fill="#8a5a33"/>` +
      `<ellipse cx="46" cy="31" rx="6.5" ry="3.2" transform="rotate(25 46 31)" fill="#8a5a33"/>` +
      `<ellipse cx="32" cy="38" rx="13" ry="15" fill="#a0703f"/><ellipse cx="32" cy="46" rx="9" ry="6.5" fill="#d9b48a"/>` +
      eyes(27, 37, 35) + cheeks(23.5, 40.5, 40) +
      `<circle cx="32" cy="42.5" r="3.9" fill="#e0322f"/><circle cx="30.8" cy="41.3" r="1.1" fill="#fff" opacity=".75"/>` +
      `<path d="M29 47.8 Q32 50.3 35 47.8" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`;
  };
  const penguin = () =>
    `<circle cx="32" cy="37" r="16" fill="#20242b"/>` +
    `<path d="M32 30 C27 23 18 28 19 37 C20 46 26 51 32 51 C38 51 44 46 45 37 C46 28 37 23 32 30 Z" fill="#fff"/>` +
    eyes(27, 37, 37) + cheeks(24, 40, 42) + `<path d="M28.5 41 Q32 39 35.5 41 L32 45 Z" fill="#f4a024"/>`;
  const polarBear = () =>
    `<circle cx="19.5" cy="25" r="5.5" fill="#f5f3ee"/><circle cx="44.5" cy="25" r="5.5" fill="#f5f3ee"/>` +
    `<circle cx="19.5" cy="25" r="2.8" fill="#efc9c9"/><circle cx="44.5" cy="25" r="2.8" fill="#efc9c9"/>` +
    `<circle cx="32" cy="37" r="15" fill="#f5f3ee"/><ellipse cx="32" cy="43" rx="7" ry="5.5" fill="#e8e2d6"/>` +
    eyes(26.5, 37.5, 34.5) + cheeks(23, 41, 40) +
    `<ellipse cx="32" cy="40.5" rx="3" ry="2.2" fill="#2b2b2b"/>` +
    `<path d="M29.5 44.5 Q32 46.5 34.5 44.5" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`;
  const fox = () => {
    const ear = "M16.5 31 L18.5 13.5 L29 23.5 Z";
    const inner = "M19.3 26.5 L20.3 18 L25.5 23 Z";
    return `<path d="${ear}" fill="#e8772e"/><path d="${mirror(ear)}" fill="#e8772e"/>` +
      `<path d="${inner}" fill="#3a2a22"/><path d="${mirror(inner)}" fill="#3a2a22"/>` +
      `<path d="M15 31 Q16 22 32 22 Q48 22 49 31 Q49 41 32 53 Q15 41 15 31 Z" fill="#e8772e"/>` +
      `<path d="M16.5 34.5 Q24 38.5 32 38.5 Q40 38.5 47.5 34.5 Q44 44 32 53 Q20 44 16.5 34.5 Z" fill="#fff4e8"/>` +
      eyes(26, 38, 32) + `<circle cx="32" cy="49.5" r="2.4" fill="${INK}"/>`;
  };
  const owl = () =>
    `<path d="M18 27 L16.5 16 L25.5 22.5 Z" fill="#6f4a2e"/><path d="M46 27 L47.5 16 L38.5 22.5 Z" fill="#6f4a2e"/>` +
    `<ellipse cx="32" cy="38" rx="16" ry="17" fill="#8b5e3c"/>` +
    `<circle cx="25.5" cy="36" r="7.5" fill="#d9b48a"/><circle cx="38.5" cy="36" r="7.5" fill="#d9b48a"/>` +
    `<circle cx="25.5" cy="36" r="4.8" fill="#fff"/><circle cx="38.5" cy="36" r="4.8" fill="#fff"/>` +
    eyes(25.5, 38.5, 36.3, 2.8) + `<path d="M30 42 L34 42 L32 46.5 Z" fill="#f2a33a"/>` +
    `<path d="M24 50 q2 2 4 0 q2 2 4 0 q2 2 4 0 q2 2 4 0" fill="none" stroke="#6f4a2e" stroke-width="1.2"/>`;
  const bunny = () =>
    `<ellipse cx="24.5" cy="16" rx="5" ry="13" transform="rotate(-8 24.5 16)" fill="#f4f1ec"/>` +
    `<ellipse cx="39.5" cy="16" rx="5" ry="13" transform="rotate(8 39.5 16)" fill="#f4f1ec"/>` +
    `<ellipse cx="24.5" cy="16.5" rx="2.4" ry="9" transform="rotate(-8 24.5 16)" fill="#f6c3cf"/>` +
    `<ellipse cx="39.5" cy="16.5" rx="2.4" ry="9" transform="rotate(8 39.5 16)" fill="#f6c3cf"/>` +
    `<circle cx="32" cy="39" r="14" fill="#f4f1ec"/>` + eyes(27, 37, 37) + cheeks(23.5, 40.5, 42) +
    `<path d="M30.4 41 L33.6 41 L32 43 Z" fill="#f08aa0"/>` +
    `<path d="M32 43 V44.5 M32 44.5 Q30.2 46.6 28.6 45.2 M32 44.5 Q33.8 46.6 35.4 45.2" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M20 42 H26 M20 44.5 L26 43.5 M44 42 H38 M44 44.5 L38 43.5" stroke="#9a9a9a" stroke-width=".8"/>`;
  const cat = () => {
    const ear = "M17 31 L18 15 L28.5 23 Z";
    const inner = "M19.5 26.5 L20 19 L25.5 23.5 Z";
    return `<path d="${ear}" fill="#f0a050"/><path d="${mirror(ear)}" fill="#f0a050"/>` +
      `<path d="${inner}" fill="#f6c3cf"/><path d="${mirror(inner)}" fill="#f6c3cf"/>` +
      `<circle cx="32" cy="37" r="15" fill="#f0a050"/>` +
      `<path d="M32 22.5 V27.5 M28 23.2 L29 27.2 M36 23.2 L35 27.2" stroke="#d27a2a" stroke-width="2" stroke-linecap="round"/>` +
      `<ellipse cx="32" cy="43" rx="6.5" ry="4.6" fill="#fff4e8"/>` + eyes(26.5, 37.5, 35) + cheeks(22.5, 41.5, 40) +
      `<path d="M30.4 40.3 L33.6 40.3 L32 42.2 Z" fill="#f08aa0"/>` +
      `<path d="M32 42.2 V43.4 M32 43.4 Q30.4 45.2 29 44 M32 43.4 Q33.6 45.2 35 44" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/>` +
      `<path d="M18 41 H25 M18.5 44 L25 42.6 M46 41 H39 M45.5 44 L39 42.6" stroke="#8a5a2a" stroke-width=".8"/>`;
  };
  const dog = () =>
    `<circle cx="32" cy="38" r="14" fill="#c98b55"/><ellipse cx="38" cy="34" rx="5" ry="5.5" fill="#a86d3d"/>` +
    `<ellipse cx="18" cy="38" rx="5.5" ry="11" transform="rotate(15 18 38)" fill="#7a4e2d"/>` +
    `<ellipse cx="46" cy="38" rx="5.5" ry="11" transform="rotate(-15 46 38)" fill="#7a4e2d"/>` +
    `<ellipse cx="32" cy="44" rx="7.5" ry="5.6" fill="#f1dcc2"/>` + eyes(26.5, 37.5, 35.5) +
    `<ellipse cx="32" cy="41" rx="3.3" ry="2.4" fill="#222"/>` +
    `<path d="M30.8 46.3 Q32 50.5 33.2 46.3 Z" fill="#f08aa0"/>` +
    `<path d="M28.5 45 Q30.5 47 32 45.2 Q33.5 47 35.5 45" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>`;
  const hedgehog = () => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * (1.05 + (0.9 * i) / 16);
      const r = i % 2 ? 13.5 : 20;
      pts.push(`${(32 + r * Math.cos(a)).toFixed(1)},${(40 + r * Math.sin(a)).toFixed(1)}`);
    }
    return `<polygon points="${pts.join(" ")} 46,45 18,45" fill="#6b4a33"/>` +
      `<ellipse cx="32" cy="41" rx="13" ry="11" fill="#ecd2ae"/>` + eyes(27, 37, 38.5) + cheeks(23.5, 40.5, 43) +
      `<circle cx="32" cy="43.5" r="2.4" fill="${INK}"/>` +
      `<path d="M29.5 46.5 Q32 48.5 34.5 46.5" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`;
  };
  const mouse = () =>
    `<circle cx="18.5" cy="26" r="8" fill="#b9b9c6"/><circle cx="45.5" cy="26" r="8" fill="#b9b9c6"/>` +
    `<circle cx="18.5" cy="26" r="4.8" fill="#f6c3cf"/><circle cx="45.5" cy="26" r="4.8" fill="#f6c3cf"/>` +
    `<circle cx="32" cy="39" r="13" fill="#c9c9d4"/>` + eyes(27.5, 36.5, 37) + cheeks(24, 40, 41.5) +
    `<circle cx="32" cy="42.5" r="2" fill="#f08aa0"/>` +
    `<path d="M29.5 45 Q32 47 34.5 45" fill="none" stroke="${INK}" stroke-width="1.2" stroke-linecap="round"/>` +
    `<path d="M20 41 H27 M20.5 44 L27 42.6 M44 41 H37 M43.5 44 L37 42.6" stroke="#8a8a96" stroke-width=".8"/>`;

  const animal = (draw, bg, ...extras) => `<rect width="64" height="64" fill="${bg}"/>` + draw() + extras.join("");

  const animals = [
    { label: "Rudolph", svg: animal(reindeer, BG.green, scarf(RED, "#fff", 4)) },
    { label: "Rentier mit Glöckchen", svg: animal(reindeer, BG.navy, bellCollar(3), holly(41, 27, 0.7)) },
    { label: "Pinguin mit Mütze", svg: animal(penguin, BG.ice, santaHat(-1)) },
    { label: "Pinguin mit Schal", svg: animal(penguin, BG.teal, beanie(RED, "#a51c2e", true, -2), scarf(GREEN, "#fff", 2)) },
    { label: "Eisbär mit Mütze", svg: animal(polarBear, BG.red, santaHat(0)) },
    { label: "Eisbär mit Schal", svg: animal(polarBear, BG.navy, scarf(RED, "#fff", 2)) },
    { label: "Fuchs mit Mütze", svg: animal(fox, BG.green, beanie(GREEN, "#1f6b41", true, -2)) },
    { label: "Fuchs mit Stechpalme", svg: animal(fox, BG.plum, holly(41, 22, 0.8)) },
    { label: "Eule mit Mütze", svg: animal(owl, BG.navy, santaHat(-1)) },
    { label: "Eule mit Schal", svg: animal(owl, BG.gold, scarf(RED, "#fff", 4)) },
    { label: "Hase mit Schal", svg: animal(bunny, BG.green, scarf(RED, "#fff", 3)) },
    { label: "Hase mit Stechpalme", svg: animal(bunny, BG.red, holly(40, 26, 0.8), bellCollar(3)) },
    { label: "Katze mit Mütze", svg: animal(cat, BG.teal, santaHat(0)) },
    { label: "Katze mit Glöckchen", svg: animal(cat, BG.plum, bellCollar(1)) },
    { label: "Hund mit Elfenmütze", svg: animal(dog, BG.red, elfHat(2)) },
    { label: "Hund mit Schal", svg: animal(dog, BG.ice, scarf(GREEN, "#fff", 3)) },
    { label: "Igel mit Mütze", svg: animal(hedgehog, BG.gold, santaHat(0)) },
    { label: "Igel mit Schal", svg: animal(hedgehog, BG.green, scarf(RED, "#fff", 3)) },
    { label: "Maus mit Mütze", svg: animal(mouse, BG.navy, santaHat(4)) },
    { label: "Maus mit Schal", svg: animal(mouse, BG.red, scarf(GREEN, "#fff", 3)) },
  ];

  const all = [...people, ...animals];
  window.AVATARS = all.map((a, i) => ({ id: i + 1, label: a.label, kind: i < people.length ? "person" : "animal", svg: a.svg }));
  window.avatarSvg = (id) => {
    const a = window.AVATARS[id - 1];
    return a ? `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${a.svg}</svg>` : null;
  };
})();
