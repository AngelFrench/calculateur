const urlGuilde =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQhhSTO2v-jmH1iLKyvxncwcZM5o4EyI0RyJn5wFzlwDE2CIHoUhCfF9QFvq5Cr5iNNnRzDh2Y6J0i1/pub?output=csv";

const CSV_CONFIG = {
  pseudo: "joueur",
  puissance: "P main team",
  main: "main",
  element: "element"
};

/* =======================
   NORMALISATION CLÉS
======================= */
function normalizeKey(str) {
  return str
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\?/g, "")
    .trim();
}

/* =======================
   POWER PARSER (K / M + 2,5 / 2.5)
======================= */
function parsePower(value) {
  if (!value) return NaN;

  let v = value
    .toString()
    .replace(/"/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  let multiplier = 1;

  if (v.includes("M")) {
    multiplier = 1_000_000;
    v = v.replace("M", "");
  } else if (v.includes("K")) {
    multiplier = 1_000;
    v = v.replace("K", "");
  }

  v = v.replace(",", ".");

  const num = Number(v);
  if (isNaN(num)) return NaN;

  return Math.round(num * multiplier);
}

/* =======================
   PARSE CSV (PAPA PARSE)
======================= */
function parseCSV(csv) {
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true
  });

  return parsed.data
    .map(row => {
      const cleanRow = {};

      for (const key in row) {
        cleanRow[normalizeKey(key)] = row[key];
      }

      const pseudo =
        cleanRow[normalizeKey(CSV_CONFIG.pseudo)]?.trim();

      const puissance =
        parsePower(cleanRow[normalizeKey(CSV_CONFIG.puissance)]);

      const puissanceMain =
        parsePower(cleanRow[normalizeKey(CSV_CONFIG.main)]);

      const element =
        cleanRow[normalizeKey(CSV_CONFIG.element)]
          ?.trim()
          .toLowerCase();

      if (!pseudo) return null;
      if (isNaN(puissance)) return null;
      if (isNaN(puissanceMain)) return null;

      return {
        pseudo,
        puissance,
        puissanceMain,
        element,
        nbMembre: 6
      };
    })
    .filter(Boolean);
}

/* =======================
   FORMAT
======================= */
function formatPower(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + " M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + " K";
  return String(n);
}

/* =======================
   COEFF ELEMENTAIRE
======================= */
function getCoeff(att, cible) {
  if (att === cible) return 1;

  if (
    (att === "dark" && cible === "earth") ||
    (att === "earth" && cible === "light") ||
    (att === "light" && cible === "dark")
  ) {
    return 1.2;
  }

  if (
    (att === "earth" && cible === "dark") ||
    (att === "light" && cible === "earth") ||
    (att === "dark" && cible === "light")
  ) {
    return 0.8;
  }

  return 1;
}

/* =======================
   PUISSANCE (VERSION OFFICIELLE)
======================= */
function getPuissance(j, e) {
  const subs = 5;

  const baseSub = (j.puissance - j.puissanceMain) / subs;

  const team = [
    { p: j.puissanceMain, e: j.element },
    ...Array(subs).fill({ p: baseSub, e: null })
  ];

  let total = 0;

  for (const m of team) {
    const coeff = m.e ? getCoeff(m.e, e.element) : 1;
    total += m.p * coeff;
  }

  return total;
}

/* =======================
   DEBUFF + KO
======================= */
function simulation(j, e) {
  const p1 = getPuissance(j, e);
  const p2 = getPuissance(e, j);

  if (p2 <= 0) {
    return { ko: 0, koFinal: 0, eq: 0, eqFinal: 0 };
  }

  const debuff = Math.max(0, (1 - p1 / p2) * 100);

  const ko = Math.max(0, 4.4383 * debuff + 1.3608);

  const koBrut = Math.ceil(ko);

  const marge = getMargeErreur(ko, j, e); // ⚠️ IMPORTANT float

  const koFinal = koBrut + marge;

  return {
    ko: koBrut,
    koFinal,
    eq: Math.ceil(koBrut / j.nbMembre),
    eqFinal: Math.ceil(koFinal / j.nbMembre)
  };
}

/* =======================
   MARGE D'ERREUR (IDENTIQUE ANCIEN SCRIPT)
======================= */
function getMargeErreur(nbKo, joueur, ennemi) {
  const pJ = getPuissance(joueur, ennemi);
  const pE = getPuissance(ennemi, joueur);

  const diff = Math.abs(pJ - pE);
  const ratio = diff / pE;

  const coeffElem = getCoeff(joueur.element, ennemi.element);

  let facteurElement;
  if (coeffElem > 1) facteurElement = 0.8;
  else if (coeffElem < 1) facteurElement = 1.2;
  else facteurElement = 1.0;

  const base = nbKo * 0.1;
  const incertitude = nbKo * ratio * 0.5;

  const marge = (base + incertitude) * facteurElement;

  return Math.ceil(Math.min(Math.max(marge, 1), 25));
}

/* =======================
   UI
======================= */
function remplirSelect(joueurs) {
  const select = document.getElementById("listeJoueurs");
  if (!select) return;

  select.innerHTML = `<option value="">Sélectionner un joueur</option>`;

  joueurs.forEach((j, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${j.pseudo} (${formatPower(j.puissance)})`;
    select.appendChild(opt);
  });
}

function setupSelectListener(joueurs) {
  const select = document.getElementById("listeJoueurs");
  if (!select) return;

  select.addEventListener("change", () => {
    const j = joueurs[select.value];
    if (!j) return;

    document.getElementById("puissance").value = j.puissance;
    document.getElementById("puissanceMain").value = j.puissanceMain;
    document.getElementById("element").value = j.element;
  });
}

/* =======================
   INPUT
======================= */
function parseInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  return parsePower(el.value);
}

function getJoueur(isA = false) {
  const s = isA ? "A" : "";

  const puissance = parseInput("puissance" + s);
  const puissanceMain = parseInput("puissanceMain" + s);
  const element = document.getElementById("element" + s).value;

  if (isNaN(puissance) || isNaN(puissanceMain)) return null;

  return {
    pseudo: isA ? "Adversaire" : "Joueur",
    puissance,
    puissanceMain, // 👈 important fallback
    element,
    nbMembre: 6
  };
}

/* =======================
   RESULT
======================= */
function afficherResultatsCalculator() {
  const j = getJoueur(false);
  const e = getJoueur(true);

  if (!j || !e) {
    alert("Remplis tous les champs !");
    return;
  }

  const r = simulation(j, e);

  document.getElementById("outputCalculator").innerHTML = `
    <p><strong>KO sans marge :</strong> ${r.ko}</p>
    <p><strong>KO avec marge :</strong> ${r.koFinal}</p>
    <hr>
    <p><strong>Équipes nécessaires (sans marge) :</strong> ${r.eq}</p>
    <p><strong>Équipes nécessaires (avec marge) :</strong> ${r.eqFinal}</p>

    <small>1 équipe = 6 KO</small>
  `;
}

/* =======================
   INIT
======================= */
document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch(urlGuilde);
  const csv = await res.text();

  const joueurs = parseCSV(csv);

  remplirSelect(joueurs);
  setupSelectListener(joueurs);

  document
    .getElementById("btnCalculerCalculator")
    ?.addEventListener("click", afficherResultatsCalculator);
});