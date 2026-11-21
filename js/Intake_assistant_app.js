// Intake_assistant_app.js
// Phase 2: build the action cards from data, show the active card's
// form/output, and make the CIC template fill live as you type.

// ===== DATA =====

// How many card slots the grid always shows. Unused ones say "Coming soon".
const TOTAL_SLOTS = 8;

// One object per card. The `id` must match data-panel="..." in Intake_assistant_index.html.
// `fields` (form cards only): `name` matches the input's name attribute and
// the output's data-field attribute; `placeholder` shows when it's empty.
const actions = [
  {
    id: "cic",
    type: "form",
    title: "CIC template",
    description: "Fill in fields to build a CIC note.",
    fields: [
      { name: "name", placeholder: "Client Name" },
      { name: "businessName", placeholder: "Business Name" },
      { name: "businessType", placeholder: "Business Type" },
      { name: "annualSales", placeholder: "Annual Sales" },
      { name: "naics", placeholder: "NAICS Code" },
    ],
  },
  {
    id: "startup",
    type: "form",
    title: "Business startup steps",
    description: "Check off the 10 steps to start a business.",
  },
  {
    id: "zoom",
    type: "parser",
    title: "Zoom summary",
    description: "Paste a Zoom summary to fill session notes.",
  },
  {
    id: "email",
    type: "form",
    title: "Follow-up email",
    description: "Draft a follow-up after a meeting.",
  },
  {
    id: "prompts",
    type: "lookup",
    title: "Prompt library",
    description: "Search saved prompts by topic.",
  },
  {
    id: "my-template",
    type: "form",
    title: "My template",
    description: "Paste your own template; it fills from the other cards.",
  },
  {
    // Link card: just opens the official site in a new tab. The site has
    // its own login/captcha, so we don't automate it or send it any data.
    id: "az-business-search",
    type: "link",
    title: "AZ business search",
    description: "Look up an entity on the Arizona Corporation Commission site.",
    url: "https://ecorp.azcc.gov/EntitySearch/Index",
  },
];

// Shared state, kept in memory only (clears on refresh, nothing is saved).
const session = {
  activeId: "cic", // which card is selected
  cic: {},         // CIC values, e.g. { name: "Ana", businessName: "..." }
  pickedPrompt: null, // the Prompt library row showing in the output panel
};

// ===== CARDS =====

// Build the card grid from `actions`, then pad with empty slots up to 8.
function renderCards() {
  const list = document.querySelector("#card-grid");
  const cardTemplate = document.querySelector("#card-template");
  const emptyTemplate = document.querySelector("#card-empty-template");
  const linkTemplate = document.querySelector("#card-link-template");

  // Start from an empty list so this can be called again after a click
  list.replaceChildren();

  actions.forEach(function (action) {
    // Link cards are simpler: fill in the text and the address, done.
    // They never become "active" because they leave the page.
    if (action.type === "link") {
      const linkCopy = linkTemplate.content.cloneNode(true);
      linkCopy.querySelector(".card").href = action.url;
      linkCopy.querySelector(".card-type").textContent = action.type;
      linkCopy.querySelector(".card-title").textContent = action.title;
      linkCopy.querySelector(".card-desc").textContent = action.description;
      list.appendChild(linkCopy);
      return; // skip the button code below, go to the next action
    }

    // Copy the blueprint, then fill in this card's text
    const copy = cardTemplate.content.cloneNode(true);
    const button = copy.querySelector(".card");

    copy.querySelector(".card-type").textContent = action.type;
    copy.querySelector(".card-title").textContent = action.title;
    copy.querySelector(".card-desc").textContent = action.description;

    // Highlight the selected card (aria-pressed tells screen readers too)
    const isActive = action.id === session.activeId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive);

    button.addEventListener("click", function () {
      selectCard(action.id);
    });

    list.appendChild(copy);
  });

  // Fill the remaining slots with "Coming soon"
  for (let i = actions.length; i < TOTAL_SLOTS; i++) {
    list.appendChild(emptyTemplate.content.cloneNode(true));
  }
}

// Called when a card is clicked
function selectCard(id) {
  session.activeId = id;
  renderCards();
  renderForm();
}

// ===== FORMS & OUTPUT =====

// Show only the form panel and output box that belong to the active card.
function renderForm() {
  const panels = document.querySelectorAll("[data-panel]");

  panels.forEach(function (panel) {
    panel.hidden = panel.dataset.panel !== session.activeId;
  });

  // If the active card has no output box yet, show a short message instead
  const activeOutput = document.querySelector(
    '.output [data-panel="' + session.activeId + '"]'
  );
  document.querySelector("#output-empty").hidden = activeOutput !== null;
}

// Copy a form card's input values into `session` and into its output box.
// Empty fields show their [Placeholder].
function fillTemplate(action) {
  const form = document.querySelector('form[data-panel="' + action.id + '"]');
  const output = document.querySelector('.output [data-panel="' + action.id + '"]');

  action.fields.forEach(function (field) {
    const value = getFieldValue(form, field.name);
    session[action.id][field.name] = value;

    // One field can appear in several spots (e.g. Business Name twice)
    const spots = output.querySelectorAll('[data-field="' + field.name + '"]');
    spots.forEach(function (spot) {
      spot.textContent = value || "[" + field.placeholder + "]";
    });
  });
}

// Read one field's value from a form.
// Dropdowns with an "Other" option have a partner text box named
// "<name>Other" (e.g. businessTypeOther). When "other" is picked, show
// that box and use what's typed in it; otherwise hide it.
function getFieldValue(form, name) {
  const value = form.elements[name].value;
  const otherBox = form.elements[name + "Other"];

  // Plain fields have no partner box
  if (!otherBox) {
    return value.trim();
  }

  const otherPicked = value === "other";
  otherBox.hidden = !otherPicked;

  if (otherPicked) {
    return otherBox.value.trim();
  }
  return value;
}

// Make a form card update its output on every keystroke.
function setupForm(action) {
  const form = document.querySelector('form[data-panel="' + action.id + '"]');

  // Pressing Enter would submit the form and reload the page,
  // wiping everything typed. Stop that.
  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  form.addEventListener("input", function () {
    fillTemplate(action);
  });

  fillTemplate(action); // show placeholders right away
}

// ===== PROMPT LIBRARY =====
// Data comes from the Google Sheet link in js/Intake_assistant_prompts.js.

// The sheet columns this card can't work without (found by name in row 1)
const TOPICS_COLUMN = "Related Niche Topics";
const TEMPLATE_COLUMN = "Prompt Template";

// Filled once the sheet has loaded. One object per sheet row, e.g.
// { "Prompt Name": "Client Meeting Prep Brief", ..., topics: ["managing business", ...] }
let promptLibrary = [];

// Turn CSV text into a list of rows (each row is a list of cells).
// Reads one character at a time because a cell can contain commas and
// line breaks when it's wrapped in quotes, and "" inside quotes means ".
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (insideQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'; // "" is an escaped quote
        i++;         // skip the second quote
      } else if (char === '"') {
        insideQuotes = false; // closing quote
      } else {
        cell += char; // commas and line breaks are just text in here
      }
    } else if (char === '"') {
      insideQuotes = true; // opening quote
    } else if (char === ",") {
      row.push(cell); // end of a cell
      cell = "";
    } else if (char === "\n") {
      row.push(cell); // end of a row
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char; // (\r is skipped: Windows line endings are \r\n)
    }
  }

  // The last row, if the file doesn't end with a line break
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

// Use row 1 (the header) to turn every other row into an object keyed by
// column name. Columns are found by NAME, so they can move in the sheet.
function rowsToPrompts(rows) {
  const header = rows[0].map(function (name) {
    return name.trim();
  });

  // Stop with a clear message if a needed column was renamed or removed
  [TOPICS_COLUMN, TEMPLATE_COLUMN].forEach(function (name) {
    if (!header.includes(name)) {
      throw new Error('Column "' + name + '" not found in row 1 of the sheet.');
    }
  });

  const prompts = [];

  rows.slice(1).forEach(function (row) {
    const prompt = {};
    header.forEach(function (name, index) {
      prompt[name] = (row[index] || "").trim();
    });

    // Skip empty rows (no template = nothing to show)
    if (prompt[TEMPLATE_COLUMN] === "") {
      return;
    }

    // "Managing Business; Start-up Assistance" -> ["Managing Business", "Start-up Assistance"]
    prompt.topics = prompt[TOPICS_COLUMN]
      .split(";")
      .map(function (topic) {
        return topic.trim();
      })
      .filter(function (topic) {
        return topic !== "";
      });

    prompts.push(prompt);
  });

  return prompts;
}

// Match the typed words against each prompt's Related Niche Topics only.
// A prompt scores 1 point per typed word found in its topics; partial words
// count ("start" finds "Start-up Assistance"). Best matches first.
// An empty search shows the first prompts in the sheet.
function searchPrompts(query) {
  const words = query.toLowerCase().split(" ").filter(function (word) {
    return word !== "";
  });

  if (words.length === 0) {
    return promptLibrary.slice(0, MAX_PROMPT_RESULTS);
  }

  const scored = [];

  promptLibrary.forEach(function (prompt) {
    const topics = prompt.topics.join(" ").toLowerCase();
    let score = 0;

    words.forEach(function (word) {
      if (topics.includes(word)) {
        score += 1;
      }
    });

    if (score > 0) {
      scored.push({ prompt: prompt, score: score });
    }
  });

  // Highest score first (ties keep the sheet's order)
  scored.sort(function (a, b) {
    return b.score - a.score;
  });

  return scored.slice(0, MAX_PROMPT_RESULTS).map(function (entry) {
    return entry.prompt;
  });
}

// Fill every [data-column] spot inside `area` with that column's value.
function fillColumns(area, prompt) {
  area.querySelectorAll("[data-column]").forEach(function (spot) {
    const value = prompt[spot.dataset.column];
    spot.textContent = value || "[" + spot.dataset.column + "]";
  });
}

// Show the matching prompts as cards.
function renderPromptResults(results) {
  const list = document.querySelector("#prompt-results");
  const cardTemplate = document.querySelector("#prompt-card-template");
  const chipTemplate = document.querySelector("#topic-chip-template");
  const status = document.querySelector("#prompt-status");

  list.replaceChildren();

  results.forEach(function (prompt) {
    const copy = cardTemplate.content.cloneNode(true);
    const button = copy.querySelector(".card");

    fillColumns(copy, prompt);

    // The badge's color comes from CSS, e.g. data-level="yellow"
    const badge = copy.querySelector(".privacy-badge");
    badge.dataset.level = prompt["Privacy Level"].toLowerCase();

    // One chip per topic
    const chips = copy.querySelector(".topic-chips");
    prompt.topics.forEach(function (topic) {
      const chipCopy = chipTemplate.content.cloneNode(true);
      chipCopy.querySelector(".topic-chip").textContent = topic;
      chips.appendChild(chipCopy);
    });

    // Highlight the prompt that's showing in the output panel
    const isPicked = prompt === session.pickedPrompt;
    button.classList.toggle("active", isPicked);
    button.setAttribute("aria-pressed", isPicked);

    button.addEventListener("click", function () {
      pickPrompt(prompt);
    });

    list.appendChild(copy);
  });

  if (results.length === 0) {
    status.textContent = "No prompts match that topic.";
  } else {
    status.textContent =
      "Showing " + results.length + " of " + promptLibrary.length + " prompts.";
  }
}

// Put the clicked prompt in the output panel.
function pickPrompt(prompt) {
  session.pickedPrompt = prompt;
  fillColumns(document.querySelector('.output [data-panel="prompts"]'), prompt);

  // Re-draw the cards so the picked one turns blue
  const searchBox = document.querySelector("#prompt-search");
  renderPromptResults(searchPrompts(searchBox.value));
}

// Download the sheet once, then connect the search box.
async function setupPromptLibrary() {
  const form = document.querySelector('form[data-panel="prompts"]');
  const searchBox = document.querySelector("#prompt-search");
  const status = document.querySelector("#prompt-status");

  // Enter would reload the page; stop it
  form.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  searchBox.addEventListener("input", function () {
    renderPromptResults(searchPrompts(searchBox.value));
  });

  if (PROMPT_SHEET_URL === "") {
    status.textContent = "Not connected yet: add the sheet link in js/Intake_assistant_prompts.js.";
    return;
  }

  status.textContent = "Loading prompts…";

  try {
    // The one outside call: a plain download, nothing typed is sent
    const response = await fetch(PROMPT_SHEET_URL);
    if (!response.ok) {
      throw new Error("The sheet link answered with error " + response.status + ".");
    }
    const text = await response.text();
    promptLibrary = rowsToPrompts(parseCSV(text));
    renderPromptResults(searchPrompts(searchBox.value));
  } catch (error) {
    // No internet, wrong link, or a renamed column. The rest still works.
    status.textContent = "Couldn't load the prompt library. " + error.message;
  }
}

// ===== START =====

renderCards();
renderForm();
setupPromptLibrary();

// Only cards that have `fields` are wired up so far (just CIC)
actions.forEach(function (action) {
  if (action.fields) {
    setupForm(action);
  }
});
