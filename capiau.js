/**
 * Funnel Hub — script de rastreamento
 * -----------------------------------
 * Como usar na sua landing page, logo antes do </body>:
 *
 * <script
 *   src="https://SEU-HUB.vercel.app/capiau.js"
 *   data-funnel="kit-welcome"
 *   data-ab="true"
 * ></script>
 *
 * data-funnel  -> obrigatório. Um "nome" único pra esse funil (ex: kit-welcome)
 * data-ab      -> opcional. "true" pra ativar teste A/B automático (50/50)
 * data-hub     -> opcional. Só precisa se o script estiver hospedado num domínio
 *                 diferente do hub (por padrão ele usa o mesmo domínio do próprio script)
 *
 * O QUE ELE FAZ SOZINHO:
 * - Manda um evento "pageview" assim que a página carrega
 * - Se a página tiver seções marcadas com data-fh-step="2" (etapa 2, 3, etc),
 *   manda "step_view" quando essa seção aparece na tela pela 1ª vez
 * - Se um botão/link tiver o atributo data-fh-event="checkout_click",
 *   manda esse evento automaticamente no clique (útil pro botão que vai pro checkout)
 *
 * PRA EVENTOS MANUAIS (em qualquer lugar do seu JS):
 *   window.fhTrack('checkout_click')
 *   window.fhTrack('step_view', { step: '3' })
 */
(function () {
  var scriptTag = document.currentScript;
  var FUNNEL_ID = scriptTag.getAttribute('data-funnel') || 'default';
  var AB_ENABLED = scriptTag.getAttribute('data-ab') === 'true';
  var HUB_ORIGIN = scriptTag.getAttribute('data-hub') || new URL(scriptTag.src).origin;
  var ENDPOINT = HUB_ORIGIN + '/api/evento';

  // ---------- sessão do visitante ----------
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  var SESSION_KEY = '_fh_sid';
  var sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = uuid();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  // ---------- variante A/B ----------
  var variant = 'A';
  if (AB_ENABLED) {
    var variantKey = '_fh_variant_' + FUNNEL_ID;
    variant = localStorage.getItem(variantKey);
    if (!variant) {
      variant = Math.random() < 0.5 ? 'A' : 'B';
      localStorage.setItem(variantKey, variant);
    }
  }

  // ---------- UTM (captura no primeiro toque e mantém durante a sessão) ----------
  var UTM_KEY = '_fh_utm';
  var utm = JSON.parse(sessionStorage.getItem(UTM_KEY) || 'null');
  if (!utm) {
    var params = new URLSearchParams(window.location.search);
    utm = {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      utm_term: params.get('utm_term') || ''
    };
    sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  }

  // ---------- envio ----------
  function send(eventType, extra) {
    var payload = Object.assign(
      {
        event_type: eventType,
        funnel_id: FUNNEL_ID,
        variant: variant,
        session_id: sessionId,
        url: window.location.href,
        referrer: document.referrer || ''
      },
      utm,
      extra || {}
    );

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors'
    }).catch(function (err) {
      console.warn('[funnel-hub] falha ao enviar evento', err);
    });
  }
  window.fhTrack = send;

  // ---------- pageview automático ----------
  send('pageview');

  // ---------- cliques: automático em qualquer link/botão/accordion + eventos manuais marcados ----------
  var lastStepSeen = '';
  document.addEventListener('click', function (e) {
    var el = e.target.closest('a, button, summary, [data-fh-event]');
    if (!el) return;

    var explicit = el.getAttribute('data-fh-event');
    var eventType = explicit || 'click';
    var stepEl = el.closest('[data-fh-step]');
    var step = el.getAttribute('data-fh-step') || (stepEl ? stepEl.getAttribute('data-fh-step') : '');
    var label = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    var href = el.tagName === 'A' ? el.href : '';

    send(eventType, { step: step, label: label, href: href });
  });

  // ---------- seções marcadas com data-fh-step (visualização de etapa) ----------
  var steps = document.querySelectorAll('[data-fh-step]');
  if (steps.length && 'IntersectionObserver' in window) {
    var seen = {};
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var step = entry.target.getAttribute('data-fh-step');
          if (entry.isIntersecting && !seen[step]) {
            seen[step] = true;
            lastStepSeen = step;
            send('step_view', { step: step });
          }
        });
      },
      { threshold: 0.5 }
    );
    steps.forEach(function (el) {
      observer.observe(el);
    });
  }
  // ---------- saiu da página / trocou de aba ----------
  var pageLoadTime = Date.now();
  var exitSent = false;
  function sendExit() {
    if (exitSent) return;
    exitSent = true;
    var seconds = Math.round((Date.now() - pageLoadTime) / 1000);
    var payload = Object.assign(
      {
        event_type: 'saiu_da_pagina',
        funnel_id: FUNNEL_ID,
        variant: variant,
        session_id: sessionId,
        url: window.location.href,
        referrer: document.referrer || '',
        step: lastStepSeen,
        label: 'ficou ' + seconds + 's na página'
      },
      utm
    );
    try {
      var blob = new Blob([JSON.stringify(payload)], { type: 'text/plain' });
      navigator.sendBeacon(ENDPOINT, blob);
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendExit();
  });
  window.addEventListener('pagehide', sendExit);
})();
