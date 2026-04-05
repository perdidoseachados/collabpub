const API = 'https://collab-f8hw.onrender.com';
let roteiros = [];
let filtroAtual = 'todos';
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
    document.getElementById('login-error').style.display = 'none';

    try {
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
        document.getElementById('login-error').style.display = 'block';
      }
    } catch {
      document.getElementById('login-error').textContent = 'API offline, tente em 30s';
      document.getElementById('login-error').style.display = 'block';
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
  if (filtroAtual !== 'todos') {
    filtered = roteiros.filter(r => r.status === filtroAtual);
  }

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty">Nenhum roteiro ' +
      (filtroAtual !== 'todos' ? 'com status "' + filtroAtual + '"' : 'ainda') +
      '. Crie um!</div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const badgeClass = 'badge-' + r.status.replace(/ /g, '-');
    return '<div class="card" data-id="' + r.id + '">' +
      '<div class="card-header">' +
        '<span class="card-title">' + esc(r.titulo) + '</span>' +
        '<span class="badge ' + badgeClass + '">' + r.status + '</span>' +
      '</div>' +
      '<div class="card-meta">' +
        starsHTML(r.rating) + ' ' +
        r.criado_em + ' | ' + r.formato + ' | ' + r.plataforma +
        (r.agendamento ? ' | Agendado: ' + r.agendamento : '') +
      '</div>' +
      (r.texto ? '<div class="card-texto">' + esc(r.texto).substring(0, 150) + (r.texto.length > 150 ? '...' : '') + '</div>' : '') +
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

function openEditModal(id) {
  const r = roteiros.find(x => x.id === id);
  if (!r) return;
  document.getElementById('modal-titulo').textContent = 'Editar: ' + r.titulo;

  let html = '<form id="edit-form" style="display:flex;flex-direction:column;gap:12px">';
  html += '<label>Titulo<input type="text" name="titulo" value="' + esc(r.titulo) + '" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3"></label>';
  html += '<label>Texto / Reflexao<textarea name="texto" rows="4" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3">' + esc(r.texto || '') + '</textarea></label>';
  html += '<label>Descricao Visual<textarea name="visual" rows="2" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3">' + esc(r.visual || '') + '</textarea></label>';
  html += '<label>Pergunta Final<input type="text" name="pergunta" value="' + esc(r.pergunta || '') + '" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3"></label>';
  html += '<div style="display:flex;gap:12px">';
  html += '<label style="flex:1">Duracao (s)<input type="number" name="duracao" value="' + (r.duracao || 20) + '" min="5" max="120" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3"></label>';
  html += '<label style="flex:1">Formato<select name="formato" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3"><option value="slideshow"' + (r.formato === 'slideshow' ? ' selected' : '') + '>Slideshow</option><option value="carrossel"' + (r.formato === 'carrossel' ? ' selected' : '') + '>Carrossel</option></select></label>';
  html += '<label style="flex:1">Plataforma<select name="plataforma" style="display:block;width:100%;padding:8px;background:#0d1117;border:1px solid #30363d;border-radius:6px;color:#e6edf3"><option value="tiktok"' + (r.plataforma === 'tiktok' ? ' selected' : '') + '>TikTok</option><option value="instagram"' + (r.plataforma === 'instagram' ? ' selected' : '') + '>Instagram</option><option value="ambos"' + (r.plataforma === 'ambos' ? ' selected' : '') + '>Ambos</option></select></label>';
  html += '</div>';
  html += '<button type="submit" class="btn btn-aprovar" style="align-self:flex-start;margin-top:8px">Salvar</button>';
  html += '</form>';

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');

  document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    await fetch(API + '/api/roteiros/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titulo: fd.get('titulo'),
        texto: fd.get('texto'),
        visual: fd.get('visual'),
        pergunta: fd.get('pergunta'),
        duracao: parseInt(fd.get('duracao')) || 20,
        formato: fd.get('formato'),
        plataforma: fd.get('plataforma'),
      }),
    });
    closeModal();
    loadRoteiros();
  });
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
