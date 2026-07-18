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

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function attachmentUrl(requestUrl, key) {
  const url = new URL(requestUrl);
  url.pathname = `/api/contact-upload/${key.split("/").map(encodeURIComponent).join("/")}`;
  url.search = "";
  return url.toString();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "GET" && url.pathname.startsWith("/api/contact-upload/")) {
      if (!env.CONTACT_UPLOADS) {
        return json({ ok: false, message: "Upload storage is not configured" }, 503, origin);
      }

      const encodedKey = url.pathname.slice("/api/contact-upload/".length);
      let key;
      try {
        key = encodedKey.split("/").map(decodeURIComponent).join("/");
      } catch {
        return json({ ok: false, message: "Invalid attachment link" }, 400, origin);
      }

      const object = await env.CONTACT_UPLOADS.get(key);
      if (!object) {
        return json({ ok: false, message: "Attachment not found" }, 404, origin);
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("Content-Disposition", `inline; filename="${cleanFileName(object.customMetadata?.filename)}"`);
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      return new Response(object.body, { headers });
    }

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
    const storedAttachments = [];

    if (attachments.length > 0 && !env.CONTACT_UPLOADS) {
      return json({ ok: false, message: "File uploads are temporarily unavailable" }, 503, origin);
    }

    try {
      for (const attachment of attachments) {
        const key = `${crypto.randomUUID()}/${attachment.filename}`;
        await env.CONTACT_UPLOADS.put(key, decodeBase64(attachment.content), {
          httpMetadata: { contentType: attachment.content_type },
          customMetadata: { filename: attachment.filename }
        });
        storedAttachments.push({
          key,
          filename: attachment.filename,
          url: attachmentUrl(request.url, key)
        });
      }
    } catch {
      await Promise.all(storedAttachments.map((attachment) => env.CONTACT_UPLOADS.delete(attachment.key)));
      return json({ ok: false, message: "We could not store the attached files" }, 502, origin);
    }

    const attachmentSummary = storedAttachments.length > 0
      ? storedAttachments.map((attachment) => `${attachment.filename}: ${attachment.url}`).join("\n")
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

    const sendEmail = (payload) => fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resendResponse = await sendEmail(emailPayload);

    if (!resendResponse.ok) {
      await Promise.all(storedAttachments.map((attachment) => env.CONTACT_UPLOADS.delete(attachment.key)));
      return json({ ok: false, message: "Email provider rejected the request" }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  }
};
