import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const grades = [
  "Preliminary",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8"
];

const bank = JSON.parse(readFileSync(resolve("src/data/rhythm-examples.json"), "utf8"));

if (bank.schemaVersion !== 1) {
  throw new Error(`Unexpected rhythm bank schema version: ${bank.schemaVersion}`);
}

if (!Array.isArray(bank.examples)) {
  throw new Error("Rhythm bank examples must be an array");
}

const seen = new Set();

for (const grade of grades) {
  const examples = bank.examples.filter((example) => example.grade === grade);
  if (examples.length !== 50) {
    throw new Error(`${grade} has ${examples.length} rhythm examples instead of 50`);
  }

  for (const example of examples) {
    const beatsPerBar = example.meter === "duple" ? 2 : example.meter === "triple" ? 3 : 0;
    if (!beatsPerBar) throw new Error(`${example.id} has invalid meter ${example.meter}`);

    const total = example.rhythm.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - beatsPerBar * example.bars) > 0.001) {
      throw new Error(`${example.id} totals ${total} beats, expected ${beatsPerBar * example.bars}`);
    }

    if (!example.rhythm.every((value) => typeof value === "number" && value > 0 && Number.isFinite(value))) {
      throw new Error(`${example.id} contains invalid rhythm values`);
    }

    const key = `${example.grade}:${example.meter}:${example.rhythm.join("-")}`;
    if (seen.has(key)) throw new Error(`Duplicate rhythm example: ${key}`);
    seen.add(key);

    if (example.answerMode === "choice") {
      const expected = example.meter === "duple" ? "Duple time" : "Triple time";
      if (example.correct !== expected) throw new Error(`${example.id} has incorrect meter answer`);
      if (!Array.isArray(example.options) || example.options.length < 4 || example.options.length > 6) {
        throw new Error(`${example.id} must have 4-6 options`);
      }
      if (!example.options.includes(example.correct)) {
        throw new Error(`${example.id} correct answer is missing from options`);
      }
      if (new Set(example.options).size !== example.options.length) {
        throw new Error(`${example.id} has duplicate answer options`);
      }
    } else if (example.answerMode === "rhythm") {
      if (example.correct !== "rhythm") throw new Error(`${example.id} has incorrect rhythm answer key`);
      if (example.options !== undefined) throw new Error(`${example.id} rhythm tap example should not have options`);
    } else {
      throw new Error(`${example.id} has unsupported answer mode ${example.answerMode}`);
    }
  }
}

console.log(`Validated ${bank.examples.length} rhythm examples`);
