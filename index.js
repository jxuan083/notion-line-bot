import fetch from "node-fetch";

// === Secrets ===
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const LINE_TOKEN = process.env.LINE_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;

const COMMON_HEADERS = {
  "Authorization": `Bearer ${NOTION_TOKEN}`,
  "Content-Type": "application/json",
  "Notion-Version": "2022-06-28"
};

// 1. 自動刪除（封存）：只在每月 1 號執行
async function archiveDoneTasks() {
  const today = new Date();
  const timezoneOffset = 8; // 台灣時區
  const localDate = new Date(today.getTime() + timezoneOffset * 3600000);
  
  // 判斷是否為每月 1 號
  if (localDate.getDate() !== 1) {
    console.log(`今天日期為 ${localDate.getDate()} 號，尚未到月度清理日。`);
    return;
  }

  console.log("📅 每月 1 號大掃除啟動！正在清理已完成任務...");
  
  const res = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
    method: "POST",
    headers: COMMON_HEADERS,
    body: JSON.stringify({
      filter: { property: "Status", select: { equals: "Done" } }
    })
  });

  const data = await res.json();
  const tasksToDelete = data.results || [];

  for (const page of tasksToDelete) {
    await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
      method: "PATCH",
      headers: COMMON_HEADERS,
      body: JSON.stringify({ archived: true })
    });
  }
  console.log(`✅ 月度清理完成，共移除 ${tasksToDelete.length} 個任務。`);
}

// 2. 抓取任務 (維持原本邏輯)
async function getTasks() {
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

// 3. 推播到 LINE (維持原本邏輯，這裡省略重複代碼，請保留你原本的 pushToLineFlex 函式內容)
async function pushToLineFlex(tasks) {
  // ... (請將你原本發送 Flex Message 的程式碼貼回這裡) ...
}

// --- 主流程 ---
(async () => {
  try {
    // 每天都會嘗試執行，但內部有日期判斷，只有 1 號會真的刪除
    await archiveDoneTasks();
    
    // 每天都會執行的推播
    const tasks = await getTasks();
    await pushToLineFlex(tasks);
    
    console.log("今日自動化任務執行完畢！");
  } catch (error) {
    console.error("發生錯誤：", error);
  }
})();
