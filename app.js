// app.js
// Phase 2: build the action cards from data, show the active card's
// form/output, and make the CIC template fill live as you type.

// ===== DATA =====

// How many card slots the grid always shows. Unused ones say "Coming soon".
const TOTAL_SLOTS = 8;

// One object per card. The `id` must match data-panel="..." in index.html.
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

// ===== START =====

renderCards();
renderForm();

// Only cards that have `fields` are wired up so far (just CIC)
actions.forEach(function (action) {
  if (action.fields) {
    setupForm(action);
  }
});
