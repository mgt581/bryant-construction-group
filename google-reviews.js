/* Live Google reviews: fetched from /api/google-reviews (Cloudflare Worker, cached 12h).
   If the request fails, the page keeps whatever static content it already has. */
(function () {
  const homeGrid = document.querySelector("[data-google-reviews='home']");
  const pageGrid = document.querySelector("[data-google-reviews='page']");
  const summaries = document.querySelectorAll("[data-google-rating]");
  if (!homeGrid && !pageGrid && !summaries.length) return;

  const stars = (n) => "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n));

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function reviewCard(review, cardClass) {
    const card = el("article", cardClass + " google-review");
    const top = el("div", "google-review-top");
    top.appendChild(el("div", "home-stars", stars(review.rating))).setAttribute("aria-label", `${review.rating} out of 5 stars`);
    top.appendChild(el("span", "google-review-badge", "Google"));
    card.appendChild(top);

    let text = review.text || "Left a " + review.rating + "-star rating.";
    if (text.length > 420) text = text.slice(0, 400).replace(/\s+\S*$/, "") + "…";
    card.appendChild(el("blockquote", "", "“" + text + "”"));

    const footer = el("footer");
    const name = el(review.authorUrl ? "a" : "strong", "", review.author);
    if (review.authorUrl) {
      name.href = review.authorUrl;
      name.target = "_blank";
      name.rel = "noopener noreferrer";
      name.className = "google-review-author";
    }
    footer.appendChild(name);
    if (review.when) footer.appendChild(el("span", "", review.when));
    card.appendChild(footer);
    return card;
  }

  function render(data) {
    const reviews = (data.reviews || [])
      .filter((r) => r.rating >= 1)
      .sort((a, b) => String(b.published).localeCompare(String(a.published)));

    summaries.forEach((node) => {
      if (!data.rating || !data.total) return;
      node.textContent = "";
      const link = el("a", "google-rating-link");
      link.href = data.url || "https://g.page/r/Cdi-9ItPpl1QEBM";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.appendChild(el("strong", "", data.rating.toFixed(1)));
      link.appendChild(el("span", "google-rating-stars", stars(data.rating)));
      link.appendChild(el("span", "", `from ${data.total} Google review${data.total === 1 ? "" : "s"}`));
      node.appendChild(link);
      node.hidden = false;
    });

    if (!reviews.length) return;

    if (homeGrid) {
      homeGrid.textContent = "";
      reviews.slice(0, 3).forEach((r) => homeGrid.appendChild(reviewCard(r, "home-review")));
    }
    if (pageGrid) {
      pageGrid.textContent = "";
      reviews.forEach((r) => pageGrid.appendChild(reviewCard(r, "home-review")));
      pageGrid.hidden = false;
      const note = document.querySelector("[data-google-reviews-note]");
      if (note) note.hidden = false;
    }
  }

  fetch("/api/google-reviews", { headers: { Accept: "application/json" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => { if (data && data.ok) render(data); })
    .catch(() => {});
})();
