(() => {
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
  // Quote form handler
  // ===============================
  const form = document.getElementById("quoteForm");
  const statusEl = document.getElementById("formStatus");
  const leadEmail = "allleadshere@yahoo.com";
  const formEndpoint = `https://formsubmit.co/ajax/${leadEmail}`;

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = new FormData(form);
      const name = (data.get("name") || "").toString().trim();
      const phone = (data.get("phone") || "").toString().trim();
      const email = (data.get("email") || "").toString().trim();
      const service = (data.get("service") || "").toString().trim();
      const message = (data.get("message") || "").toString().trim();

      if (!name || !phone || !service || !message) {
        if (statusEl) {
          statusEl.textContent = "Please fill in all fields.";
        }
        return;
      }

      const subjectText = `Bryant Construction Group quote request: ${service}`;
      const emailBody =
`Name: ${name}
Phone: ${phone}
Email: ${email || "Not provided"}
Service: ${service}

Message:
${message}

---
Sent from bryantconstructiongroup.co.uk`;

      if (statusEl) {
        statusEl.textContent = "Sending your quote request...";
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
      }

      const payload = new FormData();
      payload.append("name", name);
      payload.append("phone", phone);
      payload.append("email", email);
      payload.append("service", service);
      payload.append("message", message);
      payload.append("_subject", subjectText);
      payload.append("_template", "table");
      payload.append("_captcha", "false");

      try {
        const response = await fetch(formEndpoint, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: payload
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result || result.success === false || result.success === "false") {
          throw new Error(result?.message || "quote-submit-failed");
        }

        form.reset();
        if (statusEl) {
          statusEl.textContent = "Thanks. Your quote request has been sent.";
        }
      } catch (error) {
        const recipients = leadEmail;
        const subject = encodeURIComponent(subjectText);
        const body = encodeURIComponent(emailBody);

        if (statusEl) {
          statusEl.textContent = "We could not send it automatically. Opening a backup email instead.";
        }

        window.location.href = `mailto:${recipients}?subject=${subject}&body=${body}`;
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
        }
      }
    });
  }

  // ===============================
  // Lead chat assistant
  // ===============================
  const phoneDisplay = "07843 969254";
  const phoneHref = "tel:+447843969254";
  const whatsappHref = "https://wa.me/447843969254";
  const quoteHref = "contact.html";

  const chatResponses = [
    {
      match: ["quote", "price", "cost", "estimate", "how much"],
      text: "For a clear quote, send a few details about the job, where you are based, and any photos if you have them. The fastest route is WhatsApp or the quote form.",
      actions: [
        { label: "Request a quote", href: quoteHref },
        { label: "WhatsApp", href: whatsappHref }
      ]
    },
    {
      match: ["repair", "maintenance", "fix", "snag", "door", "lock", "hinge"],
      text: "Yes, repairs and maintenance are covered. This includes doors, hinges, trim, patch repairs, snagging lists and general property upkeep.",
      actions: [
        { label: "Repairs page", href: "repairs-maintenance.html" },
        { label: "Call now", href: phoneHref }
      ]
    },
    {
      match: ["carpentry", "joinery", "wood", "skirting", "shelving", "storage"],
      text: "Carpentry and joinery work includes doors, frames, skirting, architraves, stud walls, fitted storage, shelving and second fix carpentry.",
      actions: [
        { label: "Carpentry page", href: "carpentry-joinery.html" },
        { label: "Get a quote", href: quoteHref }
      ]
    },
    {
      match: ["decorate", "decorating", "painting", "paint", "painter"],
      text: "Decorating services include interior and exterior painting, surface preparation, woodwork, doors, skirting and clean finishing.",
      actions: [
        { label: "Decorating page", href: "decorating.html" },
        { label: "Get a quote", href: quoteHref }
      ]
    },
    {
      match: ["plaster", "plastering", "skim", "ceiling", "wall"],
      text: "Plastering and finishing work includes skimming, wall and ceiling repairs, crack repairs and smooth paint-ready finishes.",
      actions: [
        { label: "Plastering page", href: "plastering-finishing.html" },
        { label: "Get a quote", href: quoteHref }
      ]
    },
    {
      match: ["phone", "call", "number", "contact", "speak"],
      text: `You can call Bryant Construction Group on ${phoneDisplay}, message on WhatsApp, or send a quote request through the contact page.`,
      actions: [
        { label: "Call now", href: phoneHref },
        { label: "WhatsApp", href: whatsappHref }
      ]
    },
    {
      match: ["area", "where", "bournemouth", "poole", "christchurch", "cover"],
      text: "Bryant Construction Group covers Bournemouth, Poole, Christchurch and nearby areas for building work, repairs, maintenance, carpentry, decorating and plastering."
    }
  ];

  const defaultResponse = {
    text: "I can help with quotes, service areas, repairs, carpentry, decorating, plastering and the best way to contact Bryant Construction Group. For anything specific, send a quick quote request.",
    actions: [
      { label: "Request a quote", href: quoteHref },
      { label: "Call now", href: phoneHref }
    ]
  };

  const createChatAction = (action) => {
    const link = document.createElement("a");
    link.className = "chat-action";
    link.href = action.href;
    link.textContent = action.label;

    if (action.href.startsWith("http")) {
      link.target = "_blank";
      link.rel = "noopener";
    }

    return link;
  };

  const addChatMessage = (messages, text, type, actions = []) => {
    const message = document.createElement("div");
    message.className = `chat-message chat-message-${type}`;
    message.textContent = text;
    messages.appendChild(message);

    if (actions.length) {
      const actionRow = document.createElement("div");
      actionRow.className = "chat-actions";
      actions.forEach((action) => actionRow.appendChild(createChatAction(action)));
      messages.appendChild(actionRow);
    }

    messages.scrollTop = messages.scrollHeight;
  };

  const getChatResponse = (input) => {
    const normalised = input.toLowerCase();
    return chatResponses.find((response) =>
      response.match.some((keyword) => normalised.includes(keyword))
    ) || defaultResponse;
  };

  const initLeadChat = () => {
    if (document.getElementById("leadChat")) {
      return;
    }

    const widget = document.createElement("section");
    widget.id = "leadChat";
    widget.className = "lead-chat";
    widget.setAttribute("aria-label", "Bryant Construction Group chat assistant");

    widget.innerHTML = `
      <button class="chat-launcher" type="button" aria-expanded="false" aria-controls="chatPanel">
        <span class="chat-launcher-icon" aria-hidden="true">AI</span>
        <span>Ask us</span>
      </button>

      <div class="chat-panel" id="chatPanel" hidden>
        <div class="chat-header">
          <div>
            <strong>Bryant Assistant</strong>
            <span>Fast help with quotes and services</span>
          </div>
          <button class="chat-close" type="button" aria-label="Close chat">x</button>
        </div>

        <div class="chat-messages" aria-live="polite"></div>

        <div class="chat-prompts" aria-label="Quick questions">
          <button type="button" data-chat-prompt="Can I get a quote?">Quote</button>
          <button type="button" data-chat-prompt="What areas do you cover?">Areas</button>
          <button type="button" data-chat-prompt="Do you do repairs and maintenance?">Repairs</button>
        </div>

        <form class="chat-form">
          <label class="sr-only" for="chatInput">Ask a question</label>
          <input id="chatInput" type="text" autocomplete="off" placeholder="Ask about a job..." />
          <button type="submit">Send</button>
        </form>
      </div>
    `;

    document.body.appendChild(widget);

    const launcher = widget.querySelector(".chat-launcher");
    const panel = widget.querySelector(".chat-panel");
    const close = widget.querySelector(".chat-close");
    const messages = widget.querySelector(".chat-messages");
    const chatForm = widget.querySelector(".chat-form");
    const chatInput = widget.querySelector("#chatInput");
    const promptButtons = widget.querySelectorAll("[data-chat-prompt]");

    const openChat = () => {
      panel.hidden = false;
      launcher.setAttribute("aria-expanded", "true");
      chatInput.focus();
    };

    const closeChat = () => {
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      launcher.focus();
    };

    const submitChat = (value) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return;
      }

      addChatMessage(messages, trimmed, "user");
      const response = getChatResponse(trimmed);
      addChatMessage(messages, response.text, "bot", response.actions);
      chatInput.value = "";
      openChat();
    };

    launcher.addEventListener("click", () => {
      if (panel.hidden) {
        openChat();
      } else {
        closeChat();
      }
    });

    close.addEventListener("click", closeChat);

    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitChat(chatInput.value);
    });

    promptButtons.forEach((button) => {
      button.addEventListener("click", () => {
        submitChat(button.dataset.chatPrompt || "");
      });
    });

    addChatMessage(
      messages,
      "Hi, I can help with quotes, service areas and the best way to contact Bryant Construction Group.",
      "bot",
      [
        { label: "Request a quote", href: quoteHref },
        { label: "WhatsApp", href: whatsappHref }
      ]
    );
  };

  initLeadChat();
})();
