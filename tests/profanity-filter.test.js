#!/usr/bin/env node

/**
 * Sanity-check the shared profanity data and variation generator.
 *
 * Run with: `node tests/profanity-filter.test.js`
 * Fails (exit code 1) when the dataset cannot be parsed or when key
 * sentinel words/variations are missing from the generated hash input.
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "shared", "data", "badwords.json");
const SENTINEL_WORDS = ["suicide", "motherfucker", "bastard", "whore"];

function requireDataset() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 700) {
      throw new Error(`Unexpected dataset shape (length=${parsed?.length ?? "n/a"})`);
    }
    return parsed;
  } catch (err) {
    console.error("[profanity-test] Failed to load bad word dataset:", err);
    process.exit(1);
  }
}

const alternativeChars = {
  a: ["@", "4"],
  e: ["3"],
  i: ["1", "!"],
  o: ["0"],
  s: ["$", "5"],
  t: ["7"],
  c: ["<"]
};

function generateVariations(word) {
  const maxLength = 20;
  if (word.length > maxLength) return [word];

  let variations = [word];
  const maxVariations = 100;

  for (let i = 0; i < word.length && variations.length < maxVariations; i++) {
    const char = word[i].toLowerCase();
    if (Object.prototype.hasOwnProperty.call(alternativeChars, char)) {
      const charVariations = alternativeChars[char];
      const newVariations = [];
      const variationsToProcess = variations.slice(0, 10);

      for (const variation of variationsToProcess) {
        for (const altChar of charVariations) {
          if (newVariations.length + variations.length >= maxVariations) break;
          const newWord = variation.slice(0, i) + altChar + variation.slice(i + 1);
          newVariations.push(newWord);
        }
      }

      variations.push(...newVariations);
    }
  }

  return variations.slice(0, maxVariations).filter(entry => !/[A-Z]/.test(entry));
}

function generateVariationsList(words) {
  const maxWordList = 1500;
  const wordsTrimmed = words.slice(0, maxWordList);

  const variationsList = [];
  const maxTotalVariations = 20000;

  for (const word of wordsTrimmed) {
    if (variationsList.length >= maxTotalVariations) break;
    const wordVariations = generateVariations(word);
    const remainingSlots = maxTotalVariations - variationsList.length;
    variationsList.push(...wordVariations.slice(0, remainingSlots));
  }

  return variationsList.filter(entry => entry && !/[A-Z]/.test(entry));
}

const dataset = requireDataset();
const normalizedDataset = dataset.map(entry => entry.trim().toLowerCase());

for (const sentinel of SENTINEL_WORDS) {
  if (!normalizedDataset.includes(sentinel)) {
    console.error(`[profanity-test] Missing sentinel word "${sentinel}" in dataset.`);
    process.exit(1);
  }
}

const variations = generateVariationsList(normalizedDataset);

if (variations.length < normalizedDataset.length) {
  console.error(
    `[profanity-test] Not enough variations generated: base=${normalizedDataset.length}, variations=${variations.length}`
  );
  process.exit(1);
}

for (const sentinel of SENTINEL_WORDS) {
  if (!variations.includes(sentinel)) {
    console.error(`[profanity-test] Missing sentinel word "${sentinel}" in variations output.`);
    process.exit(1);
  }
}

console.log(
  `[profanity-test] Loaded ${normalizedDataset.length} bad words -> ${variations.length} variations.`
);
