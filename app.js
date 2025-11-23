const trialFilterEl = document.getElementById("trialFilter");
const modelFilterEl = document.getElementById("modelFilter");
const trialGrid = document.getElementById("trialGrid");
const lightboxEl = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImage");
const lightboxCloseBtn = document.querySelector(".lightbox-close");
const lightboxModelEl = document.getElementById("lightboxModel");
const lightboxPromptEl = document.getElementById("lightboxPrompt");
const lightboxPrevBtn = document.getElementById("lightboxPrev");
const lightboxNextBtn = document.getElementById("lightboxNext");
const lightboxScoresEl = document.getElementById("lightboxScores");
const lightboxCommentEl = document.getElementById("lightboxComment");
const summaryTable = document.getElementById("summaryTable");

const setText = (node, value) => {
  if (!node) return;
  node.textContent = value;
};

let galleryEntries = [];
let currentEntryIndex = -1;
const galleryIndexByKey = new Map();
const makeGalleryKey = (trialId, modelName) => `${trialId}__${modelName}`;

const filterTrials = () => {
  const selectedTrial = trialFilterEl?.value ?? "all";
  const selectedModel = modelFilterEl?.value ?? "all";
  const trialCards = Array.from(document.querySelectorAll(".trial-card"));
  let visibleTrialCount = 0;

  trialCards.forEach((card) => {
    const trialId = card.id?.replace("trial-", "") ?? "";
    const trialMatches = selectedTrial === "all" || trialId === selectedTrial;
    if (!trialMatches) {
      card.style.display = "none";
      return;
    }

    const modelCards = Array.from(card.querySelectorAll(".model-card"));
    let visibleModels = 0;
    modelCards.forEach((modelCard) => {
      const modelName = modelCard.dataset.model ?? "";
      const modelMatches =
        selectedModel === "all" || modelName === selectedModel;
      modelCard.style.display = modelMatches ? "" : "none";
      if (modelMatches) visibleModels++;
    });

    const showCard = visibleModels > 0;
    card.style.display = showCard ? "" : "none";
    if (showCard) visibleTrialCount++;
  });

  const emptyMessage = document.getElementById("summaryEmpty");
  if (emptyMessage) {
    emptyMessage.style.display = visibleTrialCount ? "none" : "";
  }
};

const updateNavControls = () => {
  const disabled = galleryEntries.length < 2;
  [lightboxPrevBtn, lightboxNextBtn].forEach((btn) => {
    if (!btn) return;
    if (disabled) {
      btn.setAttribute("disabled", "true");
    } else {
      btn.removeAttribute("disabled");
    }
  });
};

const closeLightbox = () => {
  if (!lightboxEl) return;
  lightboxEl.classList.add("hidden");
  lightboxEl.setAttribute("aria-hidden", "true");
  if (lightboxImg) {
    lightboxImg.src = "";
    lightboxImg.alt = "";
  }
  setText(lightboxModelEl, "");
  setText(lightboxPromptEl, "");
  if (lightboxScoresEl) {
    lightboxScoresEl.innerHTML = "";
  }
  currentEntryIndex = -1;
  document.body.style.removeProperty("overflow");
};

const showEntry = (index) => {
  if (!galleryEntries.length || !lightboxImg) return;
  const validIndex =
    ((index % galleryEntries.length) + galleryEntries.length) %
    galleryEntries.length;
  currentEntryIndex = validIndex;
  const entry = galleryEntries[validIndex];
  lightboxImg.src = entry.src;
  lightboxImg.alt = entry.alt;
  setText(lightboxModelEl, entry.model ?? "");
  setText(lightboxPromptEl, entry.prompt ?? "");
  setText(lightboxCommentEl, entry.comment ?? "-");
  if (lightboxScoresEl) {
    const parts = (entry.metrics ?? [])
      .filter((metric) => metric.label && metric.value && metric.value !== "-")
      .map((metric) => `<span>${metric.label} ${metric.value}</span>`);
    lightboxScoresEl.innerHTML = parts.join("");
  }
  updateNavControls();
};

const openLightbox = (entryIndex) => {
  if (!lightboxEl) return;
  if (!galleryEntries.length) return;
  showEntry(entryIndex);
  lightboxEl.classList.remove("hidden");
  lightboxEl.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
};

const navigateLightbox = (direction) => {
  if (currentEntryIndex === -1) return;
  showEntry(currentEntryIndex + direction);
};

const registerLightbox = () => {
  if (!lightboxEl) return;
  lightboxEl.addEventListener("click", (event) => {
    if (
      event.target === lightboxEl ||
      event.target.classList.contains("lightbox-backdrop")
    ) {
      closeLightbox();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightboxEl.classList.contains("hidden")) {
      closeLightbox();
    }
  });
  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener("click", () => closeLightbox());
  }
  if (lightboxPrevBtn) {
    lightboxPrevBtn.addEventListener("click", () => navigateLightbox(-1));
  }
  if (lightboxNextBtn) {
    lightboxNextBtn.addEventListener("click", () => navigateLightbox(1));
  }
};

const buildGalleryFromDom = () => {
  galleryEntries = [];
  galleryIndexByKey.clear();
  const navEntries = [];
  const trialCards = Array.from(document.querySelectorAll(".trial-card"));
  trialCards.forEach((trialCard) => {
    const trialId = trialCard.id?.replace("trial-", "") ?? "";
    const promptText =
      trialCard.querySelector(".trial-prompt-code")?.textContent?.trim() ?? "";
    const modelCards = Array.from(trialCard.querySelectorAll(".model-card"));
    modelCards.forEach((modelCard) => {
      const buttonEl = modelCard.querySelector(".image-button");
      const imgEl = modelCard.querySelector("img");
      const modelName =
        modelCard.querySelector(".model-name")?.textContent?.trim() ??
        modelCard.dataset.model ??
        "";
      const commentText =
        modelCard.querySelector(".model-comment")?.textContent?.trim() ?? "-";
      const metrics = Array.from(
        modelCard.querySelectorAll(".score-bar-label"),
      ).map((el) => {
        return {
          label: el.textContent.split(":")[0]?.trim() ?? "",
          value: el.textContent.split(":")[1]?.trim() ?? "",
        };
      });
      if (imgEl && buttonEl) {
        const entryIndex = navEntries.length;
        navEntries.push({
          src: imgEl.src,
          alt: imgEl.alt || "Mynd",
          model: modelName,
          prompt: promptText,
          comment: commentText,
          metrics,
        });
        galleryIndexByKey.set(makeGalleryKey(trialId, modelName), entryIndex);
        buttonEl.addEventListener("click", () => openLightbox(entryIndex));
        buttonEl.setAttribute(
          "aria-label",
          `Staekka mynd fyrir prA3f ${trialId || ""}`.trim(),
        );
      }
    });
  });
  galleryEntries = navEntries;
  currentEntryIndex = -1;
  updateNavControls();
};

const registerSummaryLightbox = () => {
  if (!summaryTable) return;
  const headerCells = Array.from(summaryTable.querySelectorAll("thead th"));
  if (headerCells.length < 3) return;
  const trialIds = headerCells.slice(2).map((cell) => {
    const match = cell.textContent.match(/(\d+)/);
    return match ? match[1] : "";
  });
  const bodyRows = Array.from(summaryTable.querySelectorAll("tbody tr"));
  bodyRows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) return;
    const modelName = cells[0].textContent.trim();
    cells.slice(2).forEach((cell, idx) => {
      const trialId = trialIds[idx] ?? "";
      const key = makeGalleryKey(trialId, modelName);
      if (!galleryIndexByKey.has(key)) return;
      const entryIndex = galleryIndexByKey.get(key);
      cell.classList.add("table-cell-link");
      cell.setAttribute("role", "button");
      cell.setAttribute("tabindex", "0");
      cell.addEventListener("click", () => openLightbox(entryIndex));
      cell.addEventListener("keypress", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          openLightbox(entryIndex);
        }
      });
    });
  });
};

if (trialFilterEl) {
  trialFilterEl.addEventListener("change", filterTrials);
}
if (modelFilterEl) {
  modelFilterEl.addEventListener("change", filterTrials);
}

// Run once on load to ensure correct initial state
filterTrials();

registerLightbox();
buildGalleryFromDom();
registerSummaryLightbox();

const topNav = document.querySelector(".top-nav");
const registerTopNavScrollHide = () => {
  if (!topNav) return;
  topNav.classList.remove("is-hidden");
  let lastY = window.scrollY;
  let ticking = false;
  const threshold = 10;
  const handle = () => {
    const currentY = window.scrollY;
    const scrollingDown = currentY - lastY > threshold;
    const scrollingUp = lastY - currentY > threshold;
    if (scrollingDown && currentY > 80) {
      topNav.classList.add("is-hidden");
    } else if (scrollingUp) {
      topNav.classList.remove("is-hidden");
    }
    lastY = currentY;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(handle);
      ticking = true;
    }
  });
};

registerTopNavScrollHide();
