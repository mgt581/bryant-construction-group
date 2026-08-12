export const STATUSES = ["TEST", "NEW", "GENUINE", "SPAM", "CONTACTED", "QUOTED", "WON", "LOST"];

export const ALLOWED_EVENTS = [
  "page_view",
  "quote_cta_click",
  "phone_click",
  "whatsapp_click",
  "email_click",
  "lead_form_submit_attempt",
  "lead_form_error",
  "generate_lead",
  "lead_delivery_failed"
];

export function cleanTrackingValue(value, limit = 1000) {
  return String(value ?? "").trim().slice(0, limit);
}

export async function ensureLeadSchema(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, submitted_at TEXT NOT NULL, name TEXT NOT NULL,
    phone TEXT, email TEXT, postcode TEXT, service TEXT, timeframe TEXT, message TEXT,
    page TEXT, source TEXT, landing_page TEXT, referrer TEXT, utm_source TEXT, utm_medium TEXT,
    utm_campaign TEXT, utm_term TEXT, utm_content TEXT, gclid TEXT, fbclid TEXT, msclkid TEXT,
    session_id TEXT, client_id TEXT, form_name TEXT, marketing_consent INTEGER NOT NULL DEFAULT 0,
    delivery_status TEXT NOT NULL DEFAULT 'pending', delivery_errors TEXT,
    lead_status TEXT NOT NULL DEFAULT 'NEW', quote_value_pence INTEGER NOT NULL DEFAULT 0,
    won_revenue_pence INTEGER NOT NULL DEFAULT 0, status_updated_at TEXT, user_agent TEXT, ip_hash TEXT
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS lead_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, event_name TEXT NOT NULL,
    page TEXT, landing_page TEXT, referrer TEXT, source TEXT, medium TEXT, campaign TEXT,
    term TEXT, content TEXT, gclid TEXT, fbclid TEXT, msclkid TEXT, service TEXT,
    link_url TEXT, link_text TEXT, phone_number TEXT, whatsapp_number TEXT, email_address TEXT,
    session_id TEXT, client_id TEXT, user_agent TEXT, ip_hash TEXT
  )`).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_leads_submitted_at ON leads (submitted_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_leads_source ON leads (source)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (lead_status)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON lead_events (occurred_at DESC)").run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_events_name ON lead_events (event_name)").run();
}

async function hashIp(ip) {
  if (!ip) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function truthy(value) {
  return ["1", "true", "yes", "on"].includes(cleanTrackingValue(value).toLowerCase());
}

export function normalizeTrackedLead(input) {
  return {
    submitted_at: new Date().toISOString(),
    name: cleanTrackingValue(input.name, 240),
    phone: cleanTrackingValue(input.phone, 80),
    email: cleanTrackingValue(input.email, 240),
    postcode: cleanTrackingValue(input.postcode, 80),
    service: cleanTrackingValue(input.service || "Website enquiry", 160),
    timeframe: cleanTrackingValue(input.timeframe || input.preferred_date, 240),
    message: cleanTrackingValue(input.message, 4000),
    page: cleanTrackingValue(input.page || input.page_url, 1000),
    source: cleanTrackingValue(input.source || input.utm_source || "website", 160),
    landing_page: cleanTrackingValue(input.landing_page || input.page || input.page_url, 1000),
    referrer: cleanTrackingValue(input.referrer, 1000),
    utm_source: cleanTrackingValue(input.utm_source, 240),
    utm_medium: cleanTrackingValue(input.utm_medium, 240),
    utm_campaign: cleanTrackingValue(input.utm_campaign, 240),
    utm_term: cleanTrackingValue(input.utm_term, 240),
    utm_content: cleanTrackingValue(input.utm_content, 240),
    gclid: cleanTrackingValue(input.gclid, 300),
    fbclid: cleanTrackingValue(input.fbclid, 300),
    msclkid: cleanTrackingValue(input.msclkid, 300),
    session_id: cleanTrackingValue(input.session_id, 120),
    client_id: cleanTrackingValue(input.client_id, 120),
    form_name: cleanTrackingValue(input.form_name || "Website quote form", 200),
    marketing_consent: truthy(input.marketing_consent || input.consent) ? 1 : 0
  };
}

export async function insertTrackedLead(db, request, lead) {
  await ensureLeadSchema(db);
  const ipHash = await hashIp(request.headers.get("cf-connecting-ip") || "");
  const result = await db.prepare(`INSERT INTO leads (
    submitted_at,name,phone,email,postcode,service,timeframe,message,page,source,landing_page,
    referrer,utm_source,utm_medium,utm_campaign,utm_term,utm_content,gclid,fbclid,msclkid,
    session_id,client_id,form_name,marketing_consent,delivery_status,user_agent,ip_hash
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    lead.submitted_at, lead.name, lead.phone, lead.email, lead.postcode, lead.service, lead.timeframe,
    lead.message, lead.page, lead.source, lead.landing_page, lead.referrer, lead.utm_source,
    lead.utm_medium, lead.utm_campaign, lead.utm_term, lead.utm_content, lead.gclid, lead.fbclid,
    lead.msclkid, lead.session_id, lead.client_id, lead.form_name, lead.marketing_consent, "pending",
    cleanTrackingValue(request.headers.get("user-agent")), ipHash
  ).run();
  return Number(result?.meta?.last_row_id || 0);
}

export async function setLeadDelivery(db, leadId, delivered, error = "") {
  await db.prepare("UPDATE leads SET delivery_status=?, delivery_errors=? WHERE id=?")
    .bind(delivered ? "delivered" : "failed", cleanTrackingValue(error, 2000), leadId).run();
}

export async function insertTrackedEvent(db, request, event) {
  await ensureLeadSchema(db);
  const ipHash = await hashIp(request.headers.get("cf-connecting-ip") || "");
  await db.prepare(`INSERT INTO lead_events (
    occurred_at,event_name,page,landing_page,referrer,source,medium,campaign,term,content,
    gclid,fbclid,msclkid,service,link_url,link_text,phone_number,whatsapp_number,email_address,
    session_id,client_id,user_agent,ip_hash
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    new Date().toISOString(), cleanTrackingValue(event.event_name, 80), cleanTrackingValue(event.page),
    cleanTrackingValue(event.landing_page), cleanTrackingValue(event.referrer),
    cleanTrackingValue(event.source, 160), cleanTrackingValue(event.medium || event.utm_medium, 160),
    cleanTrackingValue(event.campaign || event.utm_campaign, 240),
    cleanTrackingValue(event.term || event.utm_term, 240), cleanTrackingValue(event.content || event.utm_content, 240),
    cleanTrackingValue(event.gclid, 300), cleanTrackingValue(event.fbclid, 300),
    cleanTrackingValue(event.msclkid, 300), cleanTrackingValue(event.service, 160),
    cleanTrackingValue(event.link_url), cleanTrackingValue(event.link_text, 500),
    cleanTrackingValue(event.phone_number, 100), cleanTrackingValue(event.whatsapp_number, 100),
    cleanTrackingValue(event.email_address, 240), cleanTrackingValue(event.session_id, 120),
    cleanTrackingValue(event.client_id, 120), cleanTrackingValue(request.headers.get("user-agent")), ipHash
  ).run();
}

async function sameSecret(provided, configured) {
  if (!provided || !configured) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(configured))
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

function decodeJwtPart(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes;
}

async function verifyAccessJwt(token, env) {
  const teamDomain = cleanTrackingValue(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN).replace(/\/$/, "");
  const policyAuds = cleanTrackingValue(env.CLOUDFLARE_ACCESS_AUDS || env.CLOUDFLARE_ACCESS_AUD)
    .split(",").map((value) => value.trim()).filter(Boolean);
  if (!token || !teamDomain || !policyAuds.length || !teamDomain.startsWith("https://")) return false;

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decodeJwtPart(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decodeJwtPart(parts[1])));
    if (header.alg !== "RS256" || !header.kid) return false;

    const now = Math.floor(Date.now() / 1000);
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (payload.iss !== teamDomain || !policyAuds.some((audience) => audiences.includes(audience))) return false;
    if (!Number.isFinite(payload.exp) || payload.exp < now - 60) return false;
    if (Number.isFinite(payload.nbf) && payload.nbf > now + 60) return false;

    const response = await fetch(teamDomain + "/cdn-cgi/access/certs", {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return false;
    const jwks = await response.json();
    const jwk = Array.isArray(jwks.keys) ? jwks.keys.find((key) => key.kid === header.kid) : null;
    if (!jwk) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      decodeJwtPart(parts[2]),
      new TextEncoder().encode(parts[0] + "." + parts[1])
    );
  } catch {
    return false;
  }
}

export async function adminAllowed(request, env) {
  const accessEnabled = cleanTrackingValue(env.CLOUDFLARE_ACCESS_ENABLED).toLowerCase() === "true";
  if (accessEnabled && await verifyAccessJwt(request.headers.get("cf-access-jwt-assertion") || "", env)) {
    return true;
  }

  const authorization = cleanTrackingValue(request.headers.get("authorization"));
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return sameSecret(bearer, cleanTrackingValue(env.LEADS_EXPORT_TOKEN));
}

async function all(db, sql) {
  const result = await db.prepare(sql).all();
  return result.results || [];
}

const originSql = `CASE
  WHEN COALESCE(NULLIF(utm_source,''),'') <> '' THEN LOWER(utm_source)
  WHEN LOWER(COALESCE(referrer,'')) LIKE '%google.%' THEN 'google'
  WHEN LOWER(COALESCE(referrer,'')) LIKE '%facebook.com%' THEN 'facebook'
  WHEN LOWER(COALESCE(referrer,'')) LIKE '%instagram.com%' THEN 'instagram'
  WHEN LOWER(COALESCE(referrer,'')) LIKE '%bing.com%' THEN 'bing'
  WHEN COALESCE(NULLIF(referrer,''),'') <> '' THEN referrer
  ELSE 'direct / unknown' END`;

export async function getDashboardData(db) {
  await ensureLeadSchema(db);
  const totals = await all(db, `SELECT COUNT(*) leads,
    SUM(CASE WHEN delivery_status='delivered' THEN 1 ELSE 0 END) delivered_leads,
    SUM(CASE WHEN delivery_status='failed' THEN 1 ELSE 0 END) failed_leads,
    SUM(CASE WHEN lead_status='WON' THEN 1 ELSE 0 END) won_leads,
    SUM(quote_value_pence) quoted_value_pence,SUM(won_revenue_pence) won_revenue_pence FROM leads`);
  const events = await all(db, "SELECT event_name,COUNT(*) count FROM lead_events GROUP BY event_name ORDER BY count DESC");
  return {
    ok: true,
    generated_at: new Date().toISOString(),
    totals: totals[0] || {},
    event_totals: Object.fromEntries(events.map((row) => [row.event_name, Number(row.count || 0)])),
    pipeline_summary: await all(db, "SELECT lead_status status,COUNT(*) count FROM leads GROUP BY lead_status ORDER BY count DESC"),
    origin_summary: await all(db, `SELECT ${originSql} origin,COUNT(*) count FROM leads GROUP BY ${originSql} ORDER BY count DESC LIMIT 20`),
    revenue_origin_summary: await all(db, `SELECT ${originSql} origin,COUNT(*) leads,
      SUM(CASE WHEN lead_status='WON' THEN 1 ELSE 0 END) won_leads,SUM(quote_value_pence) quote_value_pence,
      SUM(won_revenue_pence) won_revenue_pence FROM leads GROUP BY ${originSql} ORDER BY won_revenue_pence DESC,leads DESC LIMIT 20`),
    service_summary: await all(db, `SELECT COALESCE(NULLIF(service,''),'Website enquiry') service,
      COUNT(*) count FROM leads GROUP BY COALESCE(NULLIF(service,''),'Website enquiry') ORDER BY count DESC LIMIT 20`),
    landing_page_summary: await all(db, `SELECT COALESCE(NULLIF(landing_page,''),'Unknown') landing_page,
      COUNT(*) count FROM lead_events GROUP BY COALESCE(NULLIF(landing_page,''),'Unknown') ORDER BY count DESC LIMIT 20`),
    recent_leads: await all(db, `SELECT id,submitted_at,name,phone,email,service,page,source,landing_page,
      referrer,utm_source,utm_medium,utm_campaign,delivery_status,delivery_errors,lead_status,quote_value_pence,
      won_revenue_pence,status_updated_at FROM leads ORDER BY submitted_at DESC LIMIT 25`),
    recent_events: await all(db, `SELECT occurred_at,event_name,page,landing_page,link_text,link_url,
      source,medium,campaign,service FROM lead_events ORDER BY occurred_at DESC LIMIT 50`)
  };
}

export async function updateLead(db, id, input) {
  const status = cleanTrackingValue(input.lead_status).toUpperCase();
  const quote = Number(input.quote_value_pence);
  const revenue = Number(input.won_revenue_pence);
  if (!STATUSES.includes(status)) return { error: "Unsupported lead status.", status: 400 };
  if (![quote, revenue].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    return { error: "Money values must be non-negative whole pence/cents.", status: 400 };
  }
  await ensureLeadSchema(db);
  const statusUpdatedAt = new Date().toISOString();
  const result = await db.prepare(`UPDATE leads SET lead_status=?,quote_value_pence=?,
    won_revenue_pence=?,status_updated_at=? WHERE id=?`).bind(status, quote, revenue, statusUpdatedAt, id).run();
  if (!Number(result?.meta?.changes || 0)) return { error: "Lead not found.", status: 404 };
  return { ok: true, lead: { id, lead_status: status, quote_value_pence: quote, won_revenue_pence: revenue, status_updated_at: statusUpdatedAt } };
}

export async function exportCsv(db, table) {
  const leadHeaders = ["submitted_at","name","phone","email","postcode","service","timeframe","message","page","source",
    "landing_page","referrer","utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid",
    "msclkid","session_id","client_id","form_name","marketing_consent","delivery_status","delivery_errors",
    "lead_status","quote_value_pence","won_revenue_pence","status_updated_at"];
  const eventHeaders = ["occurred_at","event_name","page","landing_page","referrer","source","medium","campaign","term",
    "content","gclid","fbclid","msclkid","service","link_url","link_text","phone_number","whatsapp_number",
    "email_address","session_id","client_id"];
  const headers = table === "leads" ? leadHeaders : eventHeaders;
  await ensureLeadSchema(db);
  const result = await db.prepare(`SELECT ${headers.join(",")} FROM ${table} ORDER BY ${table === "leads" ? "submitted_at" : "occurred_at"} DESC LIMIT 5000`).all();
  const escape = (value) => {
    const string = String(value ?? "");
    return /[",\n\r]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
  };
  const body = [headers.join(","), ...(result.results || []).map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n") + "\n";
  return { body, filename: table === "leads" ? "leads.csv" : "lead-events.csv" };
}
