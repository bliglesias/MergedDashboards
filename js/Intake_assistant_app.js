// Intake_assistant_app.js
// The 10 steps to start a business in Arizona (from the ACC's
// "Ten Steps to Starting a Business in AZ" page).
// - Top: one card per step (the progress map). Clicking a card shows
//   that step in the middle box. A card shows the step's answer.
// - Middle: the selected step: what to do, a link to the official page,
//   a first question (a menu) and, for some answers, a follow-up box.
// - Right: "In summary", one plain-text line per step.
// Nothing is saved: everything lives in `session` and clears on refresh.

// ===== DATA =====

// One object per step, in order.
// `title`: full name (drop-down). `short`: card label and summary label.
// `todo`: what the client does. `url` / `linkText`: the official page.
//
// `question` (optional): the first question, shown as a menu.
//   `options`: the answers to pick from.
//   `done`: which answers mean the step is finished.
// `more` (optional): the follow-up box, e.g. "Entity ID".
//   `showWhen`: the answers that make it appear. Without `question`,
//   it's always shown and typing in it finishes the step.
//   `type`: "text" (default) or "date".
const steps = [
  {
    title: "Choose A Name",
    short: "Choose a name",
    todo: "Pick a name and search online to make sure no one else is using it.",
    url: "https://www.sba.gov/counseling/launch-your-business/#business-name",
    linkText: "SBA: choose your business name",
    more: { label: "Business name", placeholder: "e.g. Sunny Day Tacos" },
  },
  {
    title: "Purchase A Domain Name or See Numbers 3, 4, and 5 Below",
    short: "Domain name",
    todo: "Optional, and can be done now or later. Owning a domain doesn't give any rights to the business name.",
    url: "https://lookup.icann.org/en",
    linkText: "ICANN: look up a domain",
    question: {
      label: "Bought a domain?",
      options: ["Yes", "Later"],
      done: ["Yes"], // "Later" isn't confirmed, so the card turns red
    },
    more: { label: "Domain name", placeholder: "e.g. sunnydaytacos.com", showWhen: ["Yes"] },
  },
  {
    title: "Choose An Entity Type",
    short: "Entity type",
    todo: "LLC, corporation or nonprofit corporation. \"S corp\" and \"C corp\" are federal tax labels, not entity types. The ACC can't advise which one to pick.",
    url: "https://www.sba.gov/counseling/launch-your-business/#business-structure",
    linkText: "SBA: choose a business structure",
    question: {
      label: "Entity type",
      options: [
        "LLC",
        "Corporation",
        "Nonprofit corporation",
        "Sole proprietorship (no ACC filing)",
        "General partnership (no ACC filing)",
      ],
      done: [
        "LLC",
        "Corporation",
        "Nonprofit corporation",
        "Sole proprietorship (no ACC filing)",
        "General partnership (no ACC filing)",
      ],
    },
  },
  {
    title: "Check Name Availability With the Arizona Corporation Commission",
    short: "Name availability",
    todo: "On the Arizona Business Center: File, then Name, then Check Name Availability.",
    url: "https://arizonabusinesscenter.azcc.gov/EntitySearch/Index",
    linkText: "ACC: entity search",
    question: {
      label: "Is the name available?",
      options: ["Available", "Taken, pick another name"],
      done: ["Available"], // a taken name means they still need a new one
    },
  },
  {
    title: "Secure the Name or Form the Entity - You Choose",
    short: "Secure or form",
    todo: "Three choices: reserve the name with the ACC (lasts 120 days), register a trade name with the Secretary of State (lasts 5 years), or go straight to forming the entity.",
    url: "https://arizonabusinesscenter.azcc.gov/",
    linkText: "Arizona Business Center (ACC online filing)",
    question: {
      label: "What did they choose?",
      options: ["Reserved the name", "Registered a trade name", "Formed the entity"],
      done: ["Reserved the name", "Registered a trade name", "Formed the entity"],
    },
    more: { label: "Reservation ends", type: "date", showWhen: ["Reserved the name"] },
  },
  {
    title: "File with the Arizona Corporation Commission Corporations Division",
    short: "File with ACC",
    todo: "Submit Articles of Organization (LLC) or Articles of Incorporation (corporation), online if possible. The ACC sends an approval letter, or a letter explaining what to fix.",
    url: "https://arizonabusinesscenter.azcc.gov/",
    linkText: "Arizona Business Center (ACC online filing)",
    question: {
      label: "Filed with the ACC?",
      options: ["Not yet", "Submitted, waiting", "Approved"],
      done: ["Approved"],
    },
    more: { label: "Entity ID", placeholder: "e.g. 23673486", showWhen: ["Approved"] },
  },
  {
    title: "Arizona Department of Revenue",
    short: "AZ Dept. of Revenue",
    todo: "They might need a transaction privilege tax (TPT) license, usually if they sell goods or taxable services.",
    url: "https://azdor.gov/business/transaction-privilege-tax",
    linkText: "ADOR: transaction privilege tax",
    question: {
      label: "Have a TPT license?",
      options: ["Yes", "Not yet", "Not needed", "Not sure"],
      done: ["Yes", "Not needed"],
    },
    more: { label: "TPT license number", placeholder: "From ADOR", showWhen: ["Yes"] },
  },
  {
    title: "City or County Taxes and Business Licensing",
    short: "Local taxes & license",
    todo: "Register with the city (or the county, outside city limits) for local taxes and any business licenses. The ACC doesn't issue licenses.",
    url: "https://www.azcommerce.com/small-business/quick-links/business-licensing",
    linkText: "Arizona Commerce Authority: business licensing",
    question: {
      label: "Have a city or county license?",
      options: ["Yes", "Not yet", "Not needed", "Not sure"],
      done: ["Yes", "Not needed"],
    },
    more: { label: "City and license number", placeholder: "e.g. Tempe, #12345", showWhen: ["Yes"] },
  },
  {
    title: "Federal EIN or TIN - Internal Revenue Service",
    short: "Federal EIN / TIN",
    todo: "Apply for an Employer Identification Number (EIN) from the IRS. It's free.",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number",
    linkText: "IRS: get an EIN",
    question: {
      label: "Have an EIN?",
      options: ["Yes", "Not yet"],
      done: ["Yes"],
    },
    more: { label: "EIN", placeholder: "e.g. 12-3456789", showWhen: ["Yes"] },
  },
  {
    title: "Business Bank Account",
    short: "Bank account",
    todo: "Open a bank account just for the business. The ACC won't accept temporary checks without a printed name and address.",
    url: "https://www.sba.gov/counseling/launch-your-business/#bank-account",
    linkText: "SBA: open a business bank account",
    question: {
      label: "Business bank account open?",
      options: ["Yes", "Not yet"],
      done: ["Yes"],
    },
    more: { label: "Bank", placeholder: "e.g. Desert Community Bank", showWhen: ["Yes"] },
  },
];

// Shared state, kept in memory only (clears on refresh, nothing is saved).
// One entry per step, in the same order as `steps`.
const session = {
  selected: 0,                                     // step showing in the middle box
  answers: steps.map(function () { return ""; }),  // first-question answers
  details: steps.map(function () { return ""; }),  // follow-up box values
  client: null,                                    // saved client picked at the top
};

// Where the Toolbox's Clients page keeps its list in the browser.
// This page only READS it; it never writes to it.
const CLIENTS_KEY = "sbdc-clients";

// Which saved answer fills which step's first question. `step` counts from 1.
// `map`: the client's saved answer -> the answer to pick here.
// e.g. a saved tpt of "na" (not applicable) picks "Not needed" on step 7.
const AUTOFILL = [
  { step: 6, fact: "llc", map: { yes: "Approved" } },
  { step: 7, fact: "tpt", map: { yes: "Yes", no: "Not yet", na: "Not needed", unsure: "Not sure" } },
  { step: 9, fact: "ein", map: { yes: "Yes", no: "Not yet" } },
];

// ===== HELPERS =====

// Not confirmed: the question has an answer, but not a "done" one,
// e.g. "Later", "Taken", "Not yet", "Submitted, waiting", "Not sure".
// These cards turn red so they stand out for follow-up.
function isFlagged(index) {
  return session.answers[index] !== "" && !isDone(index);
}

// Should this step's follow-up box be showing?
function showsMore(index) {
  const step = steps[index];
  if (!step.more) {
    return false;
  }
  if (!step.question) {
    return true; // no first question: the box is the whole step
  }
  return step.more.showWhen.includes(session.answers[index]);
}

// A step is done when its first answer is a "done" answer.
// Steps with only a box (step 1) are done once something is typed.
function isDone(index) {
  const step = steps[index];
  if (step.question) {
    return step.question.done.includes(session.answers[index]);
  }
  return session.details[index] !== "";
}

// What to show for a step on its card and in the summary,
// e.g. "Approved · 23673486". Empty when nothing is answered.
function answerText(index) {
  const parts = [];
  if (session.answers[index] !== "") {
    parts.push(session.answers[index]);
  }
  if (showsMore(index) && session.details[index] !== "") {
    parts.push(session.details[index]);
  }
  return parts.join(" · ");
}

// The "now" step is the first one that isn't done.
// Returns -1 when every step is done.
function currentStep() {
  for (let i = 0; i < steps.length; i++) {
    if (!isDone(i)) {
      return i;
    }
  }
  return -1;
}

// How many steps are done
function doneCount() {
  let count = 0;
  steps.forEach(function (step, index) {
    if (isDone(index)) {
      count++;
    }
  });
  return count;
}

// ===== BUILD THE PAGE (runs once) =====

// Make one card per step from the card template.
function renderStepCards() {
  const list = document.querySelector("#step-grid");
  const template = document.querySelector("#step-card-template");

  steps.forEach(function (step, index) {
    const copy = template.content.cloneNode(true);
    const button = copy.querySelector(".step-card");

    copy.querySelector(".step-number").textContent = "Step " + (index + 1);
    copy.querySelector(".step-title").textContent = step.short;

    button.addEventListener("click", function () {
      selectStep(index);

      // Bring the step into view (helps on small screens)
      const details = document.querySelectorAll(".step-detail")[index];
      details.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    list.appendChild(copy);
  });
}

// Make a menu field from the template. `id` links its label to the menu.
function makeMenu(label, options, id) {
  const copy = document.querySelector("#select-field-template").content.cloneNode(true);
  const select = copy.querySelector("select");
  const optionTemplate = document.querySelector("#option-template");

  copy.querySelector("label").textContent = label;
  copy.querySelector("label").htmlFor = id;
  select.id = id;

  // One <option> per answer; the answer text is also its value
  options.forEach(function (answer) {
    const optionCopy = optionTemplate.content.cloneNode(true);
    const option = optionCopy.querySelector("option");
    option.value = answer;
    option.textContent = answer;
    select.appendChild(optionCopy);
  });

  return copy;
}

// Make a typing (or date) field from the template.
function makeBox(more, id) {
  const copy = document.querySelector("#text-field-template").content.cloneNode(true);
  const input = copy.querySelector("input");

  copy.querySelector("label").textContent = more.label;
  copy.querySelector("label").htmlFor = id;
  input.id = id;
  input.type = more.type || "text";
  input.placeholder = more.placeholder || "";

  return copy;
}

// Make one drop-down per step from the drop-down template.
function renderStepDetails() {
  const list = document.querySelector("#step-list");
  const template = document.querySelector("#step-detail-template");

  steps.forEach(function (step, index) {
    const copy = template.content.cloneNode(true);
    const details = copy.querySelector(".step-detail");
    const number = index + 1;

    copy.querySelector(".step-summary-title").textContent = number + ". " + step.title;
    copy.querySelector(".step-todo").textContent = step.todo;

    const link = copy.querySelector(".step-open");
    link.href = step.url;
    link.textContent = "Open " + step.linkText;

    // First question (a menu)
    if (step.question) {
      const spot = copy.querySelector(".step-question");
      spot.appendChild(makeMenu(step.question.label, step.question.options, "question-" + number));
      const menu = spot.querySelector("select");

      menu.addEventListener("input", function () {
        session.answers[index] = menu.value;
        updatePage();
      });
    }

    // Follow-up box (shown or hidden by updateDetails)
    if (step.more) {
      const spot = copy.querySelector(".step-more");
      spot.appendChild(makeBox(step.more, "more-" + number));
      const box = spot.querySelector("input");

      // "input" fires on every keystroke
      box.addEventListener("input", function () {
        session.details[index] = box.value.trim();
        updatePage();
      });

      // Enter: go to the next step
      box.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          goToNextStep(index);
        }
      });
    }

    // Opening a drop-down by hand also highlights its card
    details.addEventListener("toggle", function () {
      if (details.open) {
        session.selected = index;
        updatePage();
      }
    });

    list.appendChild(copy);
  });
}

// After Enter: show the next step and put the cursor in its first field.
function goToNextStep(index) {
  const next = index + 1;

  // Last step: just leave the box
  if (next >= steps.length) {
    document.activeElement.blur();
    return;
  }

  selectStep(next);
  const firstField = document.querySelectorAll(".step-detail")[next].querySelector("select, input");
  firstField.focus();
}

// ===== SAVED CLIENTS =====

// Read the saved client list. It's stored as JSON text, shaped like:
// { v: 1, list: [ { name, biz, email, facts: { llc: "yes", ... } }, ... ] }
// Returns an empty list if there's nothing saved or the text is broken.
function loadSavedClients() {
  try {
    const saved = JSON.parse(localStorage.getItem(CLIENTS_KEY));
    if (saved && Array.isArray(saved.list)) {
      return saved.list;
    }
  } catch (error) {
    // Broken or missing data: carry on with no clients
  }
  return [];
}

// Fill the "Fill from a saved client" list.
function setupClientPicker() {
  const select = document.querySelector("#client-pick");
  const note = document.querySelector("#client-pick-note");
  const template = document.querySelector("#option-template");
  const clients = loadSavedClients();

  if (clients.length === 0) {
    select.disabled = true;
    note.textContent = "No saved clients yet. Add one on the Toolbox's Clients page.";
    return;
  }

  clients.forEach(function (client, index) {
    const copy = template.content.cloneNode(true);
    const option = copy.querySelector("option");

    option.value = index; // position in the list, used when it's picked
    // "Sam Patel · Auto Care LLC", or just one of them if the other is missing
    option.textContent = [client.name, client.biz].filter(Boolean).join(" · ");

    select.appendChild(copy);
  });

  select.addEventListener("change", function () {
    // value is "" for "Choose a client"
    const client = select.value === "" ? null : clients[select.value];
    fillFromClient(client);
  });
}

// Start every step over, then fill in what the client's record knows.
function fillFromClient(client) {
  const note = document.querySelector("#client-pick-note");
  session.client = client;

  // Clear everything first, so switching clients doesn't mix them up
  session.answers = steps.map(function () { return ""; });
  session.details = steps.map(function () { return ""; });

  if (client) {
    const facts = client.facts || {};

    // Step 1: business name
    session.details[0] = client.biz || "";

    // Step 2: a website address means they have a domain
    if (facts.website) {
      session.answers[1] = "Yes";
      session.details[1] = facts.website;
    }

    // Saved yes/no answers pick the matching first answer
    AUTOFILL.forEach(function (rule) {
      const answer = rule.map[facts[rule.fact]];
      if (answer) {
        session.answers[rule.step - 1] = answer;
      }
    });

    // List the steps that are now done
    const filled = [];
    steps.forEach(function (step, index) {
      if (isDone(index)) {
        filled.push(index + 1);
      }
    });

    if (filled.length > 0) {
      note.textContent = "Filled from their record: step " + filled.join(", ") + ".";
    } else {
      note.textContent = "Their record doesn't cover any finished steps yet.";
    }
  } else {
    note.textContent = "";
  }

  // Put the new values into the menus and boxes on the page
  steps.forEach(function (step, index) {
    const number = index + 1;
    const menu = document.querySelector("#question-" + number);
    const box = document.querySelector("#more-" + number);
    if (menu) {
      menu.value = session.answers[index];
    }
    if (box) {
      box.value = session.details[index];
    }
  });

  updatePage();
}

// ===== UPDATE THE PAGE (runs after every change) =====

// Called when a step card is clicked: show that step in the middle box.
function selectStep(index) {
  session.selected = index;

  const allDetails = document.querySelectorAll(".step-detail");
  allDetails.forEach(function (details, i) {
    details.open = i === index;
  });

  updatePage();
}

// Set each card's look (done / now / not started, selected) and answer.
function updateCards() {
  const now = currentStep();
  const cards = document.querySelectorAll(".step-card");

  cards.forEach(function (card, index) {
    const done = isDone(index);
    const flagged = isFlagged(index);
    const isNow = index === now;
    const isActive = index === session.selected;

    card.classList.toggle("done", done);
    card.classList.toggle("flagged", flagged);
    card.classList.toggle("now", isNow);
    card.classList.toggle("active", isActive);
    card.setAttribute("aria-pressed", isActive);

    card.querySelector(".step-value").textContent = answerText(index);

    let status = "Not started";
    if (done) {
      status = "✓ Done";
    } else if (flagged) {
      status = "! Not confirmed";
    } else if (isNow) {
      status = "Now";
    }
    card.querySelector(".step-status").textContent = status;
  });
}

// Middle box: show only the selected step, its status, and its
// follow-up box when the answer calls for it.
function updateDetails() {
  const now = currentStep();
  const allDetails = document.querySelectorAll(".step-detail");

  allDetails.forEach(function (details, index) {
    const status = details.querySelector(".step-summary-status");
    const done = isDone(index);

    // Only the selected card's step shows in the middle box
    details.hidden = index !== session.selected;

    details.classList.toggle("done", done);
    details.classList.toggle("flagged", isFlagged(index));
    details.querySelector(".step-more").hidden = !showsMore(index);

    if (done) {
      status.textContent = "✓ Done";
    } else if (isFlagged(index)) {
      status.textContent = "! Not confirmed";
    } else if (index === now) {
      status.textContent = "Now";
    } else {
      status.textContent = "";
    }
  });
}

// "3 of 10 done" above the cards
function updateCount() {
  document.querySelector("#progress-count").textContent =
    doneCount() + " of " + steps.length + " done";
}

// "In summary": one line per step, in plain text so it can be copied.
// Unanswered steps show [Not answered]; red ones end in "(not confirmed)".
function updateSummary() {
  const now = currentStep();
  const lines = [];

  if (session.client) {
    lines.push("Client: " + (session.client.name || "[Client name]"));
  }
  lines.push(doneCount() + " of " + steps.length + " startup steps done");
  lines.push("");

  steps.forEach(function (step, index) {
    let answer = answerText(index) || "[Not answered]";
    if (isFlagged(index)) {
      answer += " (not confirmed)";
    }
    lines.push(step.short + ": " + answer);
  });

  lines.push("");
  if (now === -1) {
    lines.push("All steps done.");
  } else {
    lines.push("Next step: " + (now + 1) + ". " + steps[now].title);
    lines.push(steps[now].url);
  }

  document.querySelector("#progress-summary").textContent = lines.join("\n");
}

function updatePage() {
  updateCards();
  updateDetails();
  updateCount();
  updateSummary();
}

// ===== START =====

renderStepCards();
renderStepDetails();
setupClientPicker();
selectStep(0); // show step 1 to start
