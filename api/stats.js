const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  // proteção simples por senha (a mesma que você define no dashboard)
  var pass = req.headers['x-hub-password'];
  if (!pass || pass !== process.env.HUB_PASSWORD) {
    return res.status(401).json({ error: 'senha inválida' });
  }

  try {
    var days = parseInt(req.query.days || '30', 10);
    var since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('events')
      .select('funnel_id, variant, event_type, step, session_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // agrupa por funil > variante > (event_type + step), contando sessões únicas
    var funnels = {};
    data.forEach(function (row) {
      var f = (funnels[row.funnel_id] = funnels[row.funnel_id] || {});
      var v = (f[row.variant] = f[row.variant] || {});
      var key = row.event_type + (row.step ? ':' + row.step : '');
      var bucket = (v[key] = v[key] || { count: 0, sessions: new Set() });
      bucket.count += 1;
      bucket.sessions.add(row.session_id);
    });

    // converte pra JSON simples (Set não serializa)
    var result = {};
    Object.keys(funnels).forEach(function (funnelId) {
      result[funnelId] = {};
      Object.keys(funnels[funnelId]).forEach(function (variant) {
        result[funnelId][variant] = {};
        Object.keys(funnels[funnelId][variant]).forEach(function (key) {
          result[funnelId][variant][key] = {
            events: funnels[funnelId][variant][key].count,
            unique_sessions: funnels[funnelId][variant][key].sessions.size
          };
        });
      });
    });

    return res.status(200).json({ since: since, funnels: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'erro ao calcular métricas' });
  }
};
