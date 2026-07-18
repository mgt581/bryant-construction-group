const ALLOWED_ORIGINS = new Set([
  "https://bryantconstructiongroup.co.uk",
  "https://www.bryantconstructiongroup.co.uk",
  "https://bryantconstruct.com",
  "https://www.bryantconstruct.com"
]);

const MAX_LENGTHS = {
  name: 100,
  phone: 40,
  email: 254,
  service: 100,
  message: 5000
};

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Cache-Control": "no-store",
    Vary: "Origin"
  };

  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin)
    }
  });
}

function clean(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function validEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (url.pathname !== "/api/send-lead") {
      return json({ ok: false, message: "Not found" }, 404, origin);
    }

    if (request.method === "OPTIONS") {
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        return json({ ok: false, message: "Origin not allowed" }, 403, origin);
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== "POST") {
      return json({ ok: false, message: "Method not allowed" }, 405, origin);
    }

    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, message: "Origin not allowed" }, 403, origin);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ ok: false, message: "Invalid request" }, 400, origin);
    }

    const lead = {
      name: clean(input.name, MAX_LENGTHS.name),
      phone: clean(input.phone, MAX_LENGTHS.phone),
      email: clean(input.email, MAX_LENGTHS.email),
      service: clean(input.service, MAX_LENGTHS.service),
      message: clean(input.message, MAX_LENGTHS.message)
    };

    if (!lead.name || !lead.phone || !lead.service || !lead.message || !validEmail(lead.email)) {
      return json({ ok: false, message: "Please check the form fields" }, 400, origin);
    }

    const subject = `Bryant Construction Group quote request: ${lead.service}`;
    const text = [
      `Name: ${lead.name}`,
      `Phone: ${lead.phone}`,
      `Email: ${lead.email || "Not provided"}`,
      `Service: ${lead.service}`,
      "",
      "Message:",
      lead.message,
      "",
      "---",
      "Sent from bryantconstructiongroup.co.uk"
    ].join("\n");

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: "Bryant Construction Group <info@bryantconstruct.com>",
          to: [env.LEAD_EMAIL || "ajbryantsleads@gmail.com"],
          reply_to: lead.email || "info@bryantconstruct.com",
          subject,
          text
        })
      });
    } catch (err) {
      console.error("Resend fetch error:", err);
      return json({ ok: false, message: "Failed to reach email provider" }, 502, origin);
    }

    if (!resendResponse.ok) {
      return json({ ok: false, message: "Email provider rejected the request" }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  }
};
