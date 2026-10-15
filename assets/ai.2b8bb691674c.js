const dataElement = document.querySelector('#public-ai-data');
const messageList = document.querySelector('#public-ai-messages');
const form = document.querySelector('#public-ai-form');
const input = document.querySelector('#public-ai-input');
const records = dataElement ? JSON.parse(dataElement.textContent || '[]') : [];

const normalize = value => String(value).toLocaleLowerCase('lv-LV').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const tokens = value => new Set((normalize(value).match(/[\p{L}\p{N}]{2,}/gu) || []).filter(word => !['un', 'ar', 'vai', 'ko', 'ka', 'ir', 'uz', 'par', 'no', 'kur', 'tas', 'tā', 'tas'].includes(word)));

function findMatches(question) {
  const query = normalize(question);
  const queryTokens = tokens(question);
  return records.map(record => {
    const text = normalize(`${record.title} ${record.text}`);
    let score = query.length > 4 && text.includes(query) ? 10 : 0;
    for (const token of queryTokens) {
      if (normalize(record.title).includes(token)) score += 7;
      if (text.includes(token)) score += 3;
    }
    return { record, score };
  }).filter(match => match.score > 0).sort((left, right) => right.score - left.score).slice(0, 2);
}

function appendMessage(kind, text) {
  const article = document.createElement('article');
  article.className = `assistant-message ${kind === 'user' ? 'assistant-message-user' : 'assistant-message-bot'}`;
  const label = document.createElement('span');
  label.className = 'assistant-message-label';
  label.textContent = kind === 'user' ? 'JŪS' : 'KEYTOOL AI';
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  article.append(label, paragraph);
  messageList.append(article);
  messageList.scrollTop = messageList.scrollHeight;
}

function answer(question) {
  const matches = findMatches(question);
  if (!matches.length) return 'Par šo jautājumu publiskajā informācijā nevaru sniegt drošu atbildi. Sazinieties ar KEYTOOL, nosaucot auto marku, modeli un gadu vai nosūtot atslēgas foto.';
  return `${matches.map(match => match.record.text).join('\n\n')}\n\nJa nepieciešams, precīzu risinājumu un pieejamību precizēsim sarunā.`;
}

function ask(question) {
  const clean = question.trim();
  if (!clean) return;
  appendMessage('user', clean);
  input.value = '';
  window.setTimeout(() => appendMessage('assistant', answer(clean)), 180);
}

form?.addEventListener('submit', event => {
  event.preventDefault();
  ask(input.value);
});

document.querySelectorAll('[data-ai-question]').forEach(button => button.addEventListener('click', () => {
  input.value = button.dataset.aiQuestion;
  ask(input.value);
}));
