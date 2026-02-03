import fetch from "node-fetch";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;

const COMMON_HEADERS = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28"
};

// --- 1. 月度清理 ---
async function archiveDoneTasks() {
  const today = new Date();
  const localDate = new Date(today.getTime() + 8 * 3600000);
  if (localDate.getDate() !== 1) {
    console.log(`[Step 1] 今天是 ${localDate.getDate()} 號，跳過清理。`);
    return;
  }
  console.log("[Step 1] 1 號大掃除開始...");
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify({ filter: { property: "Status", select: { equals: "Done" } } })
  });
  const data = await res.json();
  const tasks = data.results || [];
  for (const page of tasks) {
    await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: "PATCH",
      headers: COMMON_HEADERS,
      body: JSON.stringify({ archived: true })
    });
  }
  console.log(`[Step 1] 清理完成。`);
}

// --- 2. 抓取任務 ---
async function getTasks() {
  console.log("[Step 2] 正在從 Notion 抓取任務...");
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      filter: {
        or: [
          { property: "Status", select: { equals: "Life" } },
          { property: "Status", select: { equals: "Work" } },
          { property: "Status", select: { equals: "Doing" } }
        ]
      }
    })
  });
  const data = await res.json();
  return (data.results || []).map(page => ({
    title: page.properties.Name.title[0]?.plain_text || "未命名任務",
    status: page.properties.Status.select?.name || ""
  }));
}

// --- 3. 推播函式 (修正：補回 Flex Message 邏輯與錯誤檢查) ---
async function pushToLineFlex(tasks) {
  console.log(`[Step 3] 準備推播 ${tasks.length} 個任務到 LINE...`);

  const taskContents = tasks.map(task => {
    let color = "#1E90FF"; 
    if (task.status === "Work") color = "#FF8C00";
    if (task.status === "Doing") color = "#32CD32";

    return {
      type: "box",
      layout: "baseline",
      spacing: "sm",
      contents: [
        { type: "text", text: task.status, size: "sm", color: color, flex: 2, weight: "bold" },
        { type: "text", text: task.title, size: "sm", color: "#555555", flex: 8, wrap: true }
      ]
    };
  });

  const flexMessage = {
    type: "flex",
    altText: "今日任務清單",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "📌 今日任務清單", weight: "bold", size: "lg" },
          { type: "separator", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            spacing: "sm",
            contents: taskContents.length > 0 ? taskContents : [{ type: "text", text: "✅ 目前沒事！", size: "sm" }]
          }
        ]
      }
    }
  };

  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`
    },
    body: JSON.stringify({ to: LINE_USER_ID, messages: [flexMessage] })
  });

  const result = await response.json();
  if (response.ok) {
    console.log("[Step 3] LINE 訊息發送成功！");
  } else {
    console.error("[Step 3] LINE API 報錯了：", JSON.stringify(result));
  }
}

// --- 🚀 執行主流程 ---
(async () => {
  try {
    await archiveDoneTasks();
    const tasks = await getTasks();
    await pushToLineFlex(tasks);
    console.log("🎉 全部執行完畢！");
  } catch (error) {
    console.error("❌ 流程中斷：", error);
  }
})();
