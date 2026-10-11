/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(__dirname, "..", "src", "lib", `${name}.ts`);
  const source = fs.readFileSync(file, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loadedModule = { exports: {} };
  cache.set(name, loadedModule.exports);
  const localRequire = (id) => id === "@/lib/quiz" ? load("quiz") : require(id);
  new Function("require", "module", "exports", output)(localRequire, loadedModule, loadedModule.exports);
  cache.set(name, loadedModule.exports);
  return loadedModule.exports;
}

const { QUESTIONS, validateAnswers, tagsFromAnswers, hasNoSpotlightBoundary } = load("quiz");
const { scorePair, matchExplanation, hasSharedActivityAnchor } = load("compatibility");

assert.equal(QUESTIONS.length, 10);
assert.deepEqual(QUESTIONS.filter((q) => q.required).map((q) => q.key), ["q1", "q2", "q5"]);
assert.match(validateAnswers({ q1: "气氛组", q2: "合作通关", q3: ["慢慢熟悉", "一起做点事", "可以互开玩笑"], q5: ["交朋友"] }).error, /第 3 题/);
assert.match(validateAnswers({ q1: "气氛组", q2: "合作通关", q5: ["交朋友", "玩游戏", "放松"] }).error, /第 5 题/);
assert.match(validateAnswers({ q1: "气氛组", q2: "合作通关", q5: ["不在选项中"] }).error, /第 5 题/);

const a = { q1: "气氛组", q2: "合作通关", q3: ["一起做点事", "可以互开玩笑"], q4: ["兴趣相投"], q5: ["交朋友", "玩游戏"], q6: "几个人深入聊", q7: "主动开聊", q8: ["音乐", "游戏"], q9: "马上参加", q10: "再玩一局" };
const b = { q1: "先观察", q2: "合作通关", q3: ["一起做点事", "不被突然点名"], q4: ["兴趣相投"], q5: ["交朋友", "玩游戏"], q6: "几个人深入聊", q7: "等别人搭话", q8: ["音乐", "游戏"], q9: "先了解一下", q10: "再玩一局" };
const c = { q1: "组织者", q2: "认真争胜", q3: ["可以互开玩笑"], q4: ["有行动力"], q5: ["跳舞"], q6: "热闹大场子", q7: "主动开聊", q8: ["运动"], q9: "马上参加", q10: "吃宵夜" };

assert.equal(validateAnswers(a).error, undefined);
assert.equal(tagsFromAnswers(a).length, 5);
assert.deepEqual(tagsFromAnswers({ q1: "先观察", q2: "合作通关", q5: ["找活动搭子"] }), ["先观察", "合作派", "活动搭子优先"]);
assert.equal(hasNoSpotlightBoundary(b), true);
assert.ok(scorePair(a, b) > scorePair(a, c));
assert.ok(scorePair(a, b) >= 60);
assert.ok(scorePair(a, c) < 60);
assert.equal(hasSharedActivityAnchor(a, b), true);
assert.equal(hasSharedActivityAnchor(a, c), false);
assert.equal(scorePair(a, b), scorePair(b, a));
const sparse = { q1: "气氛组", q2: "合作通关", q5: ["交朋友"] };
assert.ok(scorePair(sparse, sparse) >= 50 && scorePair(sparse, sparse) <= 100);
const explanation = matchExplanation(a, b);
assert.equal(explanation.anchor, "一起玩游戏");
assert.ok(explanation.reasons.some((reason) => reason.includes("音乐")));
assert.match(explanation.icebreaker, /不安排点名展示/);
console.log("Matching rules: 10 questions, validation, tags, scoring, and interaction boundary passed.");
