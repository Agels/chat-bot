const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const chatScroll = document.getElementById('chat-scroll');
const composer = document.getElementById('composer');
const emptyState = document.getElementById('empty-state');
const themeToggle = document.getElementById('theme-toggle');
const showHomeButton = document.getElementById('show-home');
const showChatButton = document.getElementById('show-chat');
const showNotebookButton = document.getElementById('show-notebook');
const newChatButton = document.getElementById('new-chat');
const fileInput = document.getElementById('file-input');
const attachButton = document.getElementById('attach-button');
const attachment = document.getElementById('attachment');
const attachmentName = document.getElementById('attachment-name');
const attachmentRemove = document.getElementById('attachment-remove');
const attachmentError = document.getElementById('attachment-error');
const sendButton = form.querySelector('button[type="submit"]');

const notebookView = document.getElementById('notebook');
const notebookEmpty = document.getElementById('notebook-empty');
const notebookMonth = document.getElementById('notebook-month');
const monthPrev = document.getElementById('month-prev');
const monthNext = document.getElementById('month-next');
const monthTitle = document.getElementById('month-title');
const monthTotal = document.getElementById('month-total');
const monthLeft = document.getElementById('month-left');
const monthDetails = document.getElementById('month-details');
const categoryList = document.getElementById('category-list');
const entryList = document.getElementById('entry-list');
const profileForm = document.getElementById('profile-form');
const profileStatus = document.getElementById('profile-status');
const budgetForm = document.getElementById('budget-form');
const budgetFields = document.getElementById('budget-fields');
const budgetStatus = document.getElementById('budget-status');

const homeView = document.getElementById('home');
const todayKnown = document.getElementById('today-known');
const todayUnknown = document.getElementById('today-unknown');
const todayLabel = document.getElementById('today-label');
const todayAmount = document.getElementById('today-amount');
const todayPer = document.getElementById('today-per');
const todayNote = document.getElementById('today-note');
const expenseForm = document.getElementById('expense-form');
const expenseLabel = document.getElementById('expense-label');
const expenseAmount = document.getElementById('expense-amount');
const expenseCategory = document.getElementById('expense-category');
const expenseStatus = document.getElementById('expense-status');
const budgetList = document.getElementById('budget-list');
const budgetNone = document.getElementById('budget-none');
const setBudgetsButton = document.getElementById('set-budgets');
const goalList = document.getElementById('goal-list');
const goalNote = document.getElementById('goal-note');
const setGoalButton = document.getElementById('set-goal');
const recentSection = document.getElementById('recent-section');
const recentList = document.getElementById('recent-list');

const CATEGORIES = ['Food', 'Transport', 'Housing', 'Bills', 'Shopping', 'Health', 'Fun', 'Other'];
const STORAGE_KEY = 'conversation';
const NOTEBOOK_KEY = 'notebook';
const FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
const MAX_FILE_BYTES = 4 * 1024 * 1024;
// Semua lampiran ikut terkirim ulang di setiap permintaan, jadi totalnya dibatasi
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

const PROFILE_FIELDS = [
  { key: 'currency', label: 'Currency', input: document.getElementById('profile-currency') },
  { key: 'monthlyIncome', label: 'Monthly income', input: document.getElementById('profile-income'), money: true },
  { key: 'monthlySaving', label: 'Saving each month', input: document.getElementById('profile-saving'), money: true },
  { key: 'goalName', label: 'Saving for', input: document.getElementById('profile-goal-name') },
  { key: 'goalAmount', label: 'Savings goal', input: document.getElementById('profile-goal-amount'), money: true },
  { key: 'goalSaved', label: 'Saved so far', input: document.getElementById('profile-goal-saved'), money: true },
];

// Riwayat percakapan yang dikirim ke backend (role: 'user' | 'model')
// Pesan user boleh punya file: { name, mimeType, size, data } (data = base64, hilang setelah reload)
// Pesan model boleh punya written: { entries, profile, budgets } = yang ditulis ke buku catatan lewat jawaban itu
const conversation = [];

// Buku catatan: profile = { currency, monthlyIncome, monthlySaving, goalName, goalAmount, goalSaved }
// budgets = { Food: 1000000, ... } (batas per bulan), entries = [{ id, date: 'YYYY-MM-DD', label, amount, category }]
const notebook = loadNotebook();

// Kolom anggaran dan pilihan kategori dibuat dari daftar yang sama supaya tidak pernah berbeda
const budgetInputs = {};
for (const category of CATEGORIES) {
  expenseCategory.appendChild(document.createElement('option')).textContent = category;

  const field = document.createElement('div');
  field.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = `budget-${category.toLowerCase()}`;
  label.textContent = category;
  const amount = document.createElement('input');
  amount.type = 'text';
  amount.id = label.htmlFor;
  amount.inputMode = 'decimal';
  amount.autocomplete = 'off';
  field.append(label, amount);
  budgetFields.appendChild(field);
  budgetInputs[category] = amount;
}

let pendingFile = null;
let shownMonth = today().slice(0, 7);

// Baris "label: jumlah uang" ditampilkan sebagai baris buku kas
const AMOUNT_ROW = /^(.{1,60}?)\s*[:=]\s*((?:Rp\.?|IDR|USD|US\$|\$|€|£)\s?\d[\d.,]*(?:\s?(?:k|rb|ribu|jt|juta|million|billion))?(?:\s?\/\s?\w+|\s+per\s+\w+)?)$/i;

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const file = pendingFile;
  const userMessage = input.value.trim() || (file ? 'Add this to my notebook.' : '');
  if (!userMessage || sendButton.disabled) return;

  input.value = '';
  clearPendingFile();
  sendMessage(userMessage, true, file);
});

document.querySelectorAll('.starter-question').forEach(function (button) {
  button.addEventListener('click', function () {
    if (sendButton.disabled) return;
    sendMessage(button.textContent, true, null);
  });
});

document.getElementById('starter-receipt').addEventListener('click', () => fileInput.click());
attachButton.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', function () {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;

  if (!FILE_TYPES.includes(file.type)) {
    return showAttachmentError('That file type is not supported. Choose a JPG, PNG, or WebP photo, or a PDF.');
  }
  if (file.size > MAX_FILE_BYTES) {
    return showAttachmentError('That file is larger than 4 MB. Choose a smaller one.');
  }
  const used = conversation.reduce((sum, m) => sum + (m.file && m.file.data ? m.file.size : 0), 0);
  if (used + file.size > MAX_TOTAL_BYTES) {
    return showAttachmentError('This chat already holds as many files as it can. Start a new chat to attach more.');
  }

  const reader = new FileReader();
  reader.onload = function () {
    pendingFile = { name: file.name, mimeType: file.type, size: file.size, data: reader.result.split(',')[1] };
    attachmentName.textContent = file.name;
    attachment.hidden = false;
    attachmentError.hidden = true;
    input.focus();
  };
  reader.onerror = () => showAttachmentError("That file couldn't be read. Try choosing it again.");
  reader.readAsDataURL(file);
});

attachmentRemove.addEventListener('click', function () {
  clearPendingFile();
  attachButton.focus();
});

newChatButton.addEventListener('click', function () {
  if (sendButton.disabled) return;
  if (!confirm('Start a new chat? This conversation will be deleted. Your notebook stays.')) return;

  conversation.length = 0;
  saveConversation();
  chatBox.replaceChildren();
  clearPendingFile();
  emptyState.hidden = false;
  updateNewChatButton();
  input.focus();
});

themeToggle.addEventListener('click', function () {
  const dark = document.documentElement.dataset.theme !== 'dark';
  if (dark) document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch (e) {}
  updateThemeLabel();
});

showHomeButton.addEventListener('click', () => showView('home'));
showChatButton.addEventListener('click', () => showView('chat'));
showNotebookButton.addEventListener('click', () => showView('notebook'));
document.getElementById('go-to-chat').addEventListener('click', function () {
  showView('chat');
  input.focus();
});

document.getElementById('add-income').addEventListener('click', () => openNotebookAt(PROFILE_FIELDS[1].input));
setGoalButton.addEventListener('click', () => openNotebookAt(PROFILE_FIELDS[3].input));
setBudgetsButton.addEventListener('click', () => openNotebookAt(budgetInputs[CATEGORIES[0]]));
document.getElementById('see-notebook').addEventListener('click', () => showView('notebook'));
document.getElementById('ask-month').addEventListener('click', function () {
  showView('chat');
  if (!sendButton.disabled) sendMessage('How is my month going?', true, null);
});

expenseForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const label = expenseLabel.value.trim();
  const amount = parseAmount(expenseAmount.value);
  expenseStatus.classList.add('problem');
  if (!label) {
    expenseStatus.textContent = 'Write what you bought.';
    return expenseLabel.focus();
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    expenseStatus.textContent = 'The amount needs to be a number above zero, for example 25000.';
    return expenseAmount.focus();
  }

  notebook.entries.push({ id: newId(), date: today(), label, amount, category: expenseCategory.value });
  saveNotebook();
  renderNotebook();
  expenseStatus.textContent = `Added ${label}, ${formatMoney(amount)}.`;
  expenseStatus.classList.remove('problem');
  expenseLabel.value = '';
  expenseAmount.value = '';
  expenseLabel.focus();
});

budgetForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const budgets = {};
  for (const category of CATEGORIES) {
    const text = budgetInputs[category].value.trim();
    if (!text) continue;
    const amount = parseAmount(text);
    if (!Number.isFinite(amount) || amount < 0) {
      budgetStatus.textContent = `The ${category} budget needs to be a number, for example 1000000.`;
      budgetStatus.classList.add('problem');
      return budgetInputs[category].focus();
    }
    if (amount > 0) budgets[category] = amount;
  }

  notebook.budgets = budgets;
  saveNotebook();
  renderNotebook();
  budgetStatus.textContent = 'Saved.';
  budgetStatus.classList.remove('problem');
});

monthPrev.addEventListener('click', () => changeMonth(-1));
monthNext.addEventListener('click', () => changeMonth(1));

profileForm.addEventListener('submit', function (e) {
  e.preventDefault();

  const profile = {};
  for (const field of PROFILE_FIELDS) {
    const text = field.input.value.trim();
    if (!text) continue;
    if (!field.money) {
      profile[field.key] = text;
      continue;
    }
    const amount = parseAmount(text);
    if (!Number.isFinite(amount) || amount < 0) {
      profileStatus.textContent = `${field.label} needs to be a number, for example 1500000.`;
      profileStatus.classList.add('problem');
      field.input.focus();
      return;
    }
    profile[field.key] = amount;
  }

  notebook.profile = profile;
  saveNotebook();
  renderNotebook();
  profileStatus.textContent = 'Saved.';
  profileStatus.classList.remove('problem');
});

document.getElementById('erase-notebook').addEventListener('click', function () {
  if (!confirm('Erase your notebook? Every expense and your details will be deleted.')) return;

  notebook.profile = {};
  notebook.budgets = {};
  notebook.entries = [];
  saveNotebook();
  renderNotebook();
  budgetStatus.textContent = '';
  profileStatus.textContent = 'Notebook erased.';
  profileStatus.classList.remove('problem');
});

updateThemeLabel();
restoreConversation();
showView('home');

function updateThemeLabel() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeToggle.textContent = dark ? 'Light theme' : 'Dark theme';
}

function updateNewChatButton() {
  newChatButton.hidden = chatScroll.hidden || !chatBox.children.length;
}

function showView(name) {
  const views = { home: [homeView, showHomeButton], notebook: [notebookView, showNotebookButton], chat: [chatScroll, showChatButton] };
  for (const [key, [view, tab]] of Object.entries(views)) {
    view.hidden = key !== name;
    tab.setAttribute('aria-pressed', String(key === name));
  }
  composer.hidden = name !== 'chat';
  updateNewChatButton();

  if (name === 'chat') {
    chatScroll.scrollTop = chatScroll.scrollHeight;
    return;
  }
  if (name === 'notebook') {
    // Buka di bulan ini; kalau bulan ini kosong, buka bulan terakhir yang ada isinya
    const months = notebook.entries.map((entry) => entry.date.slice(0, 7)).sort();
    shownMonth = today().slice(0, 7);
    if (months.length && !months.includes(shownMonth)) shownMonth = months[months.length - 1];
  }
  profileStatus.textContent = '';
  budgetStatus.textContent = '';
  expenseStatus.textContent = '';
  renderNotebook();
}

function openNotebookAt(field) {
  showView('notebook');
  field.focus();
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRupiah() {
  return /^(rp|idr)/i.test(notebook.profile.currency || '');
}

function appendBar(parent, used, limit) {
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = used > limit ? 'bar-fill over' : 'bar-fill';
  fill.style.width = `${limit > 0 ? Math.min(100, (used / limit) * 100) : 100}%`;
  bar.appendChild(fill);
  parent.appendChild(bar);
}

function appendEntry(list, entry, onDelete) {
  const [year, month, day] = entry.date.split('-').map(Number);
  const date = new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const item = document.createElement('li');
  item.className = 'entry';
  const text = document.createElement('div');
  text.className = 'entry-text';
  text.append(entry.label);
  const meta = document.createElement('span');
  meta.className = 'entry-meta';
  meta.textContent = `${date}, ${entry.category}`;
  text.appendChild(meta);
  const amount = document.createElement('span');
  amount.className = 'entry-amount';
  amount.textContent = formatMoney(entry.amount);
  item.append(text, amount);

  if (onDelete) {
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet-button';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${entry.label}, ${formatMoney(entry.amount)}`);
    remove.addEventListener('click', onDelete);
    item.appendChild(remove);
  }
  list.appendChild(item);
}

function renderHome() {
  const now = new Date();
  const month = today().slice(0, 7);
  const entries = notebook.entries.filter((entry) => entry.date.startsWith(month));
  const spent = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const byCategory = {};
  for (const entry of entries) byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.amount;

  // Angka utama: sisa rencana bulan ini dibagi hari yang tersisa, termasuk hari ini
  const { monthlyIncome: income, monthlySaving: saving = 0, goalName, goalAmount, goalSaved = 0 } = notebook.profile;
  todayKnown.hidden = income === undefined;
  todayUnknown.hidden = income !== undefined;
  if (income !== undefined) {
    const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
    const left = income - saving - spent;
    const perDay = isRupiah() ? Math.floor(left / daysLeft) : Math.floor((left / daysLeft) * 100) / 100;
    const sum = `${formatMoney(income)} income${saving ? `, minus ${formatMoney(saving)} saving` : ''}, minus ${formatMoney(spent)} spent`;

    todayAmount.classList.toggle('over', left < 0);
    if (left < 0) {
      todayLabel.textContent = "You are over this month's plan by";
      todayAmount.textContent = formatMoney(-left);
      todayPer.textContent = daysLeft === 1 ? 'on the last day of the month' : `with ${daysLeft} days left in the month`;
      todayNote.textContent = `${sum}.`;
    } else {
      todayLabel.textContent = 'You can spend';
      todayAmount.textContent = formatMoney(perDay);
      todayPer.textContent = daysLeft === 1 ? 'today, the last day of the month' : `a day for the next ${daysLeft} days`;
      todayNote.textContent = `${sum}, leaves ${formatMoney(left)}.`;
    }
  }

  const budgeted = CATEGORIES.filter((category) => notebook.budgets[category] > 0);
  budgetList.replaceChildren();
  for (const category of budgeted) {
    const limit = notebook.budgets[category];
    const used = byCategory[category] || 0;
    const item = document.createElement('li');
    const row = document.createElement('dl');
    row.className = 'ledger';
    appendLedgerRow(row, category, formatMoney(used));
    item.appendChild(row);
    appendBar(item, used, limit);
    const note = document.createElement('p');
    note.className = used > limit ? 'bar-note problem' : 'bar-note';
    note.textContent = used > limit
      ? `${formatMoney(used - limit)} over your ${formatMoney(limit)} budget.`
      : `${formatMoney(limit - used)} left of your ${formatMoney(limit)} budget.`;
    item.appendChild(note);
    budgetList.appendChild(item);
  }
  budgetNone.hidden = budgeted.length > 0;
  setBudgetsButton.textContent = budgeted.length ? 'Change budgets' : 'Set budgets';

  const hasGoal = Boolean(goalName) && goalAmount > 0;
  goalList.replaceChildren();
  goalList.hidden = !hasGoal;
  setGoalButton.textContent = hasGoal ? 'Change goal' : 'Set a goal';
  if (!hasGoal) {
    goalNote.textContent = 'You have no savings goal yet. Set one to see how far along you are.';
  } else {
    const row = document.createElement('dl');
    row.className = 'ledger';
    appendLedgerRow(row, goalName, formatMoney(goalSaved));
    goalList.appendChild(row);
    appendBar(goalList, goalSaved, goalAmount);
    const remaining = goalAmount - goalSaved;
    const months = saving > 0 ? Math.ceil(remaining / saving) : 0;
    if (remaining <= 0) goalNote.textContent = `You have reached your ${formatMoney(goalAmount)} goal.`;
    else if (!saving) goalNote.textContent = `Saved toward ${formatMoney(goalAmount)}. Add how much you save each month to see when you reach it.`;
    else goalNote.textContent = `Saved toward ${formatMoney(goalAmount)}. Saving ${formatMoney(saving)} a month, you reach it in about ${months} ${months === 1 ? 'month' : 'months'}.`;
  }

  const recent = [...notebook.entries].reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  recentSection.hidden = !recent.length;
  recentList.replaceChildren();
  for (const entry of recent) appendEntry(recentList, entry);
}

function showAttachmentError(text) {
  attachmentError.textContent = text;
  attachmentError.hidden = false;
}

function clearPendingFile() {
  pendingFile = null;
  attachment.hidden = true;
  attachmentError.hidden = true;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function loadNotebook() {
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(NOTEBOOK_KEY));
  } catch (e) {}
  return {
    profile: saved && saved.profile && typeof saved.profile === 'object' ? saved.profile : {},
    budgets: saved && saved.budgets && typeof saved.budgets === 'object' ? saved.budgets : {},
    entries: saved && Array.isArray(saved.entries) ? saved.entries : [],
  };
}

function saveNotebook() {
  try {
    localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(notebook));
  } catch (e) {}
}

// "5.000.000" dan "5,000,000" dibaca sebagai lima juta, "12.50" sebagai dua belas setengah
function parseAmount(text) {
  let digits = text.replace(/[^\d.,]/g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(digits)) digits = digits.replace(/[.,]/g, '');
  return digits ? Number(digits.replace(/,/g, '')) : NaN;
}

function formatNumber(amount) {
  return new Intl.NumberFormat(isRupiah() ? 'id-ID' : 'en-US', { maximumFractionDigits: 2 }).format(amount);
}

function formatMoney(amount) {
  const currency = notebook.profile.currency;
  return currency ? `${currency} ${formatNumber(amount)}` : formatNumber(amount);
}

function appendLedgerRow(list, label, value) {
  const row = document.createElement('div');
  row.className = 'ledger-row';
  row.appendChild(document.createElement('dt')).textContent = label;
  row.appendChild(document.createElement('dd')).textContent = value;
  list.appendChild(row);
}

// Menyimpan pengeluaran, data profil, dan anggaran yang ditulis model, lalu mengembalikan apa saja yang tersimpan
function writeToNotebook(entries, profile, budgets) {
  const added = (Array.isArray(entries) ? entries : []).map(({ date, label, amount, category }) => ({
    id: newId(),
    date,
    label,
    amount,
    category,
  }));
  const changed = profile && typeof profile === 'object' ? profile : {};
  const limits = budgets && typeof budgets === 'object' ? budgets : {};
  if (!added.length && !Object.keys(changed).length && !Object.keys(limits).length) return null;

  notebook.entries.push(...added);
  Object.assign(notebook.profile, changed);
  Object.assign(notebook.budgets, limits);
  saveNotebook();
  renderNotebook();
  return { entries: added, profile: changed, budgets: limits };
}

function changeMonth(step) {
  const [year, month] = shownMonth.split('-').map(Number);
  const moved = new Date(year, month - 1 + step, 1);
  shownMonth = `${moved.getFullYear()}-${String(moved.getMonth() + 1).padStart(2, '0')}`;
  renderNotebook();
}

// Home dan Notebook membaca data yang sama, jadi keduanya selalu digambar ulang bersama
function renderNotebook() {
  renderHome();

  for (const field of PROFILE_FIELDS) {
    const value = notebook.profile[field.key];
    field.input.value = value === undefined ? '' : field.money ? formatNumber(value) : value;
  }
  for (const category of CATEGORIES) {
    const limit = notebook.budgets[category];
    budgetInputs[category].value = limit > 0 ? formatNumber(limit) : '';
  }

  const hasEntries = notebook.entries.length > 0;
  notebookEmpty.hidden = hasEntries;
  notebookMonth.hidden = !hasEntries;
  if (!hasEntries) return;

  const thisMonth = today().slice(0, 7);
  const firstMonth = notebook.entries.reduce((first, entry) => (entry.date < first ? entry.date : first), today()).slice(0, 7);
  monthPrev.disabled = shownMonth <= firstMonth;
  monthNext.disabled = shownMonth >= thisMonth;

  const [year, month] = shownMonth.split('-').map(Number);
  monthTitle.textContent = new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const entries = notebook.entries.filter((entry) => entry.date.startsWith(shownMonth)).sort((a, b) => b.date.localeCompare(a.date));
  const spent = entries.reduce((sum, entry) => sum + entry.amount, 0);
  monthTotal.textContent = `${formatMoney(spent)} spent`;
  monthDetails.hidden = !entries.length;

  const income = notebook.profile.monthlyIncome;
  if (!entries.length) monthLeft.textContent = 'Nothing is written for this month.';
  else if (income === undefined) monthLeft.textContent = 'Add your monthly income below to see what is left.';
  else if (spent > income) monthLeft.textContent = `That is ${formatMoney(spent - income)} more than your ${formatMoney(income)} income.`;
  else monthLeft.textContent = `${formatMoney(income - spent)} left from your ${formatMoney(income)} income.`;

  const byCategory = {};
  for (const entry of entries) byCategory[entry.category] = (byCategory[entry.category] || 0) + entry.amount;
  categoryList.replaceChildren();
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, amount]) => appendLedgerRow(categoryList, category, formatMoney(amount)));

  entryList.replaceChildren();
  for (const entry of entries) {
    appendEntry(entryList, entry, function () {
      notebook.entries = notebook.entries.filter((other) => other.id !== entry.id);
      saveNotebook();
      renderNotebook();
      notebookView.focus();
    });
  }
}

// Isi file tidak disimpan (kuota localStorage kecil), hanya namanya
function saveConversation() {
  const saved = conversation.map(function ({ role, text, file, written }) {
    const message = { role, text };
    if (file) message.file = { name: file.name };
    if (written) message.written = written;
    return message;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (e) {}
}

function restoreConversation() {
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {}
  if (!Array.isArray(saved) || !saved.length) return;

  for (const message of saved) {
    conversation.push(message);
    if (message.role === 'user') {
      appendMessage('user', message.text, message.file);
    } else {
      const botMessage = appendMessage('bot', '');
      renderReply(botMessage, message.text);
      if (message.written) renderWritten(botMessage, message.written);
    }
  }
  emptyState.hidden = true;
  updateNewChatButton();
  chatScroll.scrollTop = chatScroll.scrollHeight;
}

async function sendMessage(userMessage, showUserMessage, file) {
  emptyState.hidden = true;
  // Tombol "Try again" lama dibuang supaya urutan riwayat tidak tertukar
  chatBox.querySelectorAll('.retry').forEach((button) => button.remove());

  if (showUserMessage) appendMessage('user', userMessage, file);
  conversation.push(file ? { role: 'user', text: userMessage, file } : { role: 'user', text: userMessage });

  const botMessage = appendMessage('bot', file ? 'Reading your file' : 'Writing a reply');
  const dots = document.createElement('span');
  dots.className = 'typing';
  dots.setAttribute('aria-hidden', 'true');
  dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'));
  botMessage.appendChild(dots);
  sendButton.disabled = true;
  updateNewChatButton();

  try {
    const payload = conversation.map(({ role, text, file }) =>
      file && file.data ? { role, text, file: { mimeType: file.mimeType, data: file.data } } : { role, text }
    );
    const pages = notebook.entries.map(({ date, label, amount, category }) => ({ date, label, amount, category }));
    let response;
    try {
      response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: payload, notebook: { profile: notebook.profile, budgets: notebook.budgets, entries: pages }, today: today() }),
      });
    } catch (networkError) {
      throw new Error("I can't reach the server. Check your connection, then try again.");
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Chat request failed:', data.error || response.status);
      throw new Error('Something went wrong on our side while answering. Try again in a moment.');
    }
    if (!data.result) throw new Error('The reply came back empty. Try asking again.');

    const reply = { role: 'model', text: data.result };
    renderReply(botMessage, data.result);
    const written = writeToNotebook(data.entries, data.profile, data.budgets);
    if (written) {
      reply.written = written;
      renderWritten(botMessage, written);
    }
    conversation.push(reply);
    saveConversation();
  } catch (error) {
    // Buang pesan user yang gagal supaya riwayat tetap berselang user/model
    conversation.pop();
    showError(botMessage, error.message, userMessage, file);
  } finally {
    sendButton.disabled = false;
    chatScroll.scrollTop = chatScroll.scrollHeight;
    input.focus();
  }
}

function appendMessage(sender, text, file) {
  const msg = document.createElement('div');
  msg.classList.add('message', sender);
  const speaker = document.createElement('span');
  speaker.className = 'visually-hidden';
  speaker.textContent = sender === 'user' ? 'You: ' : 'Assistant: ';
  msg.append(speaker, text);

  if (file) {
    if (file.data && file.mimeType.startsWith('image/')) {
      const preview = document.createElement('img');
      preview.className = 'attached-image';
      preview.src = `data:${file.mimeType};base64,${file.data}`;
      preview.alt = '';
      msg.appendChild(preview);
    }
    const note = document.createElement('div');
    note.className = 'attached';
    note.textContent = file.data ? `Attached: ${file.name}` : `Attached: ${file.name} (not kept after reloading the page)`;
    msg.appendChild(note);
  }

  chatBox.appendChild(msg);
  chatScroll.scrollTop = chatScroll.scrollHeight;
  return msg;
}

function showError(msg, text, failedMessage, failedFile) {
  msg.classList.add('error');
  const reason = document.createElement('p');
  reason.textContent = text;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'retry';
  retry.textContent = 'Try again';
  retry.addEventListener('click', function () {
    if (sendButton.disabled) return;
    msg.remove();
    sendMessage(failedMessage, false, failedFile);
  });
  msg.replaceChildren(reason, retry);
}

// Di bawah jawaban, tampilkan apa yang baru ditulis ke buku catatan, dengan tombol untuk membatalkannya
function renderWritten(msg, written) {
  const box = document.createElement('div');
  box.className = 'written';
  const title = document.createElement('p');
  title.className = 'written-title';
  title.textContent = 'Written in your notebook';
  const rows = document.createElement('dl');
  rows.className = 'ledger';

  for (const field of PROFILE_FIELDS) {
    const value = written.profile[field.key];
    if (value !== undefined) appendLedgerRow(rows, field.label, field.money ? formatMoney(value) : value);
  }
  for (const [category, limit] of Object.entries(written.budgets || {})) appendLedgerRow(rows, `${category} budget`, formatMoney(limit));
  for (const entry of written.entries) appendLedgerRow(rows, entry.label, formatMoney(entry.amount));
  box.append(title, rows);

  if (written.entries.length) {
    const removed = document.createElement('p');
    removed.textContent = 'Removed from your notebook.';
    const ids = written.entries.map((entry) => entry.id);

    if (notebook.entries.some((entry) => ids.includes(entry.id))) {
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'undo';
      undo.textContent = written.entries.length === 1 ? 'Remove this expense' : 'Remove these expenses';
      undo.addEventListener('click', function () {
        notebook.entries = notebook.entries.filter((entry) => !ids.includes(entry.id));
        saveNotebook();
        renderNotebook();
        undo.replaceWith(removed);
        input.focus();
      });
      box.appendChild(undo);
    } else {
      box.appendChild(removed);
    }
  }
  msg.appendChild(box);
}

// Markdown ringan dari Gemini (paragraf, daftar, tebal) dibangun sebagai node DOM, tanpa innerHTML
function renderReply(msg, text) {
  const speaker = document.createElement('span');
  speaker.className = 'visually-hidden';
  speaker.textContent = 'Assistant: ';
  msg.replaceChildren(speaker);

  let group = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      group = null;
      continue;
    }

    const item = line.match(/^(?:[-*•]|(\d+)[.)])\s+(.*)$/);
    const heading = line.match(/^#+\s+(.*)$/);
    const body = item ? item[2] : heading ? heading[1] : line;
    const amount = body.replace(/\*\*/g, '').match(AMOUNT_ROW);

    if (amount) {
      if (!group || group.tagName !== 'DL') group = appendBlock(msg, 'dl', 'ledger');
      appendLedgerRow(group, amount[1], amount[2]);
    } else if (item) {
      const tag = item[1] ? 'OL' : 'UL';
      if (!group || group.tagName !== tag) group = appendBlock(msg, tag);
      appendInline(group.appendChild(document.createElement('li')), body);
    } else {
      group = null;
      const paragraph = appendBlock(msg, 'p');
      if (heading) paragraph.appendChild(document.createElement('strong')).textContent = body.replace(/\*\*/g, '');
      else appendInline(paragraph, body);
    }
  }
}

function appendBlock(parent, tag, className) {
  const block = document.createElement(tag);
  if (className) block.className = className;
  return parent.appendChild(block);
}

function appendInline(parent, text) {
  text.split(/\*\*(.+?)\*\*/g).forEach(function (part, index) {
    if (!part) return;
    if (index % 2) parent.appendChild(document.createElement('strong')).textContent = part;
    else parent.append(part);
  });
}
