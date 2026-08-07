(function () {
  var PASS_KEY = '_fh_hub_pass';
  var currentTab = 'funil';
  var currentSite = 'all';
  var lastData = null;

  var gate = document.getElementById('gate');
  var app = document.getElementById('app');
  var passInput = document.getElementById('password');
  var gateError = document.getElementById('gate-error');
  var content = document.getElementById('content');
  var kpisEl = document.getElementById('kpis');
  var rangeSelect = document.getElementById('range');
  var siteSelect = document.getElementById('site');
  var tabs = document.getElementById('tabs');

  document.getElementById('enter').addEventListener('click', function () {
    tryLoad(passInput.value);
  });
  passInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryLoad(passInput.value);
  });
  document.getElementById('refresh').addEventListener('click', loadStats);
  rangeSelect.addEventListener('change', loadStats);
  siteSelect.addEventListener('change', function () {
    currentSite = siteSelect.value;
    if (lastData) renderAll(lastData);
  });
  tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    currentTab = btn.getAttribute('data-tab');
    tabs.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b === btn);
    });
    if (lastData) renderAll(lastData);
  });

  var saved = localStorage.getItem(PASS_KEY);
  if (saved) tryLoad(saved);

  function tryLoad(pass) {
    if (!pass) return;
    fetchStats(pass, rangeSelect.value)
      .then(function (data) {
        localStorage.setItem(PASS_KEY, pass);
        gate.classList.add('hidden');
        app.classList.remove('hidden');
        lastData = data;
        populateSites(data);
        renderAll(data);
      })
      .catch(function () {
        gateError.textContent = 'Senha incorreta.';
        localStorage.removeItem(PASS_KEY);
      });
  }

  function loadStats() {
    var pass = localStorage.getItem(PASS_KEY);
    content.innerHTML = '<p class="loading">Carregando…</p>';
    fetchStats(pass, rangeSelect.value)
      .then(function (data) {
        lastData = data;
        populateSites(data);
        renderAll(data);
      })
      .catch(function () {
        content.innerHTML = '<p class="empty">Não foi possível carregar os dados.</p>';
      });
  }

  function fetchStats(pass, days) {
    return fetch('/api/resumo?days=' + days, {
      headers: { 'X-Hub-Password': pass }
    }).then(function (res) {
      if (!res.ok) throw new Error('unauthorized');
      return res.json();
    });
  }

  function populateSites(data) {
    var sites = data.sites || [];
    var current = siteSelect.value;
    siteSelect.innerHTML = '<option value="all">Todos os sites</option>';
    sites.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      siteSelect.appendChild(opt);
    });
    if (sites.indexOf(current) !== -1) siteSelect.value = current;
    currentSite = siteSelect.value;
  }

  function matchesSite(funnelId) {
    return currentSite === 'all' || funnelId === currentSite;
  }

  // ================= KPIs =================
  function renderKpis(data) {
    var sessions = (data.sessions || []).filter(function (s) {
      return matchesSite(s.funnel_id);
    });
    var totalSessions = sessions.length;
    var converted = sessions.filter(function (s) {
      return s.events.some(function (ev) { return ev.event_type === 'checkout_click'; });
    }).length;
    var rate = totalSessions > 0 ? ((converted / totalSessions) * 100).toFixed(1) : '0.0';
    var sourcesCount = {};
    sessions.forEach(function (s) { sourcesCount[s.source] = (sourcesCount[s.source] || 0) + 1; });
    var topSource = Object.keys(sourcesCount).sort(function (a, b) { return sourcesCount[b] - sourcesCount[a]; })[0] || '—';

    kpisEl.innerHTML = '';
    var items = [
      { label: 'Visitantes', value: totalSessions },
      { label: 'Conversões', value: converted },
      { label: 'Taxa de conversão', value: rate + '%' },
      { label: 'Principal origem', value: topSource }
    ];
    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'kpi-card';
      card.innerHTML = '<div class="kpi-value">' + item.value + '</div><div class="kpi-label">' + item.label + '</div>';
      kpisEl.appendChild(card);
    });
  }

  function renderAll(data) {
    renderKpis(data);
    if (currentTab === 'funil') return renderFunil(data);
    if (currentTab === 'cliques') return renderCliques(data);
    if (currentTab === 'origens') return renderOrigens(data);
    if (currentTab === 'jornadas') return renderJornadas(data);
  }

  // ================= FUNIL =================
  function rank(key) {
    if (key === 'pageview') return [0, 0];
    if (key.indexOf('step_view:') === 0) return [1, parseFloat(key.split(':')[1]) || 0];
    if (key === 'checkout_click') return [3, 0];
    return [2, 0];
  }
  function stepLabel(key) {
    if (key === 'pageview') return 'Visualização';
    if (key === 'checkout_click') return 'Clique no checkout';
    if (key.indexOf('step_view:') === 0) return 'Etapa ' + key.split(':')[1];
    return key.replace(/_/g, ' ');
  }

  function renderFunil(data) {
    var funnels = data.funnels || {};
    var funnelIds = Object.keys(funnels).filter(matchesSite);
    if (!funnelIds.length) {
      content.innerHTML = '<p class="empty">Nenhum evento registrado nesse período ainda. Confira se o capiau.js está instalado nas suas landing pages.</p>';
      return;
    }
    content.innerHTML = '';
    funnelIds.forEach(function (funnelId) {
      var card = document.createElement('div');
      card.className = 'card';
      var title = document.createElement('h2');
      title.textContent = funnelId;
      card.appendChild(title);

      var variants = funnels[funnelId];
      Object.keys(variants).sort().forEach(function (variant) {
        var block = document.createElement('div');
        block.className = 'variant-block';
        var vLabel = document.createElement('div');
        vLabel.className = 'variant-label';
        vLabel.innerHTML = 'Variante <b>' + variant + '</b>';
        block.appendChild(vLabel);

        var keys = Object.keys(variants[variant]).sort(function (a, b) {
          var ra = rank(a), rb = rank(b);
          return ra[0] - rb[0] || ra[1] - rb[1];
        });
        var maxCount = variants[variant][keys[0]] ? variants[variant][keys[0]].unique_sessions : 1;
        var prevCount = null;

        keys.forEach(function (key) {
          var stat = variants[variant][key];
          var count = stat.unique_sessions;
          var row = document.createElement('div');
          row.className = 'step-row';

          var name = document.createElement('div');
          name.className = 'step-name';
          name.textContent = stepLabel(key);

          var track = document.createElement('div');
          track.className = 'step-bar-track';
          var fill = document.createElement('div');
          fill.className = 'step-bar-fill';
          fill.style.width = Math.max(4, (count / maxCount) * 100) + '%';
          track.appendChild(fill);

          var countEl = document.createElement('div');
          countEl.className = 'step-count';
          countEl.textContent = count + ' sessões';

          var dropEl = document.createElement('div');
          dropEl.className = 'step-drop';
          if (prevCount === null) {
            dropEl.textContent = '—';
          } else {
            var pct = prevCount > 0 ? ((count / prevCount) * 100).toFixed(0) : 0;
            dropEl.textContent = pct + '% seguiu';
            if (pct >= 60) dropEl.classList.add('ok');
          }

          row.appendChild(name);
          row.appendChild(track);
          row.appendChild(countEl);
          row.appendChild(dropEl);
          block.appendChild(row);
          prevCount = count;
        });
        card.appendChild(block);
      });
      content.appendChild(card);
    });
  }

  // ================= CLIQUES =================
  function renderCliques(data) {
    var clicks = (data.clicks || []).filter(function (c) { return matchesSite(c.funnel_id); });
    if (!clicks.length) {
      content.innerHTML = '<p class="empty">Nenhum clique registrado nesse período ainda.</p>';
      return;
    }
    var maxCount = clicks[0].unique_sessions || 1;
    var card = document.createElement('div');
    card.className = 'card';
    var title = document.createElement('h2');
    title.textContent = 'Cliques por botão/link';
    card.appendChild(title);

    clicks.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'click-row';

      var name = document.createElement('div');
      name.className = 'click-label';
      var badge = c.is_conversion ? '<span class="tag tag--conversion">conversão</span> ' : '';
      var site = currentSite === 'all' ? '<span class="tag">' + c.funnel_id + '</span> ' : '';
      name.innerHTML = site + badge + escapeHtml(c.label || '(sem texto)');
      if (c.href) {
        var small = document.createElement('span');
        small.className = 'click-href';
        small.textContent = ' → ' + c.href;
        name.appendChild(small);
      }

      var track = document.createElement('div');
      track.className = 'step-bar-track';
      var fill = document.createElement('div');
      fill.className = 'step-bar-fill';
      fill.style.width = Math.max(4, (c.unique_sessions / maxCount) * 100) + '%';
      track.appendChild(fill);

      var countEl = document.createElement('div');
      countEl.className = 'step-count';
      countEl.textContent = c.unique_sessions + ' pessoas';

      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(countEl);
      card.appendChild(row);
    });
    content.innerHTML = '';
    content.appendChild(card);
  }

  // ================= ORIGENS =================
  function renderOrigens(data) {
    var sources = (data.sources || []).filter(function (s) { return matchesSite(s.funnel_id); });
    if (!sources.length) {
      content.innerHTML = '<p class="empty">Nenhuma origem registrada nesse período ainda.</p>';
      return;
    }
    var maxCount = Math.max.apply(null, sources.map(function (s) { return s.sessions; }));
    var card = document.createElement('div');
    card.className = 'card';
    var title = document.createElement('h2');
    title.textContent = 'De onde vêm os visitantes';
    card.appendChild(title);

    sources.forEach(function (s) {
      var row = document.createElement('div');
      row.className = 'click-row';

      var name = document.createElement('div');
      name.className = 'click-label';
      var site = currentSite === 'all' ? '<span class="tag">' + s.funnel_id + '</span> ' : '';
      name.innerHTML = site + escapeHtml(s.source);

      var track = document.createElement('div');
      track.className = 'step-bar-track';
      var fill = document.createElement('div');
      fill.className = 'step-bar-fill';
      fill.style.width = Math.max(4, (s.sessions / maxCount) * 100) + '%';
      track.appendChild(fill);

      var countEl = document.createElement('div');
      countEl.className = 'step-count';
      var pct = s.sessions > 0 ? ((s.converted / s.sessions) * 100).toFixed(0) : 0;
      countEl.textContent = s.sessions + ' · ' + pct + '% converteu';

      row.appendChild(name);
      row.appendChild(track);
      row.appendChild(countEl);
      card.appendChild(row);
    });
    content.innerHTML = '';
    content.appendChild(card);
  }

  // ================= JORNADAS =================
  function eventLabel(ev) {
    if (ev.event_type === 'pageview') return 'Entrou na página';
    if (ev.event_type === 'step_view') return 'Viu a etapa ' + ev.step;
    if (ev.event_type === 'checkout_click') return 'Clicou: ' + (ev.label || 'checkout') + ' (conversão)';
    return 'Clicou: ' + (ev.label || ev.event_type);
  }

  function renderJornadas(data) {
    var sessions = (data.sessions || []).filter(function (s) { return matchesSite(s.funnel_id); });
    if (!sessions.length) {
      content.innerHTML = '<p class="empty">Nenhuma sessão registrada nesse período ainda.</p>';
      return;
    }
    var card = document.createElement('div');
    card.className = 'card';
    var title = document.createElement('h2');
    title.textContent = 'Últimas jornadas de visitantes';
    card.appendChild(title);

    sessions.forEach(function (s) {
      var wrap = document.createElement('details');
      wrap.className = 'session';

      var converted = s.events.some(function (ev) { return ev.event_type === 'checkout_click'; });

      var summary = document.createElement('summary');
      summary.innerHTML =
        '<span class="session-id">#' + s.session_id + '</span>' +
        '<span class="session-source">' + escapeHtml(s.source) + '</span>' +
        '<span class="session-funnel">' + s.funnel_id + ' · variante ' + s.variant + '</span>' +
        (converted ? '<span class="session-converted">converteu</span>' : '');
      wrap.appendChild(summary);

      var timeline = document.createElement('div');
      timeline.className = 'timeline';
      s.events.forEach(function (ev) {
        var item = document.createElement('div');
        item.className = 'timeline-item';
        var time = new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        item.innerHTML = '<span class="timeline-dot"></span><span class="timeline-time">' + time + '</span><span>' + escapeHtml(eventLabel(ev)) + '</span>';
        timeline.appendChild(item);
      });
      wrap.appendChild(timeline);
      card.appendChild(wrap);
    });
    content.innerHTML = '';
    content.appendChild(card);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }
})();
