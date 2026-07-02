import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

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

const meterOptions = ["Duple time", "Triple time", "Simple quadruple", "Free time"];

const templatePools = {
  early: {
    duple: [
      [1, 1],
      [2],
      [0.5, 0.5, 1],
      [1, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [1.5, 0.5],
      [0.5, 1.5]
    ],
    triple: [
      [1, 1, 1],
      [1, 2],
      [2, 1],
      [1, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 1],
      [1, 1, 0.5, 0.5],
      [1.5, 0.5, 1],
      [1, 1.5, 0.5]
    ]
  },
  middle: {
    duple: [
      [1, 1],
      [0.5, 0.5, 1],
      [1, 0.5, 0.5],
      [0.5, 1, 0.5],
      [0.5, 0.5, 0.5, 0.5],
      [1.5, 0.5],
      [0.5, 1.5],
      [0.75, 0.25, 1],
      [1, 0.75, 0.25],
      [0.25, 0.25, 0.5, 1],
      [0.5, 0.25, 0.25, 1]
    ],
    triple: [
      [1, 1, 1],
      [1, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 1],
      [1, 1, 0.5, 0.5],
      [1.5, 0.5, 1],
      [1, 1.5, 0.5],
      [0.75, 0.25, 1, 1],
      [1, 0.75, 0.25, 1],
      [1, 1, 0.75, 0.25],
      [0.5, 0.5, 0.5, 0.5, 1],
      [1, 0.5, 0.25, 0.25, 1]
    ]
  },
  advanced: {
    duple: [
      [0.5, 0.5, 1],
      [1, 0.5, 0.5],
      [0.25, 0.25, 0.5, 1],
      [0.5, 0.25, 0.25, 1],
      [0.75, 0.25, 1],
      [1, 0.75, 0.25],
      [0.25, 0.25, 0.25, 0.25, 1],
      [0.5, 0.5, 0.25, 0.25, 0.5],
      [1.5, 0.25, 0.25],
      [0.25, 0.25, 1.5],
      [0.75, 0.25, 0.5, 0.5],
      [0.5, 0.75, 0.25, 0.5]
    ],
    triple: [
      [1, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 1],
      [1, 1, 0.5, 0.5],
      [0.75, 0.25, 1, 1],
      [1, 0.75, 0.25, 1],
      [1, 1, 0.75, 0.25],
      [0.25, 0.25, 0.5, 1, 1],
      [1, 0.25, 0.25, 0.5, 1],
      [1, 1, 0.25, 0.25, 0.5],
      [1.5, 0.25, 0.25, 1],
      [1, 1.5, 0.25, 0.25],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]
    ]
  }
};

function difficultyFor(gradeIndex) {
  if (gradeIndex <= 2) return "early";
  if (gradeIndex <= 5) return "middle";
  return "advanced";
}

function answerModeFor(gradeIndex) {
  return gradeIndex >= 3 && gradeIndex <= 5 ? "choice" : "rhythm";
}

function titleFor(grade, count) {
  if (grade === "Preliminary") return `Beat Builder ${count}`;
  if (grade === "Grade 3" || grade === "Grade 4" || grade === "Grade 5") return `Meter Scout ${count}`;
  return `Rhythm Echo ${count}`;
}

function promptFor(answerMode) {
  if (answerMode === "choice") return "Listen to the rhythm and identify whether the meter is duple or triple.";
  return "Tap the rhythm after hearing the example.";
}

function buildRhythm(pool, meter, bars, seed) {
  const templates = pool[meter];
  const rhythm = [];
  let value = seed;
  for (let bar = 0; bar < bars; bar += 1) {
    const template = templates[value % templates.length];
    rhythm.push(...template);
    value = Math.floor(value / templates.length) + bar + 1;
  }
  return rhythm;
}

function totalBeats(rhythm) {
  return rhythm.reduce((sum, beat) => sum + beat, 0);
}

function makeExamplesForGrade(grade, gradeIndex) {
  const examples = [];
  const seen = new Set();
  const pool = templatePools[difficultyFor(gradeIndex)];
  const answerMode = answerModeFor(gradeIndex);
  let seed = 0;
  let attempts = 0;

  while (examples.length < 50) {
    attempts += 1;
    if (attempts > 5000) {
      throw new Error(`Could not generate 50 unique rhythm examples for ${grade}`);
    }

    const meter = seed % 2 === 0 ? "duple" : "triple";
    const beatsPerBar = meter === "duple" ? 2 : 3;
    const bars = gradeIndex <= 1 ? 2 + (seed % 2) : gradeIndex <= 5 ? 2 + (seed % 3) : 3 + (seed % 2);
    const rhythm = buildRhythm(pool, meter, bars, seed + gradeIndex * 11);
    const key = `${meter}:${rhythm.join("-")}`;
    seed += 1;

    if (seen.has(key)) continue;
    seen.add(key);

    const expectedBeats = beatsPerBar * bars;
    if (Math.abs(totalBeats(rhythm) - expectedBeats) > 0.001) {
      throw new Error(`Invalid total for ${grade}: ${key}`);
    }

    const number = examples.length + 1;
    examples.push({
      id: `${grade.toLowerCase().replaceAll(" ", "-")}-rhythm-${String(number).padStart(2, "0")}`,
      grade,
      title: titleFor(grade, number),
      prompt: promptFor(answerMode),
      answerMode,
      meter,
      beatsPerBar,
      bars,
      rhythm,
      options: answerMode === "choice" ? meterOptions : undefined,
      correct: answerMode === "choice" ? (meter === "duple" ? "Duple time" : "Triple time") : "rhythm"
    });
  }

  return examples;
}

const examples = grades.flatMap((grade, gradeIndex) => makeExamplesForGrade(grade, gradeIndex));
const allKeys = new Set(examples.map((example) => `${example.grade}:${example.meter}:${example.rhythm.join("-")}`));

if (allKeys.size !== examples.length) {
  throw new Error("Generated rhythm bank contains duplicate examples");
}

for (const grade of grades) {
  const count = examples.filter((example) => example.grade === grade).length;
  if (count !== 50) throw new Error(`${grade} generated ${count} examples instead of 50`);
}

const outPath = resolve("src/data/rhythm-examples.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      description: "Generated rhythm examples for Aural Arcade. Rhythm values are beat lengths.",
      examples
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${examples.length} rhythm examples to ${outPath}`);
