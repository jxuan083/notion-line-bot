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

// --- 1. 月度清理函式 ---
async function archiveDoneTasks() {
  const today = new Date();
  const localDate = new Date(today.getTime() + 8 * 3600000); // 修正為台灣時區
  
  if (localDate.getDate() !== 1) {
    console.log(`[Step 1] 今天是 ${localDate.getDate()} 號，不是 1 號，跳過清理。`);
    return; // 這裡的 return 只會跳出這個 function，不會終止整個程式
  }

  console.log("[Step 1] 偵測到 1 號，開始大掃除...");
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

// --- 2. 抓取任務函式 ---
async function getTasks() {
  console.log("[Step 2] 正在抓取今日任務...");
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

// --- 3. 推播函式 (請保留你原本的 Flex Message 內容) ---
async function pushToLineFlex(tasks) {
  console.log(`[Step 3] 準備推播 ${tasks.length} 個任務到 LINE...`);
  // ... (這裡放你原本那段長長的 bubble 和 fetch LINE 的程式碼) ...
}

// --- 🚀 核心：執行主流程 ---
(async () => {
  try {
    // 步驟 A: 嘗試清理（只有 1 號會動）
    await archiveDoneTasks();
    
    // 步驟 B: 抓取任務（每天都會執行）
    const tasks = await getTasks();
    
    // 步驟 C: 發送推播（每天都會執行）
    await pushToLineFlex(tasks);
    
    console.log("🎉 全部執行完畢！");
  } catch (error) {
    console.error("❌ 發生錯誤：", error);
  }
})();
