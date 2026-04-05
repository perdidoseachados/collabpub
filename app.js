const API = 'https://collab-f8hw.onrender.com';
let roteiros = [];
let filtroAtual = 'todos';
let buscaAtual = '';
let authToken = '';

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // Checa sessao salva
  const saved = sessionStorage.getItem('auth');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      authToken = data.token;
      showApp(data.user);
    } catch { showLogin(); }
  } else {
    showLogin();
  }

  setupLogin();
  setupTabs();
  setupFilters();
  setupForm();
  setupModal();
  setupStars();
  setupSearch();
});

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('user-name').textContent = user;
  checkStatus();
  loadRoteiros();
}

function setupLogin() {
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const btn = document.querySelector('#login-form button[type="submit"]');
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    // Mostrar spinner
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Conectando...';

    try {
      // Primeiro acorda o Render se estiver dormindo
      try { await fetch(API + '/', { signal: AbortSignal.timeout(5000) }); } catch {}

      const r = await fetch(API + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user, pass: pass }),
      });
      const d = await r.json();
      if (r.ok && d.token) {
        authToken = d.token;
        sessionStorage.setItem('auth', JSON.stringify({ token: d.token, user: d.user }));
        showApp(d.user);
      } else {
        errEl.textContent = 'Usuario ou senha incorretos';
        errEl.style.display = 'block';
      }
    } catch {
      // Render dormindo — tenta acordar e refazer
      btn.innerHTML = '<span class="spinner"></span> Acordando servidor...';
      try {
        await fetch(API + '/', { signal: AbortSignal.timeout(45000) });
        // Tenta login de novo
        const r2 = await fetch(API + '/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: user, pass: pass }),
        });
        const d2 = await r2.json();
        if (r2.ok && d2.token) {
          authToken = d2.token;
          sessionStorage.setItem('auth', JSON.stringify({ token: d2.token, user: d2.user }));
          showApp(d2.user);
        } else {
          errEl.textContent = 'Usuario ou senha incorretos';
          errEl.style.display = 'block';
        }
      } catch {
        errEl.textContent = 'Servidor offline. Tente novamente em 1 minuto.';
        errEl.style.display = 'block';
      }
    } finally {
      btn.disabled = false;
      btn.textContent = btn.dataset.originalText || 'Entrar';
    }
  });

  document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    sessionStorage.removeItem('auth');
    authToken = '';
    showLogin();
  });
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function setupStars() {
  document.querySelectorAll('.star-picker').forEach(picker => {
    const stars = picker.querySelectorAll('.star');
    const hidden = picker.parentElement.querySelector('input[type=hidden]');
    stars.forEach(star => {
      star.addEventListener('click', () => {
        const val = parseInt(star.dataset.val);
        hidden.value = val;
        stars.forEach(s => {
          s.textContent = parseInt(s.dataset.val) <= val ? '\u2605' : '\u2606';
          s.classList.toggle('active', parseInt(s.dataset.val) <= val);
        });
      });
      star.addEventListener('mouseenter', () => {
        const val = parseInt(star.dataset.val);
        stars.forEach(s => {
          s.textContent = parseInt(s.dataset.val) <= val ? '\u2605' : '\u2606';
        });
      });
    });
    picker.addEventListener('mouseleave', () => {
      const val = parseInt(hidden.value);
      stars.forEach(s => {
        s.textContent = parseInt(s.dataset.val) <= val ? '\u2605' : '\u2606';
        s.classList.toggle('active', parseInt(s.dataset.val) <= val);
      });
    });
  });
}

function starsHTML(rating) {
  let r = parseInt(rating) || 0;
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= r ? '\u2605' : '\u2606';
  return '<span class="stars-display">' + s + '</span>';
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
async function checkStatus() {
  try {
    const r = await fetch(API + '/');
    const d = await r.json();
    document.getElementById('status-bar').innerHTML =
      '<span class="online">&#9679;</span> API online' +
      (d.pipeline.running ? ' | <span style="color:#f0883e">Pipeline rodando...</span>' : '') +
      (d.pipeline.last_result ? ' | ' + d.pipeline.last_result : '');
  } catch {
    document.getElementById('status-bar').innerHTML =
      '<span class="offline">&#9679;</span> API offline (Render dormindo, aguarde ~30s)';
    setTimeout(checkStatus, 5000);
  }
}

// ---------------------------------------------------------------------------
// Roteiros CRUD
// ---------------------------------------------------------------------------
async function loadRoteiros() {
  try {
    const r = await fetch(API + '/api/roteiros');
    roteiros = await r.json();
    renderRoteiros();
    renderCalendario();
  } catch {
    document.getElementById('roteiros-list').innerHTML =
      '<div class="empty">Nao foi possivel carregar. API offline?</div>';
  }
}

function renderRoteiros() {
  const list = document.getElementById('roteiros-list');
  let filtered = roteiros;

  // Filtro por status
  if (filtroAtual !== 'todos') {
    filtered = filtered.filter(r => r.status === filtroAtual);
  }

  // Busca por texto
  if (buscaAtual) {
    var q = buscaAtual.toLowerCase();
    filtered = filtered.filter(r =>
      (r.titulo || '').toLowerCase().includes(q) ||
      (r.texto || '').toLowerCase().includes(q) ||
      (r.pergunta || '').toLowerCase().includes(q) ||
      (r.autor_ideia || '').toLowerCase().includes(q)
    );
  }

  // Ordenacao: agendados (por data) > polimento > aprovado > em producao > rascunho > publicado > repescagem > negado
  var statusOrder = {
    'aprovado': 1, 'em producao': 2, 'polimento': 3,
    'rascunho': 4, 'publicado': 5, 'repescagem': 6, 'negado': 7
  };
  filtered.sort(function(a, b) {
    // Agendados sempre primeiro, por data
    if (a.agendamento && !b.agendamento) return -1;
    if (!a.agendamento && b.agendamento) return 1;
    if (a.agendamento && b.agendamento) return a.agendamento.localeCompare(b.agendamento);
    // Depois por status
    var sa = statusOrder[a.status] || 99;
    var sb = statusOrder[b.status] || 99;
    if (sa !== sb) return sa - sb;
    // Depois por rating (maior primeiro)
    return (b.rating || 0) - (a.rating || 0);
  });

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty">Nenhum roteiro ' +
      (buscaAtual ? 'encontrado para "' + esc(buscaAtual) + '"' :
       filtroAtual !== 'todos' ? 'com status "' + filtroAtual + '"' : 'ainda') +
      '</div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const badgeClass = 'badge-' + r.status.replace(/ /g, '-');
    // Destaque da citacao no texto (entre aspas ou depois de "disse")
    var textoHtml = esc(r.texto || '').substring(0, 200) + (r.texto && r.texto.length > 200 ? '...' : '');
    textoHtml = textoHtml.replace(/((?:disse uma vez|certa vez disse|ouvi uma vez|alguem disse)[^.]*\.)/gi, '<span class="citacao-destaque">$1</span>');

    var tipoInfo = formatoBadge(r.formato);

    return '<div class="card" data-id="' + r.id + '">' +
      '<div class="card-header">' +
        '<span class="card-title">' + esc(r.titulo) + '</span>' +
        '<div class="card-badges">' +
          '<span class="tipo-badge tipo-' + (r.formato || 'slideshow') + '" title="' + tipoInfo.label + '">' +
            '<span class="tipo-shape">' + tipoInfo.shape + '</span> ' + tipoInfo.label +
          '</span>' +
          '<span class="badge ' + badgeClass + '">' + r.status + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="card-meta">' +
        starsHTML(r.rating) + ' ' +
        r.criado_em + ' | ' + r.formato + ' | ' + r.plataforma +
        (r.agendamento ? ' | <span style="color:#f0883e">Agendado: ' + r.agendamento + '</span>' : '') +
        (r.autor_ideia ? ' | <span class="autor-tag">' + esc(r.autor_ideia) + '</span>' : '') +
      '</div>' +
      (r.texto ? '<div class="card-texto">' + textoHtml + '</div>' : '') +
      (r.pergunta ? '<div class="card-pergunta">' + esc(r.pergunta) + '</div>' : '') +
      '<div class="card-actions">' +
        statusButtons(r) +
      '</div>' +
    '</div>';
  }).join('');

  // Bind action buttons
  list.querySelectorAll('[data-action]').forEach(btn => {
    if (btn.tagName === 'SELECT') {
      btn.addEventListener('change', (e) => {
        e.stopPropagation();
        handleAction(btn.dataset.id, 'change-status', btn.value);
      });
      btn.addEventListener('click', (e) => e.stopPropagation());
    } else {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAction(btn.dataset.id, btn.dataset.action);
      });
    }
  });

  // Click card to open modal
  list.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

function statusButtons(r) {
  let btns = '';
  // Dropdown de status
  btns += '<select class="status-dropdown" data-id="' + r.id + '" data-action="change-status">';
  var statuses = ['rascunho','polimento','aprovado','em producao','publicado','negado','repescagem'];
  statuses.forEach(function(s) {
    btns += '<option value="' + s + '"' + (r.status === s ? ' selected' : '') + '>' + s + '</option>';
  });
  btns += '</select>';
  // Ações específicas
  if (r.status === 'aprovado' || r.status === 'polimento') {
    btns += '<button class="btn btn-gerar" data-id="' + r.id + '" data-action="gerar">Gerar Video</button>';
  }
  if (r.status === 'publicado' && r.video_url) {
    btns += '<a class="btn btn-gerar" href="' + API + r.video_url + '" target="_blank">Download Video</a>';
  }
  btns += '<button class="btn btn-editar" data-id="' + r.id + '" data-action="editar">Editar</button>';
  btns += '<button class="btn btn-delete" data-id="' + r.id + '" data-action="delete">Excluir</button>';
  return btns;
}

async function handleAction(id, action, value) {
  if (action === 'delete') {
    if (!confirm('Excluir roteiro?')) return;
    await fetch(API + '/api/roteiros/' + id, { method: 'DELETE' });
    loadRoteiros();
    return;
  }
  if (action === 'gerar') {
    await fetch(API + '/api/roteiros/' + id + '/gerar');
    alert('Pipeline iniciado! Aguarde e recarregue.');
    loadRoteiros();
    checkStatus();
    return;
  }
  if (action === 'editar') {
    openEditModal(id);
    return;
  }
  if (action === 'change-status') {
    await fetch(API + '/api/roteiros/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: value }),
    });
    loadRoteiros();
    return;
  }
  // Update status (legacy)
  await fetch(API + '/api/roteiros/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: action }),
  });
  loadRoteiros();
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------
function formatoBadge(formato) {
  switch (formato) {
    case 'slideshow': return { shape: '\uD83C\uDFA5', label: 'video reel' };
    case 'carrossel': return { shape: '\uD83D\uDC49\uD83D\uDDBC\uFE0F', label: 'multiphotos' };
    default:          return { shape: '\uD83C\uDFA5', label: 'slideshow reel' };
  }
}

function setupSearch() {
  document.getElementById('search-input').addEventListener('input', (e) => {
    buscaAtual = e.target.value.trim();
    renderRoteiros();
  });
}

function setupFilters() {
  document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filtroAtual = btn.dataset.status;
      renderRoteiros();
    });
  });
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
function setupForm() {
  document.getElementById('form-roteiro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      titulo: fd.get('titulo'),
      texto: fd.get('texto'),
      visual: fd.get('visual'),
      pergunta: fd.get('pergunta'),
      duracao: parseInt(fd.get('duracao')) || 20,
      formato: fd.get('formato'),
      plataforma: fd.get('plataforma'),
      rating: parseInt(fd.get('rating')) || 0,
    };
    await fetch(API + '/api/roteiros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    e.target.reset();
    // Switch to roteiros tab
    document.querySelector('[data-tab="roteiros"]').click();
    loadRoteiros();
  });
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
function setupModal() {
  document.querySelector('.modal .close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal')) closeModal();
  });
}

function openModal(id) {
  const r = roteiros.find(x => x.id === id);
  if (!r) return;
  document.getElementById('modal-titulo').textContent = r.titulo;

  let html = '<div class="card-meta">Status: <span class="badge badge-' + r.status.replace(/ /g, '-') + '">' + r.status + '</span></div>';
  html += '<div class="card-meta">' + r.criado_em + ' | ' + r.formato + ' | ' + r.plataforma + '</div>';
  if (r.texto) html += '<div class="card-texto" style="margin:12px 0">' + esc(r.texto) + '</div>';
  if (r.visual) html += '<div class="card-meta">Visual: ' + esc(r.visual) + '</div>';
  if (r.pergunta) html += '<div class="card-pergunta" style="margin:8px 0">' + esc(r.pergunta) + '</div>';

  // Agendamento
  html += '<label style="margin-top:16px;display:block;font-size:0.9em;color:#8b949e">Agendamento';
  html += '<input type="datetime-local" id="modal-agenda" value="' + (r.agendamento || '') + '" style="display:block;width:100%;margin-top:4px;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3">';
  html += '</label>';
  html += '<button class="btn" style="margin-top:8px" onclick="salvarAgendamento(\'' + id + '\')">Salvar Agendamento</button>';

  // Status change
  html += '<div style="margin-top:16px"><strong>Mudar status:</strong></div>';
  html += '<div class="status-select">';
  ['rascunho','aprovado','negado','repescagem','publicado'].forEach(s => {
    html += '<button class="btn" onclick="mudarStatus(\'' + id + '\',\'' + s + '\')">' + s + '</button>';
  });
  html += '</div>';

  if (r.video_url) {
    html += '<a class="btn btn-gerar" href="' + API + r.video_url + '" target="_blank" style="display:inline-block;margin-top:12px">Download Video</a>';
  }

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function mudarStatus(id, status) {
  await fetch(API + '/api/roteiros/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status }),
  });
  closeModal();
  loadRoteiros();
}

// ---- Roteiro como arquivo de texto unico ----

function roteiroToText(r) {
  var sep = '════════════════════════════════════════';
  var lines = [];
  lines.push(sep);
  lines.push('  TITULO');
  lines.push(sep);
  lines.push(r.titulo || '');
  lines.push('');
  lines.push(sep);
  lines.push('  NARRACAO / REFLEXAO');
  lines.push(sep);
  lines.push(r.texto || '');
  lines.push('');
  lines.push(sep);
  lines.push('  PERGUNTA FINAL');
  lines.push(sep);
  lines.push(r.pergunta || '');
  lines.push('');
  lines.push(sep);
  lines.push('  DESCRICAO VISUAL');
  lines.push(sep);
  lines.push(r.visual || '');
  lines.push('');
  lines.push(sep);
  lines.push('  AUTOR DA IDEIA');
  lines.push(sep);
  lines.push(r.autor_ideia || '');
  lines.push('');
  lines.push(sep);
  lines.push('  CONFIG');
  lines.push(sep);
  lines.push('duracao: ' + (r.duracao || 60));
  lines.push('formato: ' + (r.formato || 'slideshow'));
  lines.push('plataforma: ' + (r.plataforma || 'tiktok'));
  lines.push('rating: ' + (r.rating || 0));
  return lines.join('\n');
}

function textToRoteiro(text) {
  var sep = /═{10,}/g;
  var blocks = text.split(sep).map(function(b) { return b.trim(); });
  // blocks: ['', 'TITULO', 'conteudo', '', 'NARRACAO...', 'conteudo', ...]
  var sections = {};
  var currentKey = null;
  blocks.forEach(function(block) {
    var label = block.trim().toUpperCase();
    if (label === 'TITULO') currentKey = 'titulo';
    else if (label.startsWith('NARRACAO') || label.startsWith('REFLEXAO')) currentKey = 'texto';
    else if (label.startsWith('PERGUNTA')) currentKey = 'pergunta';
    else if (label.startsWith('DESCRICAO VISUAL') || label === 'VISUAL') currentKey = 'visual';
    else if (label.startsWith('AUTOR')) currentKey = 'autor_ideia';
    else if (label === 'CONFIG') currentKey = 'config';
    else if (currentKey && block.trim()) {
      if (currentKey === 'config') {
        block.split('\n').forEach(function(line) {
          var m = line.match(/^(\w+):\s*(.+)$/);
          if (m) sections[m[1]] = m[2].trim();
        });
      } else {
        sections[currentKey] = block.trim();
      }
      currentKey = null;
    }
  });
  return sections;
}

function validateStructure(text) {
  var required = ['TITULO', 'NARRACAO', 'PERGUNTA', 'DESCRICAO VISUAL', 'AUTOR', 'CONFIG'];
  var missing = [];
  required.forEach(function(label) {
    if (text.toUpperCase().indexOf(label) === -1) missing.push(label);
  });
  var sepCount = (text.match(/═{10,}/g) || []).length;
  var errors = [];
  if (missing.length) errors.push('Secoes faltando: ' + missing.join(', '));
  if (sepCount < 12) errors.push('Separadores incompletos (' + sepCount + '/14). Nao apague as linhas ════');
  return errors;
}

function openEditModal(id) {
  const r = roteiros.find(x => x.id === id);
  if (!r) return;
  document.getElementById('modal-titulo').textContent = r.titulo;

  var fileText = roteiroToText(r);
  var user = document.getElementById('user-name').textContent || '?';
  var log = r.edit_log || [];

  var html = '<div class="edit-container">';

  // Validacao
  html += '<div id="edit-validation" class="edit-validation"></div>';

  // Textarea unico
  html += '<textarea id="edit-textarea" class="edit-textarea" spellcheck="false">' + esc(fileText) + '</textarea>';

  // Footer: meta info
  html += '<div class="edit-footer">';
  html += '<span>ID: ' + r.id + '</span>';
  html += '<span>Criado: ' + (r.criado_em || '?') + '</span>';
  html += '<span>Usuario: ' + esc(user) + '</span>';
  html += '<span>Status: ' + r.status + '</span>';
  html += '</div>';

  // Log de alteracoes
  if (log.length) {
    html += '<div class="edit-log"><strong>Historico:</strong>';
    log.slice(-5).forEach(function(entry) {
      html += '<div class="log-entry">' + esc(entry) + '</div>';
    });
    html += '</div>';
  }

  // Botoes
  html += '<div class="edit-actions">';
  html += '<button id="edit-save" class="btn btn-aprovar">Salvar</button>';
  html += '<button id="edit-cancel" class="btn" style="margin-left:8px">Cancelar</button>';
  html += '</div>';

  html += '</div>';

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');

  // Validacao em tempo real
  var textarea = document.getElementById('edit-textarea');
  var valDiv = document.getElementById('edit-validation');

  function runValidation() {
    var errors = validateStructure(textarea.value);
    if (errors.length) {
      valDiv.className = 'edit-validation edit-validation-error';
      valDiv.innerHTML = '&#9888; ' + errors.join(' | ');
    } else {
      valDiv.className = 'edit-validation edit-validation-ok';
      valDiv.innerHTML = '&#10003; Estrutura OK';
    }
  }
  runValidation();
  textarea.addEventListener('input', runValidation);

  // Auto-resize textarea
  function autoResize() {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(300, textarea.scrollHeight) + 'px';
  }
  autoResize();
  textarea.addEventListener('input', autoResize);

  // Salvar
  document.getElementById('edit-save').addEventListener('click', async function() {
    var errors = validateStructure(textarea.value);
    if (errors.length) {
      if (!confirm('Estrutura com problemas:\n' + errors.join('\n') + '\n\nSalvar mesmo assim?')) return;
    }
    var parsed = textToRoteiro(textarea.value);
    var now = new Date().toISOString().replace('T',' ').substring(0,16);
    var newLog = (r.edit_log || []).concat([now + ' | ' + user + ' | editou']);

    await fetch(API + '/api/roteiros/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: parsed.titulo || r.titulo,
        texto: parsed.texto || r.texto,
        visual: parsed.visual || r.visual,
        pergunta: parsed.pergunta || r.pergunta,
        autor_ideia: parsed.autor_ideia || r.autor_ideia || '',
        duracao: parseInt(parsed.duracao) || r.duracao || 60,
        formato: parsed.formato || r.formato || 'slideshow',
        plataforma: parsed.plataforma || r.plataforma || 'tiktok',
        rating: parseInt(parsed.rating) || r.rating || 0,
        edit_log: newLog,
      }),
    });
    closeModal();
    loadRoteiros();
  });

  // Cancelar
  document.getElementById('edit-cancel').addEventListener('click', closeModal);
}

async function salvarAgendamento(id) {
  const val = document.getElementById('modal-agenda').value;
  await fetch(API + '/api/roteiros/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agendamento: val }),
  });
  closeModal();
  loadRoteiros();
}

// ---------------------------------------------------------------------------
// Calendario
// ---------------------------------------------------------------------------
function renderCalendario() {
  const list = document.getElementById('cal-list');
  const agendados = roteiros.filter(r => r.agendamento).sort((a, b) => a.agendamento.localeCompare(b.agendamento));

  if (agendados.length === 0) {
    list.innerHTML = '<div class="empty">Nenhum roteiro agendado.</div>';
    return;
  }

  list.innerHTML = agendados.map(r => {
    const date = new Date(r.agendamento);
    const fmt = date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
    return '<div class="cal-item">' +
      '<span class="cal-date">' + fmt + '</span>' +
      '<span class="cal-title">' + esc(r.titulo) + '</span>' +
      '<span class="badge badge-' + r.status.replace(/ /g, '-') + '">' + r.status + '</span>' +
    '</div>';
  }).join('');
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}
