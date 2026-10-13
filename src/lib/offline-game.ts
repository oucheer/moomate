export const TASK_CARDS = [
  {
    id: "translator",
    title: "🐮 牛牛翻译官",
    description: "一人只用“哞”和动作表达，另一人猜意思；交换角色再玩一轮。",
    steps: [
      "表达者先悄悄看台词：我不是高冷，我只是在想第一句话。",
      "用“哞”、语气和动作表达 20 秒，不说其他词。",
      "翻译者猜一句，可追问一个是或不是的问题；猜错也算完成。",
    ],
  },
  {
    id: "debate",
    title: "⚖️ 奇葩辩论庭",
    description: "为无伤大雅的话题各站一边，现场接住一条荒诞证据。",
    steps: [
      "辩题：派对最后一块蛋糕，应该归最饿的人，还是最会夸它的人？",
      "各说一句理由。证据：蛋糕特别爱听好话，但一分钟后会被收走。",
      "各用一句话解释证据为什么支持自己，再一起给出搞笑判词。",
    ],
  },
  {
    id: "route",
    title: "🗺️ 一小时放松路线",
    description: "两人一起设计一条派对结束后的轻松路线。",
    steps: [
      "各贡献一个想去的地点，可以是熟悉的，也可以是今晚发现的。",
      "商量先后顺序，给这条路线起一个名字。",
      "面对面讲讲为什么选这两个地点，不需要在手机上提交。",
    ],
  },
] as const;

export const CHALLENGES = [
  { id: "funny", title: "今晚你觉得对方最搞笑的一个瞬间是什么？", detail: "轮流说给对方听。" },
  { id: "photo", title: "找现场一个标志性物品拍合照", detail: "用自己的手机留念；不需要上传。" },
  { id: "one-line", title: "一句话形容你的玩伴", detail: "当面告诉对方。" },
] as const;

export interface OfflineProgress {
  taskIndex: number;
  swaps: number;
  completedTasks: string[];
  challenges: string[];
  completedChallenges: string[];
}

export function newOfflineProgress(): OfflineProgress {
  const shuffled = [...CHALLENGES].sort(() => Math.random() - 0.5);
  return { taskIndex: 0, swaps: 0, completedTasks: [], challenges: shuffled.slice(0, 2).map((c) => c.id), completedChallenges: [] };
}
