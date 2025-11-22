const modelsCsvPath = "models.csv";
const trialsCsvPath = "index.csv";
const folderOverrides = {
  "GPT-5.1": "GPT5-1",
  "GPT-4o": "GPT4o",
  "QWEN3-MAX": "QWEN",
  "GPT-5instant": "GPT-5instant",
};
const extensionPreference = ["png", "jpg", "jpeg", "webp"];
const imageCache = new Map();
const trialFilterEl = document.getElementById("trialFilter");
const modelFilterEl = document.getElementById("modelFilter");
const trialGrid = document.getElementById("trialGrid");
const trialTemplate = document.getElementById("trialTemplate");
const modelTemplate = document.getElementById("modelTemplate");
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
const summaryHead = summaryTable?.querySelector("thead tr");
const summaryBody = summaryTable?.querySelector("tbody");
const summaryEmpty = document.getElementById("summaryEmpty");
const summarySection = document.getElementById("summarySection");
const updatesList = document.getElementById("updatesList");
const updatesSection = document.getElementById("updatesSection");
const normalizeHeader = (value) =>
  typeof value === "string" ? value.trim() : "";
const normalizeValue = (value) =>
  value === undefined || value === null
    ? ""
    : typeof value === "string"
      ? value.trim()
      : String(value).trim();
const parseScoreNumber = (value) => {
  if (value === undefined || value === null) {
    return NaN;
  }
  const normalized = String(value).replace(",", ".").match(/-?\d+(\.\d+)?/);
  return normalized ? parseFloat(normalized[0]) : NaN;
};
const checklistCache = new Map();
let galleryEntries = [];
let currentEntryIndex = -1;
const galleryIndexByKey = new Map();
const makeGalleryKey = (trialId, modelName) => `${trialId}__${modelName}`;
const formatScoreWithMax = (value, max) => {
  const num = parseScoreNumber(value);
  if (Number.isNaN(num)) return `-/${max}`;
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(2);
  return `${formatted}/${max}`;
};
const renderUpdates = (entries) => {
  if (!updatesList) return;
  updatesList.innerHTML = "";
  if (!entries?.length) {
    updatesList.innerHTML = "<p class='table-empty'>Engar uppfaerslur tiltaekar.</p>";
    return;
  }
  entries.forEach((row) => {
    const item = document.createElement("article");
    item.className = "update-item";
    const title = document.createElement("h4");
    title.textContent = row.Description ?? "";
    const meta = document.createElement("p");
    meta.className = "update-meta";
    const date = row.Date ?? "";
    const version = row.Version ?? "";
    meta.textContent = [date, version].filter(Boolean).join(" • ");
    item.appendChild(title);
    item.appendChild(meta);
    updatesList.appendChild(item);
  });
};
const formatPrompt = (prompt) => {
  const trimmed = prompt.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};
const parseCsv = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) {
    return [];
  }
  const headers = splitCsvLine(lines.shift());
  return lines.map((line) => {
    const values = splitCsvLine(line);
    return headers.reduce((acc, header, index) => {
      acc[header.trim()] = values[index] ?? "";
      return acc;
    }, {});
  });
};
const splitCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};
const loadCsv = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }
  const text = await response.text();
  return parseCsv(text);
};
const loadOptionalCsv = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    return null;
  }
  const text = await response.text();
  return parseCsv(text);
};
const loadChecklist = async (trialId) => {
  if (checklistCache.has(trialId)) {
    return checklistCache.get(trialId);
  }
  const rows =
    (await loadOptionalCsv(`trial_checklists/${trialId}.csv`)) ?? [];
  const map = new Map();
  rows.forEach((row) => {
    if (!row.model) {
      return;
    }
    const entry = {
      comment: "-",
      overallLabel: "Heildareinkunn",
      overallValue: "-",
      metrics: [],
    };
    let fallbackMetric = null;
    Object.entries(row).forEach(([rawKey, rawValue]) => {
      const label = normalizeHeader(rawKey);
      if (!label || label.toLowerCase() === "model") {
        return;
      }
      const value = normalizeValue(rawValue) || "-";
      if (label.toLowerCase() === "comment") {
        entry.comment = value;
        return;
      }
      const metric = { label, value };
      entry.metrics.push(metric);
      const lower = label.toLowerCase();
      if (
        (entry.overallValue === "-" || entry.overallValue === "") &&
        lower.includes("heild")
      ) {
        entry.overallLabel = label;
        entry.overallValue = value;
      }
      if (!fallbackMetric && value !== "-") {
        fallbackMetric = metric;
      }
    });
    if (!entry.overallValue || entry.overallValue === "-") {
      const numericValues = entry.metrics
        .map((metric) => parseScoreNumber(metric.value))
        .filter((num) => !Number.isNaN(num));
      if (numericValues.length) {
        const total = numericValues.reduce((sum, num) => sum + num, 0);
        entry.overallValue = Number.isInteger(total) ? String(total) : total.toFixed(2);
      } else if (fallbackMetric) {
        entry.overallLabel = fallbackMetric.label;
        entry.overallValue = fallbackMetric.value;
      }
    }
    map.set(row.model.trim(), entry);
  });
  checklistCache.set(trialId, map);
  return map;
};
const renderSummaryTable = (trials, models, checklistMaps) => {
  if (!summaryTable || !summaryHead || !summaryBody) {
    return;
  }
  summaryBody.innerHTML = "";
  const columns = trials.map((trial) => {
    const checklist = checklistMaps.get(trial.ID);
    let label = "Heildareinkunn";
    if (checklist && checklist.size) {
      const firstEntry = checklist.values().next().value;
      if (firstEntry?.overallLabel) {
        label = firstEntry.overallLabel;
      }
    }
    return { trialId: trial.ID, label };
  });
  if (!columns.length) {
    summarySection?.classList.add("hidden");
    if (summaryEmpty) {
      summaryEmpty.style.display = "block";
      summaryEmpty.textContent = "No data to show";
    }
    return;
  }
  summarySection?.classList.remove("hidden");
  if (summaryEmpty) {
    summaryEmpty.style.display = "none";
  }
  const columnMax = new Map();
  const columnMin = new Map();
  const totals = new Map();
  columns.forEach((col) => {
    let max = -Infinity;
    let min = Infinity;
    let hasValue = false;
    models.forEach((model) => {
      const entry = checklistMaps.get(col.trialId)?.get(model.model);
      const numeric = parseScoreNumber(entry?.overallValue);
      if (!Number.isNaN(numeric)) {
        hasValue = true;
        if (numeric > max) {
          max = numeric;
        }
        if (numeric < min) {
          min = numeric;
        }
      }
    });
    columnMax.set(col.trialId, hasValue ? max : NaN);
    columnMin.set(col.trialId, hasValue ? min : NaN);
  });
  models.forEach((model) => {
    let sum = 0;
    let hasAny = false;
    columns.forEach((col) => {
      const entry = checklistMaps.get(col.trialId)?.get(model.model);
      const numeric = parseScoreNumber(entry?.overallValue);
      if (!Number.isNaN(numeric)) {
        hasAny = true;
        sum += numeric;
      }
    });
    totals.set(model.model, hasAny ? sum : NaN);
  });
  const sortedModels = [...models].sort((a, b) => {
    const aTotal = totals.get(a.model);
    const bTotal = totals.get(b.model);
    const aVal = Number.isNaN(aTotal) ? -Infinity : aTotal;
    const bVal = Number.isNaN(bTotal) ? -Infinity : bTotal;
    return bVal - aVal;
  });
  summaryHead.innerHTML = "";
  const firstTh = document.createElement("th");
  firstTh.textContent = "Likan";
  summaryHead.appendChild(firstTh);
  const totalTh = document.createElement("th");
  totalTh.textContent = "Heildartala";
  summaryHead.appendChild(totalTh);
  columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = 'Test ' + col.trialId;
    summaryHead.appendChild(th);
  });
  models.forEach((model) => {
    const tr = document.createElement("tr");
    const nameTd = document.createElement("td");
    nameTd.textContent = model.model;
    tr.appendChild(nameTd);
    const totalTd = document.createElement("td");
    const totalValue = totals.get(model.model);
    const totalSpan = document.createElement("span");
    const totalsArray = Array.from(totals.values()).filter((v) => !Number.isNaN(v));
    const maxTotal = totalsArray.length ? Math.max(...totalsArray) : NaN;
    const isWinner = !Number.isNaN(totalValue) && totalValue === maxTotal;
    totalSpan.className = isWinner ? "score-chip total-winner" : "score-chip total";
    if (isWinner) {
      const crown = document.createElement("span");
      crown.className = "crown-icon";
      crown.setAttribute("aria-hidden", "true");
      crown.textContent = "♛ ";
      totalSpan.appendChild(crown);
    }
    const totalText = document.createElement("span");
    totalText.textContent = formatScoreWithMax(totalValue, 30 * columns.length);
    totalSpan.appendChild(totalText);
    totalTd.appendChild(totalSpan);
    tr.appendChild(totalTd);
    columns.forEach((col) => {
      const td = document.createElement("td");
      const entry = checklistMaps.get(col.trialId)?.get(model.model);
      const value = entry?.overallValue ?? "?";
      const numeric = parseScoreNumber(value);
      const best = !Number.isNaN(numeric) && numeric === columnMax.get(col.trialId);
      const worst =
        !Number.isNaN(numeric) && numeric === columnMin.get(col.trialId);
      const span = document.createElement("span");
      span.className = best ? "score-chip best" : worst ? "score-chip worst" : "score-chip";
      span.textContent = formatScoreWithMax(value, 30);
      td.appendChild(span);
      const key = makeGalleryKey(col.trialId, model.model);
      if (galleryIndexByKey.has(key)) {
        const index = galleryIndexByKey.get(key);
        td.classList.add("table-cell-link");
        td.setAttribute("role", "button");
        td.setAttribute("tabindex", "0");
        td.addEventListener("click", () => openLightbox(index));
        td.addEventListener("keypress", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            openLightbox(index);
          }
        });
      }
      tr.appendChild(td);
    });
    summaryBody.appendChild(tr);
  });
};
const getFolderName = (modelName) => {
  if (folderOverrides[modelName]) {
    return folderOverrides[modelName];
  }
  return modelName.replace(/[.\s]/g, "");
};
const findImagePath = async (folderName, trialId) => {
  const cacheKey = `${folderName}_${trialId}`;
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }
  for (const ext of extensionPreference) {
    const url = `images/${folderName}/${trialId}.${ext}`;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        imageCache.set(cacheKey, url);
        return url;
      }
    } catch {
      // Ignore fetch errors and move to the next extension
    }
  }
  imageCache.set(cacheKey, null);
  return null;
};
const populateFilters = (trials, models) => {
  trials.forEach((trial) => {
    const option = document.createElement("option");
    option.value = trial.ID;
    const labelSource = formatPrompt(trial.name ?? trial.prompt ?? "");
    option.textContent = `${trial.ID} : ${labelSource.slice(0, 40)}${labelSource.length > 40 ? "-" : ""}`;
    trialFilterEl.appendChild(option);
  });

  models.forEach((model) => {
    const option = document.createElement("option");
    option.value = model.model;
    option.textContent = model.model;
    modelFilterEl.appendChild(option);
  });
};
const setText = (node, value) => {
  if (!node) return;
  node.textContent = value;
};
const normalizeDate = (value) => {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
};
const formatType = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return "�tilgreint";
  }
  return trimmed.toLowerCase() === "image" ? "myndger�" : trimmed;
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
  setText(lightboxCommentEl, entry.comment ?? "—");
  if (lightboxScoresEl) {
    const parts = (entry.metrics ?? [])
      .filter((metric) => metric.label && metric.value && metric.value !== "—")
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
const createModelCard = (
  model,
  folderName,
  trialId,
  promptText,
  whenGenerated,
  scoreData,
  imagePath,
  entries,
) => {
  if (!modelTemplate?.content?.firstElementChild) {
    return document.createDocumentFragment();
  }
  const modelNode = modelTemplate.content.firstElementChild.cloneNode(true);
  const nameEl = modelNode.querySelector(".model-name");
  setText(nameEl, model.model);
  const dateEl = modelNode.querySelector(".generated-date");
  const overallEl = modelNode.querySelector(".overall-grade");
  const commentEl = modelNode.querySelector(".model-comment");
  const overallLabelEl = modelNode.querySelector(".score-label");
  const imgEl = modelNode.querySelector("img");
  const buttonEl = modelNode.querySelector(".image-button");
  const imageWrap = modelNode.querySelector(".image-wrap");
  const altText = model?.model ? `Mynd fyrir ${model.model}` : "Mynd";
  if (dateEl) {
    dateEl.textContent = whenGenerated
      ? `Búið til: ${whenGenerated}`
      : "Dagsetning óþekkt";
  }
  setText(overallLabelEl, scoreData?.overallLabel ?? "Heildareinkunn");
  setText(overallEl, formatScoreWithMax(scoreData?.overallValue, 30));
  setText(commentEl, scoreData?.comment ?? "—");
  const scoreTile = modelNode.querySelector(".score-tile");
  if (scoreTile) {
    const parent = scoreTile.parentNode;
    const stack = document.createElement("div");
    stack.className = "score-stack";
    const bars = document.createElement("div");
    bars.className = "score-bars";
    const metrics = (scoreData?.metrics ?? []).slice(0, 3);
    metrics.forEach((metric) => {
      const wrapper = document.createElement("div");
      wrapper.className = "score-bar";
      const label = document.createElement("span");
      label.className = "score-bar-label";
      const metricValue = formatScoreWithMax(metric.value, 10);
      label.textContent = `${metric.label}: ${metricValue}`;
      const track = document.createElement("div");
      track.className = "score-bar-track";
      const fill = document.createElement("div");
      fill.className = "score-bar-fill";
      const numeric = parseScoreNumber(metric.value);
      const percent = Number.isNaN(numeric)
        ? 0
        : Math.max(0, Math.min(100, (numeric / 10) * 100));
      fill.style.width = `${percent}%`;
      track.appendChild(fill);
      wrapper.appendChild(label);
      wrapper.appendChild(track);
      bars.appendChild(wrapper);
    });
    if (metrics.length) {
      stack.appendChild(bars);
    }
    parent.insertBefore(stack, scoreTile);
    parent.removeChild(scoreTile);
    stack.appendChild(scoreTile);
  }
  if (imagePath && imgEl) {
    imgEl.src = imagePath;
    imgEl.alt = altText;
    if (buttonEl) {
      const entryIndex = entries.length;
      entries.push({
        src: imagePath,
        alt: altText,
        model: model.model,
        prompt: promptText,
        whenGenerated,
        comment: scoreData?.comment ?? "?",
        metrics: scoreData?.metrics ?? [],
      });
      galleryIndexByKey.set(makeGalleryKey(trialId, model.model), entryIndex);
      buttonEl.addEventListener("click", () => openLightbox(entryIndex));
      buttonEl.setAttribute(
        "aria-label",
        `Staekka mynd fyrir prof ${trialId}`,
      );
    }
  } else {
    if (buttonEl) {
      buttonEl.remove();
    }
    if (imgEl) {
      imgEl.remove();
    }
    if (imageWrap) {
      const placeholder = document.createElement("div");
      placeholder.className = "missing-image";
      placeholder.textContent = "No image yet";
      imageWrap.appendChild(placeholder);
    }
  }
  modelNode.dataset.model = model.model;
  modelNode.dataset.folder = folderName;
  modelNode.dataset.trial = trialId;
  return modelNode;
};
const renderTrials = async (trials, models) => {
  trialGrid.innerHTML = "";
  galleryEntries = [];
  galleryIndexByKey.clear();

  const selectedTrial = trialFilterEl.value;
  const selectedModel = modelFilterEl.value;
  const navEntries = [];

  const filteredTrials =
    selectedTrial === "all"
      ? trials
      : trials.filter((trial) => trial.ID === selectedTrial);

  for (const trial of filteredTrials) {
    if (!trialTemplate?.content?.firstElementChild) {
      continue;
    }

    const trialNode = trialTemplate.content.firstElementChild.cloneNode(true);
    trialNode.id = `trial-${trial.ID}`;

    const idEl = trialNode.querySelector(".trial-id");
    const typeEl = trialNode.querySelector(".trial-type");
    const nameEl = trialNode.querySelector(".trial-name");
    const descriptionEl = trialNode.querySelector(".trial-description");
    const promptCodeEl = trialNode.querySelector(".trial-prompt-code");
    const metricsPills = trialNode.querySelector(".trial-metrics");
    const modelGrid = trialNode.querySelector(".model-grid");

    if (idEl) {
      const link = document.createElement("a");
      link.href = `#trial-${trial.ID}`;
      link.className = "trial-link";
      link.title = "Smelltu til ad afrita tengil";
      link.innerHTML = `Prof ${trial.ID}`;
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const url = `${window.location.origin}${window.location.pathname}#trial-${trial.ID}`;
        navigator?.clipboard?.writeText?.(url).catch(() => {});
        window.location.hash = `trial-${trial.ID}`;
      });
      idEl.replaceChildren(link);
    } else {
      setText(idEl, `Pr�f ${trial.ID}`);
    }

    setText(typeEl, `Tegund: ${formatType(trial.type ?? "")}`);
    const nameText = formatPrompt(trial.name ?? "");
    const descriptionText = formatPrompt(trial.description ?? "");
    const promptText = trial.prompt ?? "";
    setText(nameEl, nameText || `Prof ${trial.ID}`);
    setText(descriptionEl, descriptionText);
    if (promptCodeEl) {
      promptCodeEl.textContent = promptText;
    }

    const checklist = (await loadChecklist(trial.ID)) ?? new Map();
    if (metricsPills) {
      metricsPills.innerHTML = "";
      const firstEntry = checklist.values().next().value;
      const labels = (firstEntry?.metrics ?? [])
        .map((m) => m.label)
        .filter(Boolean)
        .slice(0, 3);
      labels.forEach((label) => {
        const pill = document.createElement("span");
        pill.className = "trial-metric-pill";
        pill.textContent = `${label}: 10 stig`;
        metricsPills.appendChild(pill);
      });
    }

    const whenGenerated = normalizeDate(trial.when_generated);
    for (const model of models) {
      if (selectedModel !== "all" && selectedModel !== model.model) {
        continue;
      }

      const folderName = getFolderName(model.model);
      const imagePath = await findImagePath(folderName, trial.ID);
      const scoreData =
        checklist.get(model.model) ?? {
          comment: "-",
          overallLabel: "Heildareinkunn",
          overallValue: "-",
          metrics: [],
        };
      const modelCard = createModelCard(
        model,
        folderName,
        trial.ID,
        promptText,
        whenGenerated,
        scoreData,
        imagePath,
        navEntries,
      );
      modelGrid?.appendChild(modelCard);
    }

    if (!modelGrid?.children.length) {
      const empty = document.createElement("p");
      empty.className = "status-message";
      empty.textContent = "No models match the current filter.";
      modelGrid?.appendChild(empty);
    }

    trialGrid.appendChild(trialNode);
  }

  if (!trialGrid.children.length) {
    const empty = document.createElement("div");
    empty.className = "status-message";
    empty.textContent = "Engin prof til fyrir thessa sidu.";
    trialGrid.appendChild(empty);
  }

  galleryEntries = navEntries;
  currentEntryIndex = -1;
  updateNavControls();
  const summaryChecklists = new Map();
  for (const trial of trials) {
    const summaryChecklist = (await loadChecklist(trial.ID)) ?? new Map();
    summaryChecklists.set(trial.ID, summaryChecklist);
  }
  renderSummaryTable(trials, models, summaryChecklists);
};

const boot = async () => {
  registerLightbox();
  let updatesRows = [];
  try {
    updatesRows = await loadCsv('updates.csv');
  } catch (e) {
    updatesRows = [];
  }
  renderUpdates(updatesRows);
  try {
    const [modelRows, trialRows] = await Promise.all([
      loadCsv(modelsCsvPath),
      loadCsv(trialsCsvPath),
    ]);
    const imageModels = modelRows.filter((model) =>
      (model.generate_image ?? "").toLowerCase().startsWith("y"),
    );
    if (!imageModels.length) {
      trialGrid.innerHTML =
        "<div class='status-message'>Engin valin likon geta búið til myndir.</div>";
      return;
    }
    populateFilters(trialRows, imageModels);
    await renderTrials(trialRows, imageModels);
    trialFilterEl.addEventListener("change", () => {
      renderTrials(trialRows, imageModels);
    });
    modelFilterEl.addEventListener("change", () => {
      renderTrials(trialRows, imageModels);
    });
  } catch (error) {
    console.error(error);
    trialGrid.innerHTML = `<div class="status-message">Mistokst að hlaða gognum: ${error.message}</div>`;
  }
};
boot();














