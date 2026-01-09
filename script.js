// ===============================
// Footer year
// ===============================
const yearEl = document.getElementById("year");
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// ===============================
// Mobile nav toggle
// ===============================
const toggle = document.querySelector(".nav-toggle");
const nav = document.getElementById("mobileNav");

if (toggle && nav) {
  toggle.addEventListener("click", () => {
    nav.classList.toggle("open");
  });
}

// ===============================
// Quote form handler (only runs if form exists)
// ===============================
const form = document.getElementById("quoteForm");
const statusEl = document.getElementById("formStatus");

// Change inbox here if needed
const TO_EMAIL = "alex@bryantgroupholdings.co.uk";

if (form) {
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const name = (data.get("name") || "").toString().trim();
    const phone = (data.get("phone") || "").toString().trim();
    const service = (data.get("service") || "").toString().trim();
    const message = (data.get("message") || "").toString().trim();

    if (!name || !phone || !service || !message) {
      if (statusEl) {
        statusEl.textContent = "Please fill in all fields.";
      }
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

    window.location.href = `mailto:${TO_EMAIL}?subject=${subject}&body=${body}`;

    if (statusEl) {
      statusEl.textContent = "Opening your email app…";
    }
  });
}
