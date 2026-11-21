// Intake_assistant_app.js
// The 10 steps to start a business in Arizona.
// - Top: one card per step (the progress map). Clicking a card opens
//   that step's drop-down in the middle box.
// - Middle: one drop-down per step with what to do, a link to the
//   official page, and a "Mark this step done" checkbox.
// - Right: a plain-text progress summary.
// Nothing is saved: progress lives in `session` and clears on refresh.

// ===== DATA =====

// One object per step, in order.
// `title`: full name (drop-down). `short`: card label.
// `todo`: what the client does. `url` / `linkText`: the official page.
const steps = [
  {
    title: "Choose A Name",
    short: "Choose a name",
    todo: "Pick a name that fits the business and isn't already used by another Arizona business.",
    url: "https://www.sba.gov/counseling/launch-your-business/#business-name",
    linkText: "SBA: choose your business name",
  },
  {
    title: "Purchase A Domain Name or See Numbers 3, 4, and 5 Below",
    short: "Domain name",
    todo: "Check whether the matching website address (domain) is free. If it is, it can be bought from any domain seller. Optional: steps 3, 4 and 5 come first if the client prefers.",
    url: "https://lookup.icann.org/en",
    linkText: "ICANN: look up a domain",
  },
  {
    title: "Choose An Entity Type",
    short: "Entity type",
    todo: "Decide on a sole proprietorship, partnership, LLC or corporation. The choice affects taxes, personal liability and paperwork.",
    url: "https://www.sba.gov/counseling/launch-your-business/#business-structure",
    linkText: "SBA: choose a business structure",
  },
  {
    title: "Check Name Availability With the Arizona Corporation Commission",
    short: "Name availability",
    todo: "Search the Arizona Corporation Commission (ACC) records to see if the name is already taken in Arizona.",
    url: "https://arizonabusinesscenter.azcc.gov/EntitySearch/Index",
    linkText: "ACC: entity search",
  },
  {
    title: "Secure the Name or Form the Entity - You Choose",
    short: "Secure or form",
    todo: "Either reserve the name (held for 120 days) or go straight to forming the entity.",
    url: "https://arizonabusinesscenter.azcc.gov/",
    linkText: "Arizona Business Center (ACC online filing)",
  },
  {
    title: "File with the Arizona Corporation Commission Corporations Division",
    short: "File with ACC",
    todo: "File the formation papers: Articles of Organization for an LLC, or Articles of Incorporation for a corporation.",
    url: "https://azcc.gov/corporations",
    linkText: "ACC: Corporations Division",
  },
  {
    title: "Arizona Department of Revenue",
    short: "AZ Dept. of Revenue",
    todo: "Apply for a transaction privilege tax (TPT) license if the business sells goods or taxable services.",
    url: "https://azdor.gov/business/transaction-privilege-tax",
    linkText: "ADOR: transaction privilege tax",
  },
  {
    title: "City or County Taxes and Business Licensing",
    short: "Local taxes & license",
    todo: "Arizona has no general state business license, but many cities and towns do. Check with each city or town where the business operates.",
    url: "https://www.azcommerce.com/small-business/quick-links/business-licensing",
    linkText: "Arizona Commerce Authority: business licensing",
  },
  {
    title: "Federal EIN or TIN - Internal Revenue Service",
    short: "Federal EIN / TIN",
    todo: "Apply for an Employer Identification Number (EIN) from the IRS. It's free.",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number",
    linkText: "IRS: get an EIN",
  },
  {
    title: "Business Bank Account",
    short: "Bank account",
    todo: "Open a bank account just for the business, kept separate from personal money.",
    url: "https://www.sba.gov/counseling/launch-your-business/#bank-account",
    linkText: "SBA: open a business bank account",
  },
];

// Shared state, kept in memory only (clears on refresh, nothing is saved).
const session = {
  selected: 0,                       // which step is open in the middle box
  done: steps.map(function () {      // one true/false per step
    return false;
  }),
};

// ===== HELPERS =====

// The "now" step is the first one that isn't done.
// Returns -1 when every step is done.
function currentStep() {
  return session.done.indexOf(false);
}

// How many steps are ticked
function doneCount() {
  return session.done.filter(function (isDone) {
    return isDone;
  }).length;
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

      // Bring the open drop-down into view (helps on small screens)
      const details = document.querySelectorAll(".step-detail")[index];
      details.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });

    list.appendChild(copy);
  });
}

// Make one drop-down per step from the drop-down template.
function renderStepDetails() {
  const list = document.querySelector("#step-list");
  const template = document.querySelector("#step-detail-template");

  steps.forEach(function (step, index) {
    const copy = template.content.cloneNode(true);
    const details = copy.querySelector(".step-detail");
    const checkbox = copy.querySelector(".step-done input");

    copy.querySelector(".step-summary-title").textContent =
      index + 1 + ". " + step.title;
    copy.querySelector(".step-todo").textContent = step.todo;

    const link = copy.querySelector(".step-open");
    link.href = step.url;
    link.textContent = "Open " + step.linkText;

    // Ticking the box marks the step done (or not done) everywhere
    checkbox.addEventListener("change", function () {
      session.done[index] = checkbox.checked;
      updatePage();
    });

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

// ===== UPDATE THE PAGE (runs after every click) =====

// Called when a step card is clicked: open that step in the middle box.
function selectStep(index) {
  session.selected = index;

  const allDetails = document.querySelectorAll(".step-detail");
  allDetails.forEach(function (details, i) {
    details.open = i === index;
  });

  updatePage();
}

// Set each card's look: done / now / not started, and which is selected.
function updateCards() {
  const now = currentStep();
  const cards = document.querySelectorAll(".step-card");

  cards.forEach(function (card, index) {
    const isDone = session.done[index];
    const isNow = index === now;
    const isActive = index === session.selected;

    card.classList.toggle("done", isDone);
    card.classList.toggle("now", isNow);
    card.classList.toggle("active", isActive);
    card.setAttribute("aria-pressed", isActive);

    let status = "Not started";
    if (isDone) {
      status = "Done";
    } else if (isNow) {
      status = "Now";
    }
    card.querySelector(".step-status").textContent = status;
  });
}

// Show "Done" / "Now" next to each drop-down's title.
function updateDetails() {
  const now = currentStep();
  const allDetails = document.querySelectorAll(".step-detail");

  allDetails.forEach(function (details, index) {
    const status = details.querySelector(".step-summary-status");
    details.classList.toggle("done", session.done[index]);

    if (session.done[index]) {
      status.textContent = "Done";
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

// Plain-text summary in the output panel
function updateSummary() {
  const now = currentStep();
  const lines = [];

  lines.push("Business startup progress: " + doneCount() + " of " + steps.length + " done");
  lines.push("");

  steps.forEach(function (step, index) {
    const mark = session.done[index] ? "[x]" : "[ ]";
    lines.push(mark + " " + (index + 1) + ". " + step.short);
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
selectStep(0); // open step 1 to start
