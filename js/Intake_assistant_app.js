// Intake_assistant_app.js
// The 10 steps to start a business in Arizona (from the ACC's
// "Ten Steps to Starting a Business in AZ" page).
// - Top: one card per step (the progress map). Clicking a card shows
//   that step in the middle box. A card shows the step's answer.
// - Middle: the selected step: what to do, a link to the official page,
//   a first question (a menu) and, for some answers, a follow-up box.
// - "In summary" card (top right): shows the summary in the middle box.
// Nothing is saved: everything lives in `session` and clears on refresh.

// ===== DATA =====
// The steps, answers, saved-client names and forms list are in
// Intake_assistant_fields.js (loaded first). This file is the page code.

// Shared state, kept in memory only (clears on refresh, nothing is saved).
// One entry per step, in the same order as `steps`.
const session = {
  selected: 0,                                     // step showing in the middle box
  answers: steps.map(function () { return ""; }),  // first-question answers
  details: steps.map(function () { return ""; }),  // follow-up box values
  client: null,                                    // saved client picked, or a new one
  menuChoice: "",                                  // last choice in the client menu
  showSummary: false,                              // true: middle box shows the summary
  // The forms list: the site's forms from FORMS, plus any files or Drive
  // links added on the page. `given`: ticked (given to the client).
  // `from`: "site", "computer" or "drive".
  forms: FORMS.map(function (form) {
    return { name: form.name, url: form.url, given: false, from: "site" };
  }),
};

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

// Days from today until a "YYYY-MM-DD" date (negative = already passed).
// Returns null for an empty or broken date.
function daysUntil(dateText) {
  const parts = dateText.split("-").map(Number); // "2026-03-05" -> [2026, 3, 5]
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  const date = new Date(parts[0], parts[1] - 1, parts[2]); // months count from 0
  const today = new Date();
  today.setHours(0, 0, 0, 0); // compare whole days, not times
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date - today) / oneDay);
}

// Has this step's follow-up date (e.g. the name reservation) passed?
function isExpired(index) {
  const more = steps[index].more;
  if (!more || !more.expires || !showsMore(index)) {
    return false;
  }
  const days = daysUntil(session.details[index]);
  return days !== null && days < 0;
}

// A step is done when its first answer is a "done" answer
// (and its date, if it has one that expires, hasn't passed).
// Steps with only a box (step 1) are done once something is typed.
function isDone(index) {
  const step = steps[index];
  if (step.question) {
    return step.question.done.includes(session.answers[index]) && !isExpired(index);
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
    let detail = session.details[index];

    // Dates that expire also say how long is left
    if (steps[index].more.expires) {
      const days = daysUntil(detail);
      if (days !== null && days < 0) {
        detail += " (expired)";
      } else if (days !== null) {
        detail += " (" + days + " days left)";
      }
    }
    parts.push(detail);
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

// Has anything been entered? (any answer picked or anything typed)
// Used to warn before the page or the client is changed.
function hasWork() {
  const anyAnswer = session.answers.some(function (answer) {
    return answer !== "";
  });
  const anyDetail = session.details.some(function (detail) {
    return detail !== "";
  });
  const anyForm = session.forms.some(function (form) {
    return form.given;
  });
  return anyAnswer || anyDetail || anyForm;
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
    copy.querySelector(".step-note").textContent = WAIT_NOTE; // shown only on steps 7-10

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

        // Step 3 (entity type) can fill or clear steps 4 and 6
        if (index === 2) {
          applyEntityType(menu.value);
        }
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

// Sole proprietorships and partnerships don't file with the ACC.
// Picking one of them answers steps 4 and 6 with "Not needed (no ACC
// filing)", but only if those steps are still blank. Switching back to
// an entity that files (e.g. LLC) clears those automatic answers.
function applyEntityType(entityType) {
  const noFiling = NO_ACC_TYPES.includes(entityType);

  NO_ACC_STEPS.forEach(function (stepNumber) {
    const index = stepNumber - 1;
    const menu = document.querySelector("#question-" + stepNumber);

    if (noFiling && session.answers[index] === "") {
      session.answers[index] = NO_ACC;
    } else if (!noFiling && session.answers[index] === NO_ACC) {
      session.answers[index] = "";
    }
    menu.value = session.answers[index];
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

// ===== FORMS TO GIVE TO THE CLIENT =====

// Small label after an added form's name, so it's clear where it came from
const FORM_SOURCE_LABELS = { computer: "your file", drive: "Google Drive" };

// (Re)build the forms list from session.forms and the row template.
// Runs again whenever a form is added.
function renderFormList() {
  const list = document.querySelector("#form-list");
  const template = document.querySelector("#form-row-template");

  list.replaceChildren(); // start from an empty list

  session.forms.forEach(function (form) {
    const copy = template.content.cloneNode(true);
    const checkbox = copy.querySelector("input");

    copy.querySelector(".form-name").textContent = form.name;
    copy.querySelector(".form-source").textContent = FORM_SOURCE_LABELS[form.from] || "";
    copy.querySelector(".form-open").href = form.url;
    copy.querySelector(".form-open").setAttribute("aria-label", "Open " + form.name);
    checkbox.checked = form.given;

    // Ticked = given to the client. Shows up in the summary.
    checkbox.addEventListener("change", function () {
      form.given = checkbox.checked;
      updatePage();
    });

    // Remove: only for forms added on the page, not the site's own
    const removeButton = copy.querySelector(".form-remove");
    removeButton.hidden = form.from === "site";
    removeButton.setAttribute("aria-label", "Remove " + form.name);
    removeButton.addEventListener("click", function () {
      removeForm(form);
    });

    list.appendChild(copy);
  });
}

// Take an added form off the list.
function removeForm(form) {
  // A file from the computer has a temporary browser link: free it
  if (form.from === "computer") {
    URL.revokeObjectURL(form.url);
  }
  session.forms = session.forms.filter(function (other) {
    return other !== form;
  });
  renderFormList();
  updatePage();
}

// "Add file from computer": pick files; they're added to the list.
// The files stay in this browser tab: nothing is uploaded anywhere.
// URL.createObjectURL makes a temporary link to the file that works
// until the page is refreshed or closed.
function setupAddFormFile() {
  const fileInput = document.querySelector("#form-file");

  // The real file picker is hidden; the button opens it
  document.querySelector("#add-form-file").addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    for (const file of fileInput.files) {
      session.forms.push({
        name: file.name,
        url: URL.createObjectURL(file),
        given: false,
        from: "computer",
      });
    }
    fileInput.value = ""; // so the same file can be picked again later
    renderFormList();
    updatePage();
  });
}

// "Add Google Drive link": a dialog asks for a name and a Drive link.
// The page never talks to Google: opening the link takes the advisor to
// Google Drive, where they sign in themselves.
function setupAddDriveLink() {
  const dialog = document.querySelector("#drive-dialog");
  const nameBox = document.querySelector("#drive-name");
  const linkBox = document.querySelector("#drive-link");

  document.querySelector("#add-drive-link").addEventListener("click", function () {
    nameBox.value = "";
    linkBox.value = "";
    dialog.returnValue = ""; // forget how it was closed last time
    dialog.showModal();
  });

  document.querySelector("#drive-cancel").addEventListener("click", function () {
    dialog.close();
  });

  // The form checks the link looks like a Google Drive or Docs link
  // (the pattern on the input) before it lets "Add" close the dialog.
  dialog.addEventListener("close", function () {
    if (dialog.returnValue !== "add") {
      return;
    }
    session.forms.push({
      name: nameBox.value.trim(),
      url: linkBox.value.trim(),
      given: false,
      from: "drive",
    });
    renderFormList();
    updatePage();
  });
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
    // Switching clients clears everything: ask first if there's work
    if (hasWork()) {
      const ok = confirm("Switching clients clears what you've entered for every step. Continue?");
      if (!ok) {
        select.value = session.menuChoice; // put the menu back
        return;
      }
    }
    session.menuChoice = select.value;

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
  // Untick every form (added files and links stay in the list)
  session.forms.forEach(function (form) {
    form.given = false;
  });
  renderFormList();

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

    // Answers saved under this page's own fact names (see STEP_FACTS).
    // An answer is only used if it's one of the step's menu options,
    // so a typo in the record can't put a strange value in the menu.
    Object.keys(STEP_FACTS).forEach(function (stepNumber) {
      const index = stepNumber - 1;
      const names = STEP_FACTS[stepNumber];
      const savedAnswer = facts[names.answer];
      const savedDetail = names.detail ? facts[names.detail] : "";

      if (savedAnswer && steps[index].question.options.includes(savedAnswer)) {
        session.answers[index] = savedAnswer;
      }
      if (savedDetail) {
        session.details[index] = String(savedDetail).trim();
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
  session.showSummary = false; // a step takes the middle box back

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
    // While the summary is showing, no step card is selected
    const isActive = index === session.selected && !session.showSummary;

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

    // Steps 7-10: "can wait" note while the ACC filing isn't done yet
    const waitsForFiling = AFTER_APPROVAL_STEPS.includes(index + 1);
    const filingDone = isDone(ACC_FILING_STEP - 1);
    details.querySelector(".step-note").hidden = !waitsForFiling || filingDone;

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

  // Forms ticked in the sidebar
  const given = session.forms.filter(function (form) {
    return form.given;
  }).map(function (form) {
    return form.name;
  });
  lines.push("");
  lines.push("Forms given to client: " + (given.length > 0 ? given.join(", ") : "none yet"));

  lines.push("");
  if (now === -1) {
    lines.push("All steps done.");
  } else {
    lines.push("Next step: " + (now + 1) + ". " + steps[now].title);
    lines.push(steps[now].url);
  }

  document.querySelector("#progress-summary").textContent = lines.join("\n");
}

// Top right: whose profile this is (the client's name only)
function updateCurrentClient() {
  const spot = document.querySelector("#current-client");
  const name = session.client ? session.client.name : "";

  spot.textContent = name || "No client picked";
  spot.classList.toggle("empty", !name);
}

// Middle box: the steps panel or the summary panel, never both.
// Also the "In summary" card: blue while the summary is showing.
function updateSummaryCard() {
  const card = document.querySelector("#summary-card");
  const showing = session.showSummary;

  document.querySelector("#steps-panel").hidden = showing;
  document.querySelector("#summary-panel").hidden = !showing;

  card.classList.toggle("active", showing);
  card.setAttribute("aria-pressed", showing);
  document.querySelector("#summary-card-count").textContent =
    doneCount() + " of " + steps.length + " done";
}

function updatePage() {
  updateCards();
  updateDetails();
  updateSummary();
  updateSummaryCard();
  updateCurrentClient();
}

// ===== PROTECT THE WORK =====

// Refreshing, closing the tab or leaving the page wipes everything
// (nothing is saved). If something was entered, ask the browser to
// show its "Leave site?" box. The browser writes the message itself;
// pages can't change the wording or use alert() here.
function setupLeaveWarning() {
  window.addEventListener("beforeunload", function (event) {
    if (hasWork()) {
      event.preventDefault();
    }
  });
}

// "Add new client" button: opens the dialog box to type the client's
// name. "Add" clears every step and shows the name at the top right.
// The new client lives in memory only: nothing is saved.
function setupAddClientButton() {
  const button = document.querySelector("#add-client");
  const dialog = document.querySelector("#new-client-dialog");
  const nameBox = document.querySelector("#new-client-name");

  // Open the dialog, empty, with the warning only if there's work to lose
  button.addEventListener("click", function () {
    nameBox.value = "";
    document.querySelector("#new-client-warning").hidden = !hasWork();
    dialog.returnValue = ""; // forget how it was closed last time
    dialog.showModal();
  });

  // Cancel: close without adding
  document.querySelector("#new-client-cancel").addEventListener("click", function () {
    dialog.close();
  });

  // "close" fires however it closed: Add, Cancel or Esc.
  // Only "add" (the Add button's value) starts the new client.
  dialog.addEventListener("close", function () {
    const name = nameBox.value.trim();
    if (dialog.returnValue !== "add" || name === "") {
      return;
    }
    startNewClient(name);
  });
}

// Clear every step and start a client with this name.
function startNewClient(name) {
  fillFromClient(null); // clears every step
  session.client = { name: name };

  // The client menu goes back to "Choose a client"
  document.querySelector("#client-pick").value = "";
  session.menuChoice = "";
  document.querySelector("#client-pick-note").textContent =
    "New client: not saved anywhere. Refreshing the page clears it.";

  updatePage();
}

// "Copy summary" button: puts the summary text on the clipboard.
function setupCopyButton() {
  const button = document.querySelector("#copy-summary");

  button.addEventListener("click", async function () {
    const text = document.querySelector("#progress-summary").textContent;

    try {
      await navigator.clipboard.writeText(text);
      button.textContent = "Copied!";
    } catch (error) {
      // Some browsers block the clipboard; say so instead of failing quietly
      button.textContent = "Couldn't copy. Select the text instead.";
    }

    // Put the label back after 2 seconds
    setTimeout(function () {
      button.textContent = "Copy summary";
    }, 2000);
  });
}

// ===== REPORT BUG / SUGGEST NEW FEATURE =====

// The wording for each kind of feedback. `label` is the GitHub label.
const FEEDBACK_KINDS = {
  bug: {
    title: "Report a bug",
    detailsLabel: "What happened, and what did you expect?",
    prefix: "Bug",
    label: "bug",
  },
  feature: {
    title: "Suggest a feature",
    detailsLabel: "What should it do, and how would it help?",
    prefix: "Feature idea",
    label: "enhancement",
  },
};

// The report as a subject line and a body, from what's typed in the box.
// Only what the person typed: nothing from the page (no client data).
function buildReport(kind) {
  const summary = document.querySelector("#feedback-summary").value.trim();
  const details = document.querySelector("#feedback-details").value.trim();
  return {
    subject: FEEDBACK_KINDS[kind].prefix + ": " + summary,
    body: (details || "(no details)") + "\n\nPage: Intake Assistant",
  };
}

function setupFeedback() {
  const dialog = document.querySelector("#feedback-dialog");
  const summaryBox = document.querySelector("#feedback-summary");
  const detailsBox = document.querySelector("#feedback-details");
  const status = document.querySelector("#feedback-status");
  const emailLink = document.querySelector("#feedback-email");
  const githubLink = document.querySelector("#feedback-github");
  let kind = "bug"; // which button opened the box

  // Only show the ways to send that have an address in FEEDBACK
  emailLink.hidden = FEEDBACK.email === "";
  githubLink.hidden = FEEDBACK.githubRepo === "";

  // Keep the Email and GitHub links up to date with what's typed.
  // encodeURIComponent makes the text safe to put in a link.
  function updateLinks() {
    const report = buildReport(kind);
    emailLink.href = "mailto:" + FEEDBACK.email +
      "?subject=" + encodeURIComponent(report.subject) +
      "&body=" + encodeURIComponent(report.body);
    githubLink.href = "https://github.com/" + FEEDBACK.githubRepo + "/issues/new" +
      "?title=" + encodeURIComponent(report.subject) +
      "&body=" + encodeURIComponent(report.body) +
      "&labels=" + FEEDBACK_KINDS[kind].label;
  }

  // Both sidebar buttons open the same box, with their own wording
  document.querySelectorAll(".sidebar-actions [data-kind]").forEach(function (button) {
    button.addEventListener("click", function () {
      kind = button.dataset.kind;
      document.querySelector("#feedback-title").textContent = FEEDBACK_KINDS[kind].title;
      document.querySelector("#feedback-details-label").textContent = FEEDBACK_KINDS[kind].detailsLabel;
      summaryBox.value = "";
      detailsBox.value = "";
      status.textContent = "";
      updateLinks();
      dialog.showModal();
    });
  });

  summaryBox.addEventListener("input", updateLinks);
  detailsBox.addEventListener("input", updateLinks);

  // Email and GitHub need a summary first
  [emailLink, githubLink].forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (summaryBox.value.trim() === "") {
        event.preventDefault(); // don't follow the link
        status.textContent = "Add a short summary first.";
        summaryBox.focus();
      }
    });
  });

  document.querySelector("#feedback-copy").addEventListener("click", async function () {
    const report = buildReport(kind);
    try {
      await navigator.clipboard.writeText(report.subject + "\n\n" + report.body);
      status.textContent = "Copied. Paste it into an email or message.";
    } catch (error) {
      status.textContent = "Couldn't copy. Select the text and copy it instead.";
    }
  });

  document.querySelector("#feedback-cancel").addEventListener("click", function () {
    dialog.close();
  });
}

// ===== START =====

renderStepCards();
renderStepDetails();
renderFormList();
setupAddFormFile();
setupAddDriveLink();
setupFeedback();
setupClientPicker();
setupLeaveWarning();
setupCopyButton();
setupAddClientButton();

// "In summary" card: show the summary in the middle box
document.querySelector("#summary-card").addEventListener("click", function () {
  session.showSummary = true;
  updatePage();
});
selectStep(0); // show step 1 to start
