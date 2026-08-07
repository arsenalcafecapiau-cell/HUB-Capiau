(function () {
  var PASS_KEY = '_fh_hub_pass';
  var currentTab = 'sites';
  var currentSite = 'all';
  var lastData = null;

  var gate = document.getElementById('gate');
  var app = document.getElementById('app');
  var passInput = document.getElementById('password');
  var gateError = document.getElementById('gate-error');
  var content = document.getElementById('content');
  var kpisEl = document.getElementById('kpis');
  var rangeSelect = document.getElementById('range');
  var tabs = document.getElementById('tabs');
  var filterChip = document.getElementById('filterChip');
  var filterChipSite = document.getElementById('filterChipSite');
  var filterChipClear = document.getElementById('filterChipClear');

  document.getElementById('enter').addEventListener('click', function () {
    tryLoad(passInput.value);
  });
  passInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryLoad(passInput.value);
  });
  document.getElementById('refresh').addEventListener('click', loadStats);
  rangeSelect.addEventListener('change', loadStats);
  filterChipClear.addEventListener('click', function () {
    currentSite = 'all';
    if (lastData) renderAll(lastData);
  });
  tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    setTab(btn.getAttribute('data-tab'));
  });

  function setTab(tab) {
    currentTab = tab;
    tabs.querySelectorAll('.tab-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    if (lastData) renderAll(lastData);
  }

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

  function matchesSite(funnelId) {
    return currentSite === 'all' || funnelId === currentSite;
  }

  function siteStats(data, funnelId) {
    var sessions = (data.sessions || []).filter(function (s) {
      return funnelId === 'all' || s.funnel_id === funnelId;
    });
    var totalSessions = sessions.length;
    var uniqueVisitors = new Set(sessions.map(function (s) { return s.visitor_id; })).size;
    var converted = sessions.filter(function (s) {
      return s.events.some(function (ev) { return ev.event_type === 'checkout_click'; });
    }).length;
    var rate = totalSessions > 0 ? ((converted / totalSessions) * 100).toFixed(1) : '0.0';
    var sourcesCount = {};
    sessions.forEach(function (s) { sourcesCount[s.source] = (sourcesCount[s.source] || 0) + 1; });
    var topSource = Object.keys(sourcesCount).sort(function (a, b) { return sourcesCount[b] - sourcesCount[a]; })[0] || '—';
    return { totalSessions: totalSessions, uniqueVisitors: uniqueVisitors, converted: converted, rate: rate, topSource: topSource };
  }

  // ================= KPIs + filtro ativo =================
  function renderKpis(data) {
    var stats = siteStats(data, currentSite);
    kpisEl.innerHTML = '';
    var items = [
      { label: 'Visitas', value: stats.totalSessions },
      { label: 'Visitantes únicos', value: stats.uniqueVisitors },
      { label: 'Conversões', value: stats.converted },
      { label: 'Taxa de conversão', value: stats.rate + '%' },
      { label: 'Principal origem', value: stats.topSource }
    ];
    items.forEach(function (item) {
      var card = document.createElement('div');
      card.className = 'kpi-card';
      card.innerHTML = '<div class="kpi-value">' + item.value + '</div><div class="kpi-label">' + item.label + '</div>';
      kpisEl.appendChild(card);
    });

    if (currentSite === 'all') {
      filterChip.classList.add('hidden');
    } else {
      filterChip.classList.remove('hidden');
      filterChipSite.textContent = currentSite;
    }
  }

  function renderAll(data) {
    renderKpis(data);
    if (currentTab === 'sites') return renderSites(data);
    if (currentTab === 'visitas') return renderVisitas(data);
    if (currentTab === 'funil') return renderFunil(data);
    if (currentTab === 'conversao') return renderConversao(data);
  }

  // ================= SITES =================
  function renderSites(data) {
    var sites = data.sites || [];
    if (!sites.length) {
      content.innerHTML = '<p class="empty">Nenhum site com dados ainda. Confira se o capiau.js está instalado nas suas landing pages.</p>';
      return;
    }
    var grid = document.createElement('div');
    grid.className = 'site-grid';

    var allCard = buildSiteCard('all', 'Todos os sites', siteStats(data, 'all'));
    grid.appendChild(allCard);

    sites.forEach(function (site) {
      grid.appendChild(buildSiteCard(site, site, siteStats(data, site)));
    });

    content.innerHTML = '';
    content.appendChild(grid);
  }

  function buildSiteCard(id, name, stats) {
    var card = document.createElement('button');
    card.className = 'site-card' + (currentSite === id ? ' active' : '');
    card.innerHTML =
      '<div class="site-name">' + escapeHtml(name) + '</div>' +
      '<div class="site-metric"><span class="site-metric-value">' + stats.totalSessions + '</span><span class="site-metric-label">visitas</span></div>' +
      '<div class="site-row"><span>' + stats.uniqueVisitors + ' visitantes únicos</span></div>' +
      '<div class="site-row"><span>' + stats.converted + ' conversões</span><span class="site-rate">' + stats.rate + '%</span></div>' +
      '<div class="site-row site-row--muted">Principal origem: ' + escapeHtml(stats.topSource) + '</div>';
    card.addEventListener('click', function () {
      currentSite = id;
      setTab('visitas');
    });
    return card;
  }

  // ================= VISITAS (origem + jornada) =================
  function renderVisitas(data) {
    content.innerHTML = '';

    var sources = (data.sources || []).filter(function (s) { return matchesSite(s.funnel_id); });
    var sourceCard = document.createElement('div');
    sourceCard.className = 'card';
    var sourceTitle = document.createElement('h2');
    sourceTitle.textContent = 'De onde vêm os visitantes';
    sourceCard.appendChild(sourceTitle);

    if (!sources.length) {
      var p = document.createElement('p');
      p.className = 'empty';
      p.textContent = 'Nenhuma origem registrada nesse período ainda.';
      sourceCard.appendChild(p);
    } else {
      var maxCount = Math.max.apply(null, sources.map(function (s) { return s.sessions; }));
      sources.forEach(function (s) {
        var row = document.createElement('div');
        row.className = 'click-row';
        var name = document.createElement('div');
        name.className = 'click-label';
        var siteTag = currentSite === 'all' ? '<span class="tag">' + s.funnel_id + '</span> ' : '';
        name.innerHTML = siteTag + escapeHtml(s.source);
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
        sourceCard.appendChild(row);
      });
    }
    content.appendChild(sourceCard);

    var sessions = (data.sessions || []).filter(function (s) { return matchesSite(s.funnel_id); });
    var journeyCard = document.createElement('div');
    journeyCard.className = 'card';
    var journeyTitle = document.createElement('h2');
    journeyTitle.textContent = 'Jornada de cada visitante';
    journeyCard.appendChild(journeyTitle);

    if (!sessions.length) {
      var p2 = document.createElement('p');
      p2.className = 'empty';
      p2.textContent = 'Nenhuma sessão registrada nesse período ainda.';
      journeyCard.appendChild(p2);
    } else {
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
        journeyCard.appendChild(wrap);
      });
    }
    content.appendChild(journeyCard);
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
      content.innerHTML = '<p class="empty">Nenhum evento registrado nesse período ainda.</p>';
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

  // ================= CONVERSÃO (cliques, com destaque pra conversão) =================
  function renderConversao(data) {
    var clicks = (data.clicks || []).filter(function (c) { return matchesSite(c.funnel_id); });
    if (!clicks.length) {
      content.innerHTML = '<p class="empty">Nenhum clique registrado nesse período ainda.</p>';
      return;
    }
    clicks = clicks.slice().sort(function (a, b) {
      if (a.is_conversion !== b.is_conversion) return a.is_conversion ? -1 : 1;
      return b.unique_sessions - a.unique_sessions;
    });
    var maxCount = Math.max.apply(null, clicks.map(function (c) { return c.unique_sessions; }));
    var card = document.createElement('div');
    card.className = 'card';
    var title = document.createElement('h2');
    title.textContent = 'Cliques e conversões por botão/link';
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

  // ================= util =================
  function eventLabel(ev) {
    if (ev.event_type === 'pageview') return 'Entrou na página';
    if (ev.event_type === 'step_view') return 'Viu a etapa ' + ev.step;
    if (ev.event_type === 'checkout_click') return 'Clicou: ' + (ev.label || 'checkout') + ' (conversão)';
    if (ev.event_type === 'saiu_da_pagina') return 'Saiu (' + (ev.label || '') + (ev.step ? ', última etapa vista: ' + ev.step : '') + ')';
    return 'Clicou: ' + (ev.label || ev.event_type);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : str;
    return div.innerHTML;
  }
})();
