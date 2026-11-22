// Checks the Intake Assistant's data contract (js/Intake_assistant_fields.js)
// is consistent: every answer it refers to exists, every name is unique,
// every form file exists. No browser needed: it just reads the data file.
//
// Run:  node --test tests/intake-assistant-fields.test.js
// Run this after changing any step, answer, field name or form.

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Load the data file in a sandbox and pull out its constants
const file = path.join(__dirname, "..", "js", "Intake_assistant_fields.js");
const code = fs.readFileSync(file, "utf8");
const data = vm.runInNewContext(code + `
  ({ steps, STEP_FACTS, AUTOFILL, FORMS, CLIENTS_KEY, NO_ACC, NO_ACC_TYPES,
     NO_ACC_STEPS, ACC_FILING_STEP, AFTER_APPROVAL_STEPS })`);

const stepNumbers = data.steps.map((step, index) => index + 1);
const optionsOf = (stepNumber) => data.steps[stepNumber - 1].question?.options || [];

test("there are 10 steps, each with a title, label, note and link", () => {
  assert.equal(data.steps.length, 10);
  for (const step of data.steps) {
    assert.ok(step.title && step.short && step.todo, `step "${step.title}" is missing text`);
    assert.match(step.url, /^https:\/\//, `step "${step.title}" needs an https link`);
  }
});

test("every 'done' answer is one of the step's menu options", () => {
  for (const step of data.steps) {
    if (!step.question) continue;
    for (const answer of step.question.done) {
      assert.ok(step.question.options.includes(answer), `"${answer}" in done but not in options (${step.short})`);
    }
  }
});

test("every follow-up box appears for real menu options", () => {
  for (const step of data.steps) {
    if (!step.more || !step.question) continue;
    for (const answer of step.more.showWhen) {
      assert.ok(step.question.options.includes(answer), `"${answer}" in showWhen but not in options (${step.short})`);
    }
  }
});

test("saved-client names (STEP_FACTS) point at real steps and are all different", () => {
  const seen = new Set();
  for (const [stepNumber, names] of Object.entries(data.STEP_FACTS)) {
    const step = data.steps[stepNumber - 1];
    assert.ok(step, `STEP_FACTS has step ${stepNumber}, which doesn't exist`);
    assert.ok(step.question, `step ${stepNumber} has no menu for "${names.answer}" to fill`);
    if (names.detail) {
      assert.ok(step.more, `step ${stepNumber} has no follow-up box for "${names.detail}" to fill`);
    }
    for (const name of [names.answer, names.detail].filter(Boolean)) {
      assert.ok(!seen.has(name), `"${name}" is used twice`);
      seen.add(name);
    }
  }
});

test("older saved answers (AUTOFILL) only pick real menu options", () => {
  for (const rule of data.AUTOFILL) {
    for (const answer of Object.values(rule.map)) {
      assert.ok(optionsOf(rule.step).includes(answer), `"${answer}" isn't an option on step ${rule.step}`);
    }
  }
});

test("'no ACC filing' answers and step numbers line up", () => {
  for (const type of data.NO_ACC_TYPES) {
    assert.ok(optionsOf(3).includes(type), `"${type}" isn't an entity type option`);
  }
  for (const stepNumber of data.NO_ACC_STEPS) {
    assert.ok(optionsOf(stepNumber).includes(data.NO_ACC), `step ${stepNumber} is missing "${data.NO_ACC}"`);
  }
  assert.ok(stepNumbers.includes(data.ACC_FILING_STEP));
  for (const stepNumber of data.AFTER_APPROVAL_STEPS) {
    assert.ok(stepNumbers.includes(stepNumber), `step ${stepNumber} doesn't exist`);
  }
});

test("every form in the sidebar list is a real file", () => {
  assert.ok(data.FORMS.length > 0);
  for (const form of data.FORMS) {
    const formFile = path.join(__dirname, "..", "pages", form.url);
    assert.ok(fs.existsSync(formFile), `"${form.name}" points to ${form.url}, which doesn't exist`);
  }
});

test("saved clients are read from the same place the Toolbox saves them", () => {
  const clientsCode = fs.readFileSync(path.join(__dirname, "..", "js", "clients.js"), "utf8");
  assert.match(clientsCode, new RegExp(`const KEY = '${data.CLIENTS_KEY}'`), "clients.js saves under a different name");
});
