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
const PORT = 9400 + Math.floor(Math.random() * 500); // any free-ish port

// A made-up saved client, in the same shape the Toolbox's Clients page saves
const TEST_CLIENT = {
  id: "t1",
  name: "Test Client (fictional)",
  biz: "Test Tacos LLC",
  facts: { llc: "yes", ein: "yes", tpt: "na", website: "testtacos.example" },
};

// ===== HELPERS =====

let chrome;          // the Chrome process
let socket;          // connection to the page
let profileDir;      // throwaway Chrome profile, deleted at the end
let nextId = 0;
const waiting = {};  // replies we're waiting for, by message id
const dialogs = [];  // pop-ups the page opened (confirm, "Leave site?")
let dialogAnswer = true; // true = click OK / Leave, false = Cancel / Stay

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
  await inPage(`localStorage.setItem("sbdc-clients", ${JSON.stringify(JSON.stringify({ v: 1, list: [TEST_CLIENT] }))})`);
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
  for (let tries = 0; tries < 40 && !tab; tries++) {
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
      send("Page.handleJavaScriptDialog", { accept: dialogAnswer });
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
  assert.equal(await text("#progress-count"), "0 of 10 done");
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
  assert.equal(await text("#progress-count"), "1 of 10 done");
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
