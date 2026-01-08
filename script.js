// Set year in footer
document.getElementById("year").textContent = new Date().getFullYear();

// Simple form handler (free static site)
// Uses a mailto fallback so you can launch today with zero spend.
// Later we can swap this for Formspree / Netlify Forms / Firebase, etc.
const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");

// TODO: change this to your preferred inbox
const TO_EMAIL = "alex@bryantgroupholdings.co.uk";

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const data = new FormData(form);
  const name = (data.get("name") || "").toString().trim();
  const phone = (data.get("phone") || "").toString().trim();
  const service = (data.get("service") || "").toString().trim();
  const message = (data.get("message") || "").toString().trim();

  if (!name || !phone || !service || !message) {
    statusEl.textContent = "Please fill in all fields.";
    return;
  }

  const subject = encodeURIComponent(`Quote request: ${service}`);
  const body = encodeURIComponent(
`Name: ${name}
Phone: ${phone}
Service: ${service}

Message:
${message}

---
Sent from bryantconstructiongroup website`
  );

  // Opens the user's email app; works fine for a free launch
  window.location.href = `mailto:${TO_EMAIL}?subject=${subject}&body=${body}`;
  statusEl.textContent = "Opening your email app…";
});
