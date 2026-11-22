// Intake_assistant_fields.js
// THE DATA CONTRACT for the Intake Assistant page.
// Everything another developer needs to connect the page to client data is
// in this one file: the 10 steps, their questions and answers, what each
// answer is called on a saved client, where saved clients are read from,
// and the forms list. The page (Intake_assistant_app.js) reads it all from here.
//
// Load it BEFORE Intake_assistant_app.js (see the <script> tags in
// pages/Intake_assistant_index.html). Plain data only: no page code.
// Read docs/intake-assistant-data.md for which parts are confirmed and
// which are guesses. Check after changing: node --test tests/intake-assistant-fields.test.js

// ===== 1. THE STEPS =====

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
//   `expires` (dates only): once the date has passed, the step isn't done.

// Sole proprietorships and general partnerships don't file with the ACC,
// so steps 4, 5 and 6 can be answered with this.
const NO_ACC = "Not needed (no ACC filing)";

// Step 3 answers that mean "no ACC filing". Picking one fills steps 4 and 6
// with NO_ACC (step 5 is left alone: they may still want a trade name).
const NO_ACC_TYPES = ["Sole proprietorship (no ACC filing)", "General partnership (no ACC filing)"];
const NO_ACC_STEPS = [4, 6];

// The ACC says steps 7 to 10 can wait until the filing (step 6) is
// approved. Those steps show WAIT_NOTE until step 6 is done.
const ACC_FILING_STEP = 6;
const AFTER_APPROVAL_STEPS = [7, 8, 9, 10];
const WAIT_NOTE = "This step can wait until the ACC approves the filing in step 6.";

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
      options: ["Available", "Taken, pick another name", NO_ACC],
      done: ["Available", NO_ACC], // a taken name means they still need a new one
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
      options: ["Reserved the name", "Registered a trade name", "Formed the entity", NO_ACC],
      done: ["Reserved the name", "Registered a trade name", "Formed the entity", NO_ACC],
    },
    // expires: once this date has passed, the step turns red again
    more: { label: "Reservation ends", type: "date", showWhen: ["Reserved the name"], expires: true },
  },
  {
    title: "File with the Arizona Corporation Commission Corporations Division",
    short: "File with ACC",
    todo: "Submit Articles of Organization (LLC) or Articles of Incorporation (corporation), online if possible. The ACC sends an approval letter, or a letter explaining what to fix.",
    url: "https://arizonabusinesscenter.azcc.gov/",
    linkText: "Arizona Business Center (ACC online filing)",
    question: {
      label: "Filed with the ACC?",
      options: ["Not yet", "Submitted, waiting", "Rejected, fix and resubmit", "Approved", NO_ACC],
      done: ["Approved", NO_ACC],
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
    // One box for every city: several are separated with ";"
    more: {
      label: "City and license number (separate several with ;)",
      placeholder: "e.g. Tempe #12345; Mesa #67890",
      showWhen: ["Yes"],
    },
  },
  {
    title: "Federal EIN or TIN - Internal Revenue Service",
    short: "Federal EIN / TIN",
    todo: "Apply for an Employer Identification Number (EIN) from the IRS. It's free.",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number",
    linkText: "IRS: get an EIN",
    question: {
      label: "Have an EIN?",
      // Some sole proprietors with no employees use their Social Security number
      options: ["Yes", "Not yet", "Not needed (uses SSN)"],
      done: ["Yes", "Not needed (uses SSN)"],
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

// ===== 2. SAVED CLIENTS: where they're read from, what answers are called =====
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

// What each step's answers are called on a saved client (in client.facts).
// ASSUMED names: nothing else on the site uses them yet.
// See docs/intake-assistant-data.md before changing them.
// `answer`: the menu answer, stored as its exact text (e.g. "Approved").
// `detail`: the follow-up box. Step 9 has none: the EIN itself isn't saved.
// These win over the older AUTOFILL facts above.
const STEP_FACTS = {
  2: { answer: "domain", detail: "website" },
  3: { answer: "entityType" },
  4: { answer: "nameCheck" },
  5: { answer: "secureOrForm", detail: "reservationEnds" },
  6: { answer: "accFiling", detail: "entityId" },
  7: { answer: "tptLicense", detail: "tptNumber" },
  8: { answer: "cityLicense", detail: "cityLicenseNumbers" },
  9: { answer: "einStatus" },
  10: { answer: "bankAccount", detail: "bank" },
};

// ===== 3. FORMS TO GIVE TO THE CLIENT (left sidebar) =====
// Blank forms only (never client data). For now: the printable pages that
// already come with the site. Later: load the list from a Google Drive
// folder of blank forms instead (not built yet).
// `url` is from the Intake Assistant page, which lives in pages/.
const FORMS = [
  { name: "Business Model Canvas", url: "bmc.html" },
  { name: "Loan document checklist", url: "loan-checklist.html" },
  { name: "Assets and equipment list", url: "assets-worksheet.html" },
];

// ===== 4. "REPORT BUG" / "SUGGEST NEW FEATURE" (left sidebar) =====
// Where reports go. The page has no server, so it can only hand the
// text to something else:
// `email`: who gets reports. Fill this in to show the "Email it" button
//   (it opens the advisor's own email app with the report filled in).
// `githubRepo`: "owner/name". Shows "Open GitHub issue", which works for
//   people with access to the repo (it's private). "" hides the button.
const FEEDBACK = {
  email: "",
  githubRepo: "bliglesias/MergedDashboards",
};
