const dataElement = document.querySelector('#public-ai-data');
const messageList = document.querySelector('#public-ai-messages');
const form = document.querySelector('#public-ai-form');
const input = document.querySelector('#public-ai-input');

const PHONE_LINK = { href: 'tel:+37125756835', label: 'Zvanīt' };
const WHATSAPP_LINK = { href: 'https://wa.me/37125756835', label: 'WhatsApp' };
const EMAIL_LINK = { href: 'mailto:autowendene@gmail.com', label: 'E-pasts' };
const MIN_SCORE = 3;
const SECOND_ANSWER_RATIO = 0.75;
const MISSING_INFO = 'Šo jautājumu noskaidrojiet, zvanot vai uz e-pastu.';
const UNKNOWN = 'Es nezinu!';
// Word beginnings that make a question about the keys, remotes and services KEYTOOL works with.
const TOPIC_WORDS = ['atsleg', 'imobil', 'immobil', 'pult', 'transponder', 'cip', 'aizdedz', 'dekod', 'sledz', 'cilindr', 'durv', 'programm', 'auto', 'masin', 'moto', 'keytool', 'pakalpoj', 'meistar', 'remont', 'garantij', 'apmaks', 'rekin', 'gaid', 'jagaid'];
// The site has no immobilizer information yet, so these always go to a person.
const NO_INFO_TOPICS = ['imobil', 'immobil'];
const BUYING_WORDS = ['pirk', 'nopirk', 'iegad', 'tirgo', 'pardod'];
// Goods named in a clear answer; anything else gets the general "to netirgo".
const GOODS_NAMES = { vist: 'vistas', pica: 'picas', picu: 'picas', picas: 'picas' };

// Lower-case and drop Latvian diacritics, so "ā" and "a" match.
const normalize = value => String(value).toLocaleLowerCase('lv-LV').normalize('NFD').replace(/[̀-ͯ]/g, '');
const wordsOf = text => text.match(/[\p{L}\p{N}]+/gu) || [];

const records = (dataElement ? JSON.parse(dataElement.textContent || '[]') : []).map(record => ({
  ...record,
  terms: Object.entries(record.terms || {}).map(([term, weight]) => ({ term: normalize(term), weight }))
}));

// True when two equally long strings differ by at most one edit (a typo).
function withinOneEdit(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i += 1; j += 1; continue; }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else { i += 1; j += 1; }
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
}

// Terms are word beginnings, so "maks" covers "maksā" and "maksājums".
// Short terms must match the whole word; phrases are searched in the whole text.
function termMatches(term, words, text) {
  if (term.includes(' ')) return text.includes(term);
  if (term.length <= 3) return words.includes(term);
  return words.some(word => word.startsWith(term) || (term.length >= 5 && word.length >= term.length && withinOneEdit(word.slice(0, term.length), term)));
}

function findMatches(question) {
  const text = wordsOf(normalize(question)).join(' ');
  const words = text.split(' ');
  return records
    .map(record => ({ record, score: record.terms.reduce((sum, { term, weight }) => sum + (termMatches(term, words, text) ? weight : 0), 0) }))
    .filter(match => match.score >= MIN_SCORE)
    .sort((left, right) => right.score - left.score);
}

const priceElement = document.querySelector('#public-ai-prices');
const prices = priceElement ? JSON.parse(priceElement.textContent || '{}') : {};
const priceBrands = prices.brands || {};
const priceRows = prices.rows || [];
const PRICE_NOTE = 'Cena ir orientējoša; precīzu cenu saskaņosim sarunā.';
const SERVICE_NAMES = {
  rezerve: 'rezerves atslēga',
  pazudusas: 'atslēgu atjaunošana, ja visas pazudušas',
  programmesana: 'atslēgas programmēšana',
  remonts: 'atslēgas vai pults remonts',
  pievilesana: 'atslēgas pievīlēšana',
  cilindrs: 'cilindra maiņa',
  durvis: 'durvju atvēršana',
  izzina: 'izziņa apdrošināšanai',
  izbraukums: 'izbraukums'
};
const CAR_SERVICES = new Set(['rezerve', 'pazudusas', 'programmesana']);
const STRONG_TERM = 4;
let awaitingBrand = null;

function questionWords(question) {
  const text = wordsOf(normalize(question)).join(' ');
  return { text, words: text.split(' ') };
}

function detectBrand(words) {
  const alias = Object.keys(priceBrands).find(key => words.some(word => (key.length >= 5 ? word.startsWith(key) : word === key)));
  return alias ? priceBrands[alias] : null;
}

// The service the question clearly names; generic words like "auto" do not count.
function detectService(question) {
  const { text, words } = questionWords(question);
  const scored = records
    .filter(record => SERVICE_NAMES[record.id])
    .map(record => ({ id: record.id, score: record.terms.reduce((sum, { term, weight }) => sum + (weight >= STRONG_TERM && termMatches(term, words, text) ? weight : 0), 0) }))
    .filter(match => match.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored.length ? scored[0].id : null;
}

function formatPriceRows(rows) {
  const lines = rows.map(row => {
    const years = row.years ? `(${row.years[0]}.–${row.years[1]}. g.)` : '';
    const service = SERVICE_NAMES[row.service] || (row.brand ? 'auto atslēga' : '');
    const name = [row.brand, row.modelNames, years].filter(Boolean).join(' ');
    return `${[name, service].filter(Boolean).join(', ')}: ${row.from}–${row.to} €`;
  });
  return `${lines.join('\n')}\n\n${PRICE_NOTE}`;
}

// A row applies only if the question does not name another model or a year outside its range.
function rowFitsCar(row, words) {
  if (row.years) {
    const years = words.filter(word => /^(19|20)\d{2}$/.test(word)).map(Number);
    if (years.some(year => year < row.years[0] || year > row.years[1])) return false;
  }
  if (row.models) {
    const others = (prices.otherModels || {})[row.brand] || [];
    const namesRowModel = row.models.some(model => words.some(word => word.startsWith(model)));
    if (!namesRowModel && others.some(model => words.some(word => word.startsWith(model)))) return false;
  }
  return true;
}

// A row without a named service is a general car key price: it answers general and
// spare-key questions, but says nothing about programming, repairs or lost keys.
function rowFitsService(row, service) {
  if (!service) return true;
  return row.service ? row.service === service : service === 'rezerve';
}

// Car prices depend on the brand: ask for it, and never name a price that is not in the table.
function priceReply(question, service) {
  const { words } = questionWords(question);
  const brand = detectBrand(words);
  const isCar = Boolean(brand) || words.some(word => word.startsWith('auto') || word.startsWith('masin')) || CAR_SERVICES.has(service);
  if (!isCar) {
    const rows = service ? priceRows.filter(row => !row.brand && row.service === service) : [];
    return rows.length ? { id: 'cena-diapazons', text: formatPriceRows(rows), links: [] } : null;
  }
  // Some services have no fixed price: explain what it depends on, unless a row fits this car.
  const note = (prices.notes || {})[service];
  const hasRow = priceRows.some(row => row.brand === brand && rowFitsService(row, service) && rowFitsCar(row, words));
  if (note && !hasRow) return { id: `cena-${service}`, text: note, links: [] };
  if (!brand) {
    awaitingBrand = { service };
    return { id: 'cena-marka', text: 'Auto atslēgu cena atkarīga no markas. Lūdzu, uzrakstiet auto marku un modeli, piemēram, “Audi A4”.', links: [] };
  }
  const rows = priceRows.filter(row => row.brand === brand && rowFitsService(row, service) && rowFitsCar(row, words));
  if (rows.length) return { id: 'cena-diapazons', text: formatPriceRows(rows), links: [] };
  return { id: 'cena-nav', text: MISSING_INFO, links: [] };
}

// No known answer: on-topic questions go to a person; off-topic ones get a plain, honest reply.
function noMatchReply(question) {
  const { words } = questionWords(question);
  const startsWithAny = list => words.some(word => list.some(start => word.startsWith(start)));
  if (startsWithAny(TOPIC_WORDS)) return { id: 'nav-info', text: MISSING_INFO, links: [] };
  if (startsWithAny(BUYING_WORDS)) {
    const good = Object.keys(GOODS_NAMES).find(start => words.some(word => word.startsWith(start)));
    return { id: 'netirgo', text: `KEYTOOL ${good ? GOODS_NAMES[good] : 'to'} netirgo!`, links: [], social: true };
  }
  return { id: 'nezinu', text: UNKNOWN, links: [], social: true };
}

function answer(question) {
  const pending = awaitingBrand;
  awaitingBrand = null;
  const matches = findMatches(question);
  const [best, next] = matches;
  const isSafe = !best || best.record.id !== 'drosiba';
  if (isSafe && questionWords(question).words.some(word => NO_INFO_TOPICS.some(start => word.startsWith(start)))) {
    return { id: 'nav-info', text: MISSING_INFO, links: [] };
  }
  if (pending && isSafe && detectBrand(questionWords(question).words)) {
    return priceReply(question, pending.service || detectService(question));
  }
  if (isSafe && matches.some(match => match.record.id === 'cena')) {
    const reply = priceReply(question, detectService(question));
    if (reply) return reply;
  }
  if (!best) return pending ? { id: 'nav-info', text: MISSING_INFO, links: [] } : noMatchReply(question);
  const picked = next && !next.record.social && !best.record.social && best.record.id !== 'drosiba' && next.score >= best.score * SECOND_ANSWER_RATIO ? [best, next] : [best];
  return {
    id: picked.map(match => match.record.id).join('+'),
    text: picked.map(match => match.record.answer).join('\n\n'),
    links: picked.map(match => match.record.link).filter(Boolean),
    social: Boolean(best.record.social)
  };
}

function appendMessage(kind, text, details = {}) {
  const article = document.createElement('article');
  article.className = `assistant-message ${kind === 'user' ? 'assistant-message-user' : 'assistant-message-bot'}`;
  if (details.id) article.dataset.record = details.id;
  const label = document.createElement('span');
  label.className = 'assistant-message-label';
  label.textContent = kind === 'user' ? 'JŪS' : 'KEYTOOL PALĪGS';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  article.append(label, paragraph);
  if (kind !== 'user' && !details.social) {
    const actions = document.createElement('div');
    actions.className = 'assistant-message-actions';
    [...(details.links || []), PHONE_LINK, WHATSAPP_LINK, EMAIL_LINK].forEach(({ href, label: linkLabel }) => {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = linkLabel;
      if (href.startsWith('https:')) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      actions.append(link);
    });
    article.append(actions);
  }
  messageList.append(article);
  return article;
}

// Show the newest message from its first line, so long answers are read from the start.
function scrollToMessage(article) {
  messageList.scrollTop += article.getBoundingClientRect().top - messageList.getBoundingClientRect().top - 12;
}

const UNANSWERED_FORM = 'neatbildetie-jautajumi';
const UNANSWERED_REPLIES = new Set(['nezinu', 'netirgo', 'nav-info', 'cena-nav']);
const MAX_SENT_PER_PAGE = 20;
const sentQuestions = new Set();

// Remove contact details and car plates before a question leaves the page.
function redact(text) {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[noņemts]')
    .replace(/\+?\d[\d\s()-]{6,}\d/g, '[noņemts]')
    .replace(/\b[A-Za-z]{2}-?\d{3,4}\b/g, '[noņemts]');
}

// Save questions without an answer so they can be reviewed in Netlify Forms.
// The visitor's reply never depends on this, so a failed request is ignored.
function saveUnanswered(question, replyId) {
  if (!UNANSWERED_REPLIES.has(replyId)) return;
  const text = redact(question);
  if (sentQuestions.has(text) || sentQuestions.size >= MAX_SENT_PER_PAGE) return;
  sentQuestions.add(text);
  fetch('/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'form-name': UNANSWERED_FORM, jautajums: text, atbilde: replyId }).toString()
  }).catch(() => {});
}

function ask(question) {
  const clean = question.trim();
  if (!clean) return;
  scrollToMessage(appendMessage('user', clean));
  input.value = '';
  window.setTimeout(() => {
    const reply = answer(clean);
    scrollToMessage(appendMessage('assistant', reply.text, reply));
    saveUnanswered(clean, reply.id);
  }, 180);
}

form?.addEventListener('submit', event => {
  event.preventDefault();
  ask(input.value);
});

// Enter sends the question; Shift+Enter starts a new line.
input?.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll('[data-ai-question]').forEach(button => button.addEventListener('click', () => ask(button.dataset.aiQuestion)));
