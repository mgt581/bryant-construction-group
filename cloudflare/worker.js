const ALLOWED_ORIGINS = new Set([
  "https://bryantconstructiongroup.co.uk",
  "https://www.bryantconstructiongroup.co.uk",
  "https://bryantconstruct.co.uk",
  "https://www.bryantconstruct.co.uk",
  "https://bryantconstruct.com",
  "https://www.bryantconstruct.com"
]);

const FROM_EMAIL = "info@bryantconstructiongroup.co.uk";
const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
const MAX_ATTACHMENT_MB = 4;

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

function cleanFileName(value) {
  return clean(value, 120).replace(/[\\/\0\r\n]/g, "").trim() || "attachment";
}

function base64ByteLength(value) {
  const content = String(value ?? "").replace(/\s/g, "");
  if (!content || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) {
    return null;
  }

  const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
  return Math.floor((content.length * 3) / 4) - padding;
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  if (value.length > MAX_ATTACHMENTS) {
    throw new Error("too-many-attachments");
  }

  return value.map((attachment) => {
    const content = String(attachment?.content ?? "").replace(/\s/g, "");
    const byteLength = base64ByteLength(content);

    if (!byteLength || byteLength > MAX_ATTACHMENT_BYTES) {
      throw new Error("invalid-attachment");
    }

    return {
      filename: cleanFileName(attachment?.filename),
      content,
      content_type: clean(attachment?.content_type || "application/octet-stream", 100)
    };
  });
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

    let attachments;
    try {
      attachments = normalizeAttachments(input.attachments);
    } catch {
      return json({ ok: false, message: `Please attach up to 3 files, ${MAX_ATTACHMENT_MB} MB each` }, 400, origin);
    }

    if (!lead.name || !lead.phone || !lead.service || !lead.message || !validEmail(lead.email)) {
      return json({ ok: false, message: "Please check the form fields" }, 400, origin);
    }

    const subject = `Bryant Construction Group quote request: ${lead.service}`;
    const attachmentSummary = attachments.length > 0
      ? attachments.map((attachment) => attachment.filename).join(", ")
      : "None";

    const text = [
      `Name: ${lead.name}`,
      `Phone: ${lead.phone}`,
      `Email: ${lead.email || "Not provided"}`,
      `Service: ${lead.service}`,
      `Attachments: ${attachmentSummary}`,
      "",
      "Message:",
      lead.message,
      "",
      "---",
      "Sent from bryantconstructiongroup.co.uk"
    ].join("\n");

    const emailPayload = {
      from: `Bryant Construction Group <${FROM_EMAIL}>`,
      to: [env.LEAD_EMAIL || "ajbryantsleads@gmail.com"],
      reply_to: lead.email || FROM_EMAIL,
      subject,
      text
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const sendEmail = (payload) => fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    let resendResponse = await sendEmail(emailPayload);

    if (!resendResponse.ok && attachments.length > 0) {
      const fallbackPayload = {
        ...emailPayload,
        subject: `${subject} (attachments not delivered)`,
        text: [
          text,
          "",
          "Attachment delivery note:",
          "The customer uploaded files, but the email provider rejected the attachment email. Please reply to the customer and ask them to send the files directly."
        ].join("\n")
      };
      delete fallbackPayload.attachments;
      resendResponse = await sendEmail(fallbackPayload);
    }

    if (!resendResponse.ok) {
      return json({ ok: false, message: "Email provider rejected the request" }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  }
};
