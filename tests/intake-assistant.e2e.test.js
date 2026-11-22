// Browser tests for the Intake Assistant page (pages/Intake_assistant_index.html).
// Opens the real page in Google Chrome (hidden, no window), clicks and types
// like a person would, and checks what happens. Made-up data only.
//
// Run:  node --test tests/intake-assistant.e2e.test.js
// Needs: Node 22 or newer and Google Chrome. Nothing to install.
//
// How it works: Chrome is started with "remote debugging" turned on, which
// lets this file send it commands (open a page, click, type, run a line of
// JavaScript in the page) over a WebSocket. The helpers below wrap that up.

const test = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PAGE = "file://" + path.join(__dirname, "..", "pages", "Intake_assistant_index.html");
const NO_ACC_TEXT = "Not needed (no ACC filing)";
const PORT = 9400 + Math.floor(Math.random() * 500); // any free-ish port

// A made-up saved client, in the same shape the Toolbox's Clients page saves
const TEST_CLIENT = {
  id: "t1",
  name: "Test Client (fictional)",
  biz: "Test Tacos LLC",
  facts: { llc: "yes", ein: "yes", tpt: "na", website: "testtacos.example" },
};

// A made-up client saved with this page's own fact names
// (docs/intake-assistant-data.md). Has the older llc fact too, to check
// the newer accFiling answer wins.
const NEW_FACTS_CLIENT = {
  id: "t2",
  name: "Second Test Client (fictional)",
  biz: "Test Bikes LLC",
  facts: {
    llc: "yes",
    entityType: "LLC",
    accFiling: "Submitted, waiting",
    tptLicense: "Yes",
    tptNumber: "TPT-123",
    bankAccount: "Not a real answer", // not a menu option: must be ignored
  },
};

// ===== HELPERS =====

let chrome;          // the Chrome process
let socket;          // connection to the page
let profileDir;      // throwaway Chrome profile, deleted at the end
let nextId = 0;
const waiting = {};  // replies we're waiting for, by message id
const dialogs = [];  // pop-ups the page opened (confirm, "Leave site?")
let dialogAnswer = true; // true = click OK / Leave, false = Cancel / Stay
let promptText = "";     // what to type into a prompt() box

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Send one command to Chrome and wait for its reply
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    waiting[id] = resolve;
    socket.send(JSON.stringify({ id, method, params }));
  });
}

// Run JavaScript inside the page and get the result back
async function inPage(code) {
  const reply = await send("Runtime.evaluate", { expression: code, returnByValue: true, awaitPromise: true });
  return reply.result.result.value;
}

// Click the middle of an element, like a real mouse click
async function click(selector) {
  await inPage(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: "center" })`);
  const [x, y] = await inPage(`(() => {
    const box = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return [box.x + box.width / 2, box.y + box.height / 2];
  })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}

// Type text into whatever has the cursor, one key at a time
async function type(text) {
  for (const character of text) {
    await send("Input.dispatchKeyEvent", { type: "keyDown", text: character });
    await send("Input.dispatchKeyEvent", { type: "keyUp" });
  }
}

async function pressEnter() {
  const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 };
  await send("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", ...key });
  await send("Input.dispatchKeyEvent", { type: "keyUp", ...key });
}

// Pick an answer in a menu (a <select>), the same way a person's pick would
async function pick(selector, answer) {
  await inPage(`(() => {
    const menu = document.querySelector(${JSON.stringify(selector)});
    menu.value = ${JSON.stringify(answer)};
    menu.dispatchEvent(new Event("input", { bubbles: true }));
    menu.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
}

// The color/state of card N (1 to 10): "done", "flagged", or "" (white)
async function cardState(number) {
  return inPage(`(() => {
    const card = document.querySelectorAll(".step-card")[${number - 1}];
    if (card.classList.contains("done")) return "done";
    if (card.classList.contains("flagged")) return "flagged";
    return "";
  })()`);
}

const text = (selector) => inPage(`document.querySelector(${JSON.stringify(selector)}).textContent`);
const value = (selector) => inPage(`document.querySelector(${JSON.stringify(selector)}).value`);

// Start fresh: empty profile with one saved client, then open the page
async function openFreshPage() {
  dialogAnswer = true;
  await send("Page.navigate", { url: "about:blank" });
  await pause(300);
  await send("Page.navigate", { url: PAGE });
  await pause(300);
  await inPage(`localStorage.setItem("sbdc-clients", ${JSON.stringify(JSON.stringify({ v: 1, list: [TEST_CLIENT, NEW_FACTS_CLIENT] }))})`);
  await send("Page.reload");
  await pause(800);
  dialogs.length = 0;
}

// ===== START AND STOP CHROME =====

test.before(async () => {
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "intake-test-"));
  chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--window-size=1400,1400",
    "--remote-debugging-port=" + PORT, "--user-data-dir=" + profileDir, "about:blank",
  ], { stdio: "ignore" });

  // Wait for Chrome to be ready, then connect to its tab
  let tab;
  for (let tries = 0; tries < 120 && !tab; tries++) { // up to 30 seconds
    await pause(250);
    try {
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      tab = tabs.find((t) => t.type === "page");
    } catch (error) {
      // not ready yet
    }
  }
  assert.ok(tab, "Chrome didn't start. Is Google Chrome installed?");

  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => (socket.onopen = resolve));
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    // A pop-up opened: note it and answer it
    if (message.method === "Page.javascriptDialogOpening") {
      dialogs.push(message.params.type);
      send("Page.handleJavaScriptDialog", { accept: dialogAnswer, promptText });
    }
    if (waiting[message.id]) {
      waiting[message.id](message);
      delete waiting[message.id];
    }
  };
  await send("Page.enable");
});

test.after(async () => {
  socket?.close();
  // Close Chrome and wait until it has fully quit before deleting its
  // throwaway profile (it keeps writing files while closing)
  const closed = new Promise((resolve) => chrome.once("exit", resolve));
  chrome?.kill();
  await closed;
  fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5 });
});

// ===== THE TESTS =====

test("page shows 10 step cards and only step 1 in the middle box", async () => {
  await openFreshPage();
  assert.equal(await inPage(`document.querySelectorAll(".step-card").length`), 10);
  const shown = await inPage(`[...document.querySelectorAll(".step-detail")].filter((d) => !d.hidden).length`);
  assert.equal(shown, 1, "only one step should show at a time");
  assert.equal(await text("#summary-card-count"), "0 of 10 done");
});

test("clicking a card shows that step instead", async () => {
  await openFreshPage();
  await click("#step-grid li:first-child .step-card"); // make sure clicks work at all
  await inPage(`document.querySelectorAll(".step-card")[5].click()`);
  const shownTitle = await inPage(`[...document.querySelectorAll(".step-detail")].find((d) => !d.hidden).querySelector(".step-summary-title").textContent`);
  assert.match(shownTitle, /^6\. File with the Arizona Corporation Commission/);
});

test("typing a business name turns step 1 green and fills the summary", async () => {
  await openFreshPage();
  await click("#more-1");
  await type("Sunny Day Tacos");
  assert.equal(await cardState(1), "done");
  assert.equal(await text("#summary-card-count"), "1 of 10 done");
  assert.match(await text("#progress-summary"), /Choose a name: Sunny Day Tacos/);
});

test("pressing Enter moves to the next step", async () => {
  await openFreshPage();
  await click("#more-1");
  await type("Sunny Day Tacos");
  await pressEnter();
  assert.equal(await inPage(`document.activeElement.id`), "question-2");
});

test("step 6: 'Submitted, waiting' is red, 'Approved' is green and asks for the Entity ID", async () => {
  await openFreshPage();
  await click("#step-grid li:nth-child(6) .step-card"); // open step 6, like a person would
  await pick("#question-6", "Submitted, waiting");
  assert.equal(await cardState(6), "flagged");
  assert.equal(await inPage(`document.querySelector("#more-6").closest(".step-more").hidden`), true, "no Entity ID box yet");

  await pick("#question-6", "Approved");
  assert.equal(await cardState(6), "done");
  assert.equal(await inPage(`document.querySelector("#more-6").closest(".step-more").hidden`), false, "Entity ID box should show");

  await click("#more-6");
  await type("23673486");
  assert.equal(await inPage(`document.querySelectorAll(".step-value")[5].textContent`), "Approved · 23673486");
});

test("'Later', 'Taken' and 'Not sure' are red; 'Not needed' is green", async () => {
  await openFreshPage();
  await pick("#question-2", "Later");
  await pick("#question-4", "Taken, pick another name");
  await pick("#question-7", "Not sure");
  await pick("#question-8", "Not needed");
  assert.equal(await cardState(2), "flagged");
  assert.equal(await cardState(4), "flagged");
  assert.equal(await cardState(7), "flagged");
  assert.equal(await cardState(8), "done");
  assert.match(await text("#progress-summary"), /Domain name: Later \(not confirmed\)/);
});

test("picking a saved client fills the steps their record covers", async () => {
  await openFreshPage();
  await pick("#client-pick", "0");
  assert.equal(await value("#more-1"), "Test Tacos LLC");
  assert.equal(await value("#question-6"), "Approved");    // llc: yes
  assert.equal(await value("#question-7"), "Not needed");  // tpt: na
  assert.equal(await value("#question-9"), "Yes");         // ein: yes
  assert.equal(await cardState(2), "done");                // has a website
});

test("switching clients asks first, and Cancel keeps what was typed", async () => {
  await openFreshPage();
  await click("#more-1");
  await type("Sunny Day Tacos");
  dialogAnswer = false; // click Cancel
  await pick("#client-pick", "0");
  assert.deepEqual(dialogs, ["confirm"], "should ask before clearing");
  assert.equal(await value("#more-1"), "Sunny Day Tacos", "Cancel keeps the typing");
  assert.equal(await value("#client-pick"), "", "menu goes back to no client");
});

test("leaving the page warns only when something was entered", async () => {
  await openFreshPage();
  await click("#step-grid li:first-child .step-card"); // the browser only warns after a click or key press
  await inPage(`setTimeout(() => location.reload(), 0)`);
  await pause(800);
  assert.deepEqual(dialogs, [], "empty page: no warning");

  await click("#more-1");
  await type("Sunny Day Tacos");
  dialogAnswer = false; // click "Stay"
  await inPage(`setTimeout(() => location.reload(), 0)`);
  await pause(800);
  assert.deepEqual(dialogs, ["beforeunload"], "should show the Leave site? box");
  assert.equal(await value("#more-1"), "Sunny Day Tacos", "Stay keeps the typing");
});

// ----- Steps that don't fit every client -----

test("a sole proprietorship marks steps 4 and 6 'Not needed', and LLC clears them", async () => {
  await openFreshPage();
  await pick("#question-3", "Sole proprietorship (no ACC filing)");
  assert.equal(await value("#question-4"), "Not needed (no ACC filing)");
  assert.equal(await value("#question-6"), "Not needed (no ACC filing)");
  assert.equal(await cardState(4), "done");
  assert.equal(await cardState(6), "done");
  assert.equal(await value("#question-5"), "", "step 5 is left for them to choose");

  await pick("#question-3", "LLC");
  assert.equal(await value("#question-4"), "", "switching to LLC clears the automatic answer");
  assert.equal(await cardState(6), "");
});

test("step 6: 'Rejected' is red", async () => {
  await openFreshPage();
  await pick("#question-6", "Rejected, fix and resubmit");
  assert.equal(await cardState(6), "flagged");
});

test("step 9: 'Not needed (uses SSN)' is green", async () => {
  await openFreshPage();
  await pick("#question-9", "Not needed (uses SSN)");
  assert.equal(await cardState(9), "done");
});

test("step 5: a name reservation turns red once its end date has passed", async () => {
  await openFreshPage();
  await click("#step-grid li:nth-child(5) .step-card");
  await pick("#question-5", "Reserved the name");

  // A date 30 days from now: still green, and says how long is left
  await inPage(`(() => {
    const box = document.querySelector("#more-5");
    const d = new Date(); d.setDate(d.getDate() + 30);
    box.value = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    box.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  assert.equal(await cardState(5), "done");
  assert.match(await inPage(`document.querySelectorAll(".step-value")[4].textContent`), /\(30 days left\)/);

  // A date in the past: red, marked expired
  await inPage(`(() => {
    const box = document.querySelector("#more-5");
    box.value = "2020-01-01";
    box.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  assert.equal(await cardState(5), "flagged");
  assert.match(await text("#progress-summary"), /2020-01-01 \(expired\) \(not confirmed\)/);
});

// ----- Order of the steps -----

test("steps 7-10 say they can wait until the ACC filing is approved", async () => {
  await openFreshPage();
  const noteShown = (n) => inPage(`!document.querySelectorAll(".step-detail")[${n - 1}].querySelector(".step-note").hidden`);

  assert.equal(await noteShown(7), true, "step 6 not approved: note shows on step 7");
  assert.equal(await noteShown(10), true, "and on step 10");
  assert.equal(await noteShown(5), false, "never on steps 1-6");

  await pick("#question-6", "Approved");
  assert.equal(await noteShown(7), false, "approved: note goes away");

  await pick("#question-6", NO_ACC_TEXT);
  assert.equal(await noteShown(8), false, "no ACC filing needed: no note either");
});

// ----- Reading this page's own fact names from a saved client -----

test("a saved client's new fact names fill their steps (and win over older facts)", async () => {
  await openFreshPage();
  await pick("#client-pick", "1");
  assert.equal(await value("#question-3"), "LLC");
  assert.equal(await value("#question-6"), "Submitted, waiting", "accFiling wins over llc: yes");
  assert.equal(await value("#question-7"), "Yes");
  assert.equal(await value("#more-7"), "TPT-123");
  assert.equal(await value("#question-10"), "", "an answer that isn't a menu option is ignored");
});


// ----- Top right: Add new client (placeholder) and whose profile it is -----

test("top right shows an 'Add new client' button and the picked client's name", async () => {
  await openFreshPage();
  assert.equal(await text("#add-client"), "Add new client");
  assert.equal(await text("#current-client"), "No client picked");

  await pick("#client-pick", "0");
  assert.equal(await text("#current-client"), "Test Client (fictional)", "name only, no business");

  await pick("#client-pick", "");
  assert.equal(await text("#current-client"), "No client picked");
});

const dialogOpen = () => inPage(`document.querySelector("#new-client-dialog").open`);

test("'Add new client' opens a box; Add clears the steps and shows the name", async () => {
  await openFreshPage();
  await pick("#client-pick", "0"); // start with a saved client's answers
  assert.equal(await cardState(6), "done");

  await click("#add-client");
  assert.equal(await dialogOpen(), true, "the box opens");
  assert.equal(await inPage(`document.querySelector("#new-client-warning").hidden`), false, "warns: there's work to lose");
  assert.deepEqual(dialogs, [], "no browser pop-ups anymore");

  await click("#new-client-name");
  await type("Ana Ruiz");
  await pressEnter(); // Enter in the name box = Add
  await pause(200);
  assert.equal(await dialogOpen(), false, "the box closes");
  assert.equal(await text("#current-client"), "Ana Ruiz");
  assert.equal(await value("#client-pick"), "", "client menu goes back to 'Choose a client'");
  assert.equal(await cardState(6), "", "steps are cleared");
  assert.match(await text("#progress-summary"), /Client: Ana Ruiz/);
});

test("'Add new client': Cancel changes nothing, and an empty name can't be added", async () => {
  await openFreshPage();
  await pick("#client-pick", "0");

  await click("#add-client");
  await click("#new-client-name");
  await type("Ana Ruiz");
  await click("#new-client-cancel");
  await pause(200);
  assert.equal(await dialogOpen(), false);
  assert.equal(await text("#current-client"), "Test Client (fictional)", "Cancel keeps the old client");
  assert.equal(await cardState(6), "done", "nothing was cleared");

  await click("#add-client");
  await click("#new-client-dialog button[value=add]"); // Add with an empty name
  await pause(200);
  assert.equal(await dialogOpen(), true, "stays open: the name is required");
});

test("'Add new client' on an empty page: no warning in the box", async () => {
  await openFreshPage();
  await click("#add-client");
  assert.equal(await inPage(`document.querySelector("#new-client-warning").hidden`), true);
});

// ----- "In summary" card -----

test("the 'In summary' card shows the summary in the middle, and a step card brings the steps back", async () => {
  await openFreshPage();
  const hidden = (id) => inPage(`document.querySelector("#${id}").hidden`);
  assert.equal(await hidden("summary-panel"), true, "summary hidden at first");

  await pick("#question-9", "Yes");
  assert.equal(await text("#summary-card-count"), "1 of 10 done");

  await click("#summary-card");
  assert.equal(await hidden("summary-panel"), false, "summary shows");
  assert.equal(await hidden("steps-panel"), true, "steps hide");
  assert.equal(await inPage(`document.querySelector("#summary-card").classList.contains("active")`), true, "summary card is blue");
  assert.equal(await inPage(`document.querySelectorAll(".step-card.active").length`), 0, "no step card is blue");

  await click("#step-grid li:nth-child(3) .step-card");
  assert.equal(await hidden("summary-panel"), true, "summary hides again");
  assert.equal(await hidden("steps-panel"), false);
  assert.equal(await inPage(`document.querySelector("#summary-card").classList.contains("active")`), false);
});

// ----- Forms to give to the client (sidebar) -----

test("the sidebar lists the real forms, and ticked ones show in the summary", async () => {
  await openFreshPage();
  const names = await inPage(`[...document.querySelectorAll("#form-list .form-name")].map((n) => n.textContent)`);
  assert.deepEqual(names, ["Business Model Canvas", "Loan document checklist", "Assets and equipment list"]);
  assert.match(await inPage(`document.querySelector("#form-list .form-open").href`), /pages\/bmc\.html$/);
  assert.match(await text("#progress-summary"), /Forms given to client: none yet/);

  await click("#form-list .form-row:nth-child(2) input");
  assert.match(await text("#progress-summary"), /Forms given to client: Loan document checklist/);

  // Switching clients clears the ticks too
  dialogAnswer = true;
  await pick("#client-pick", "0");
  assert.equal(await inPage(`document.querySelectorAll("#form-list input:checked").length`), 0);
});

test("'Add file from computer' adds the file to the list (nothing uploaded)", async () => {
  await openFreshPage();
  // Make a small made-up file and hand it to the hidden file picker
  const tempFile = path.join(os.tmpdir(), "Blank test form.pdf");
  fs.writeFileSync(tempFile, "%PDF-1.4 made-up test file");
  const { root } = (await send("DOM.getDocument")).result;
  const { nodeId } = (await send("DOM.querySelector", { nodeId: root.nodeId, selector: "#form-file" })).result;
  await send("DOM.setFileInputFiles", { nodeId, files: [tempFile] });
  await pause(200);
  fs.rmSync(tempFile);

  const last = `document.querySelector("#form-list .form-row:last-child")`;
  assert.equal(await inPage(`${last}.querySelector(".form-name").textContent`), "Blank test form.pdf");
  assert.equal(await inPage(`${last}.querySelector(".form-source").textContent`), "your file");
  assert.match(await inPage(`${last}.querySelector(".form-open").href`), /^blob:/, "a temporary link in the browser, not an upload");
});

test("'Add Google Drive link' only takes Drive links, then adds them to the list", async () => {
  await openFreshPage();
  const driveOpen = () => inPage(`document.querySelector("#drive-dialog").open`);

  await click("#add-drive-link");
  assert.equal(await driveOpen(), true);
  await click("#drive-name");
  await type("Startup worksheet");
  await click("#drive-link");
  await type("https://example.com/form");
  await click("#drive-dialog button[value=add]");
  await pause(200);
  assert.equal(await driveOpen(), true, "not a Drive link: stays open");

  await inPage(`document.querySelector("#drive-link").value = ""`);
  await click("#drive-link");
  await type("https://drive.google.com/file/d/made-up-id/view");
  await click("#drive-dialog button[value=add]");
  await pause(200);
  assert.equal(await driveOpen(), false, "Drive link: added and closed");

  const last = `document.querySelector("#form-list .form-row:last-child")`;
  assert.equal(await inPage(`${last}.querySelector(".form-name").textContent`), "Startup worksheet");
  assert.equal(await inPage(`${last}.querySelector(".form-source").textContent`), "Google Drive");
  assert.equal(await inPage(`${last}.querySelector(".form-open").href`), "https://drive.google.com/file/d/made-up-id/view");
});

// ----- App-style layout (desktop) -----

test("desktop: the page never scrolls, and switching steps doesn't change its height", async () => {
  await openFreshPage();
  const pageHeight = () => inPage(`document.documentElement.scrollHeight`);
  const windowHeight = await inPage(`window.innerHeight`);
  assert.equal(await pageHeight(), windowHeight, "page is exactly the window's height");

  const heights = new Set();
  for (const n of [1, 5, 7, 10]) {
    await click(`#step-grid li:nth-child(${n}) .step-card`);
    heights.add(await pageHeight());
  }
  await click("#summary-card");
  heights.add(await pageHeight());
  assert.equal(heights.size, 1, "same height for every step and the summary");
  assert.equal(await inPage(`getComputedStyle(document.querySelector(".main")).overflowY`), "auto", "the middle column scrolls on its own");
});

test("added forms can be removed; the site's own forms can't", async () => {
  await openFreshPage();
  const removable = () => inPage(`[...document.querySelectorAll("#form-list .form-remove")].map((b) => !b.hidden)`);
  assert.deepEqual(await removable(), [false, false, false], "no Remove on the site's forms");

  await inPage(`session.forms.push({ name: "Added form", url: "https://drive.google.com/x", given: true, from: "drive" }); renderFormList(); updatePage();`);
  assert.deepEqual(await removable(), [false, false, false, true]);
  assert.match(await text("#progress-summary"), /Forms given to client: Added form/);

  await click("#form-list .form-row:last-child .form-remove");
  assert.equal(await inPage(`document.querySelectorAll("#form-list .form-row").length`), 3);
  assert.match(await text("#progress-summary"), /Forms given to client: none yet/, "gone from the summary too");
});

// ----- Report bug / Suggest new feature -----

test("'Report bug' and 'Suggest new feature' open the box with their own wording", async () => {
  await openFreshPage();
  const open = () => inPage(`document.querySelector("#feedback-dialog").open`);

  await click('.sidebar-actions [data-kind="bug"]');
  assert.equal(await open(), true);
  assert.equal(await text("#feedback-title"), "Report a bug");
  assert.equal(await inPage(`document.querySelector("#feedback-email").hidden`), true, "no email address set: no Email button");

  await click("#feedback-summary");
  await type("Card stays red");
  const link = await inPage(`document.querySelector("#feedback-github").href`);
  assert.match(link, /github\.com\/bliglesias\/MergedDashboards\/issues\/new\?title=Bug%3A%20Card%20stays%20red/);
  assert.match(link, /labels=bug/);
  await click("#feedback-cancel");
  assert.equal(await open(), false);

  await click('.sidebar-actions [data-kind="feature"]');
  assert.equal(await text("#feedback-title"), "Suggest a feature");
  assert.equal(await value("#feedback-summary"), "", "starts empty each time");
  await click("#feedback-cancel");
});

test("the GitHub link won't go anywhere without a summary", async () => {
  await openFreshPage();
  await click('.sidebar-actions [data-kind="bug"]');
  await click("#feedback-github");
  await pause(200);
  assert.equal(await text("#feedback-status"), "Add a short summary first.");
  assert.equal(await inPage(`document.querySelector("#feedback-dialog").open`), true);
});
