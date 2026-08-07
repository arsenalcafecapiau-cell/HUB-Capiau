(function () {
  var PASS_KEY = '_fh_hub_pass';

  var gate = document.getElementById('gate');
  var app = document.getElementById('app');
  var passInput = document.getElementById('password');
  var gateError = document.getElementById('gate-error');
  var content = document.getElementById('content');
  var rangeSelect = document.getElementById('range');

  document.getElementById('enter').addEventListener('click', function () {
    tryLoad(passInput.value);
  });
  passInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') tryLoad(passInput.value);
  });
  document.getElementById('refresh').addEventListener('click', loadStats);
  rangeSelect.addEventListener('change', loadStats);

  // tenta entrar direto se já tiver senha salva
  var saved = localStorage.getItem(PASS_KEY);
  if (saved) tryLoad(saved);

  function tryLoad(pass) {
    if (!pass) return;
    fetchStats(pass, rangeSelect.value)
      .then(function (data) {
        localStorage.setItem(PASS_KEY, pass);
        gate.classList.add('hidden');
        app.classList.remove('hidden');
        render(data);
      })
      .catch(function () {
        gateError.textContent = 'Senha incorreta.';
        localStorage.removeItem(PASS_KEY);
      });
  }

  function loadStats() {
    var pass = localStorage.getItem(PASS_KEY);
    content.innerHTML = '<p class="loading">Carregando…</p>';
    fetchStats(pass, rangeSelect.value).then(render).catch(function () {
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

  // ---------- ordenação e nomes das etapas ----------
  function rank(key) {
    if (key === 'pageview') return [0, 0];
    if (key.indexOf('step_view:') === 0) return [1, parseFloat(key.split(':')[1]) || 0];
    if (key === 'checkout_click') return [3, 0];
    return [2, 0];
  }
  function label(key) {
    if (key === 'pageview') return 'Visualização';
    if (key === 'checkout_click') return 'Clique no checkout';
    if (key.indexOf('step_view:') === 0) return 'Etapa ' + key.split(':')[1];
    return key.replace(/_/g, ' ');
  }

  function render(data) {
    var funnels = data.funnels || {};
    var funnelIds = Object.keys(funnels);

    if (!funnelIds.length) {
      content.innerHTML = '<p class="empty">Nenhum evento registrado nesse período ainda. Confira se o capiau.js está instalado nas suas landing pages.</p>';
      return;
    }

    content.innerHTML = '';
    funnelIds.forEach(function (funnelId) {
      var card = document.createElement('div');
      card.className = 'funnel-card';

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
          name.textContent = label(key);

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
})();
