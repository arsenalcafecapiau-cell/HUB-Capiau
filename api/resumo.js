const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function classifySource(utmSource, referrer) {
  if (utmSource) {
    var s = utmSource.toLowerCase();
    if (s.indexOf('face') >= 0 || s.indexOf('insta') >= 0 || s === 'ig' || s === 'fb') return 'Anúncio (Meta)';
    if (s.indexOf('google') >= 0) return 'Anúncio (Google)';
    return 'Campanha: ' + utmSource;
  }
  if (!referrer) return 'Direto';
  try {
    var host = new URL(referrer).hostname.replace('www.', '');
    if (host.indexOf('instagram.com') >= 0) return 'Instagram';
    if (host.indexOf('facebook.com') >= 0) return 'Facebook';
    if (host.indexOf('google.') >= 0) return 'Google (busca)';
    return 'Outro (' + host + ')';
  } catch (e) {
    return 'Outro';
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var pass = req.headers['x-hub-password'];
  if (!pass || pass !== process.env.HUB_PASSWORD) {
    return res.status(401).json({ error: 'senha inválida' });
  }

  try {
    var days = parseInt(req.query.days || '30', 10);
    var since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('funnel_id, variant, event_type, step, label, href, session_id, visitor_id, referrer, utm_source, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) throw error;

    var siteList = Array.from(new Set(data.map(function (r) { return r.funnel_id; }))).sort();

    // ---------- 1) funil por etapa ----------
    var funnels = {};
    data.forEach(function (row) {
      var f = (funnels[row.funnel_id] = funnels[row.funnel_id] || {});
      var v = (f[row.variant] = f[row.variant] || {});
      var key = row.event_type + (row.step ? ':' + row.step : '');
      var bucket = (v[key] = v[key] || { count: 0, sessions: new Set() });
      bucket.count += 1;
      bucket.sessions.add(row.session_id);
    });
    var funnelsOut = {};
    Object.keys(funnels).forEach(function (funnelId) {
      funnelsOut[funnelId] = {};
      Object.keys(funnels[funnelId]).forEach(function (variant) {
        funnelsOut[funnelId][variant] = {};
        Object.keys(funnels[funnelId][variant]).forEach(function (key) {
          funnelsOut[funnelId][variant][key] = {
            events: funnels[funnelId][variant][key].count,
            unique_sessions: funnels[funnelId][variant][key].sessions.size
          };
        });
      });
    });

    // ---------- 2) cliques (por site + rótulo) ----------
    var clickMap = {};
    data.forEach(function (row) {
      if (row.event_type === 'pageview' || row.event_type === 'step_view' || row.event_type === 'saiu_da_pagina') return;
      var label = (row.label || row.href || row.event_type || 'clique sem nome').trim();
      var mapKey = row.funnel_id + '|' + label;
      var bucket = (clickMap[mapKey] = clickMap[mapKey] || {
        funnel_id: row.funnel_id,
        label: label,
        href: row.href || '',
        is_conversion: row.event_type === 'checkout_click',
        count: 0,
        sessions: new Set()
      });
      bucket.count += 1;
      bucket.sessions.add(row.session_id);
    });
    var clicks = Object.keys(clickMap)
      .map(function (key) {
        var c = clickMap[key];
        return {
          funnel_id: c.funnel_id,
          label: c.label,
          href: c.href,
          is_conversion: c.is_conversion,
          events: c.count,
          unique_sessions: c.sessions.size
        };
      })
      .sort(function (a, b) {
        return b.unique_sessions - a.unique_sessions;
      });

    // ---------- 3) sessões (jornada por visitante, em ordem) ----------
    var sessionMap = {};
    data.forEach(function (row) {
      var s = (sessionMap[row.session_id] = sessionMap[row.session_id] || {
        funnel_id: row.funnel_id,
        variant: row.variant,
        visitor_id: row.visitor_id,
        source: null,
        events: [],
        firstAt: row.created_at,
        lastAt: row.created_at
      });
      if (!s.source) s.source = classifySource(row.utm_source, row.referrer);
      s.lastAt = row.created_at;
      s.events.push({
        event_type: row.event_type,
        label: row.label || null,
        step: row.step || null,
        created_at: row.created_at
      });
    });

    // ---------- 4) origens de tráfego (por site + origem, com conversão) ----------
    var sourceMap = {};
    Object.keys(sessionMap).forEach(function (sid) {
      var s = sessionMap[sid];
      var mapKey = s.funnel_id + '|' + s.source;
      var bucket = (sourceMap[mapKey] = sourceMap[mapKey] || {
        funnel_id: s.funnel_id,
        source: s.source,
        sessions: 0,
        converted: 0
      });
      bucket.sessions += 1;
      var hasConversion = s.events.some(function (ev) {
        return ev.event_type === 'checkout_click';
      });
      if (hasConversion) bucket.converted += 1;
    });
    var sources = Object.values(sourceMap).sort(function (a, b) {
      return b.sessions - a.sessions;
    });

    // ---------- 5) jornadas recentes (últimas 40 sessões) ----------
    var sessions = Object.keys(sessionMap)
      .map(function (sid) {
        return Object.assign({ session_id: sid.slice(0, 8) }, sessionMap[sid]);
      })
      .sort(function (a, b) {
        return new Date(b.lastAt) - new Date(a.lastAt);
      })
      .slice(0, 40);

    return res.status(200).json({
      since: since,
      sites: siteList,
      funnels: funnelsOut,
      clicks: clicks,
      sources: sources,
      sessions: sessions
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'erro ao calcular métricas', detail: err.message });
  }
};
