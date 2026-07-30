// popup.js — 工具栏弹窗：快捷状态 + 打开面板

const send = (type, extra = {}) =>
  new Promise((resolve) => chrome.runtime.sendMessage({ type, ...extra }, resolve));

const $ = (id) => document.getElementById(id);

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

async function refresh() {
  // 确保今日有 picks
  await send("ENSURE_DAILY");
  const state = await send("GET_STATE");

  const picks = (state.daily && state.daily.picks) || [];
  const done = picks.filter((h) => state.followed[h]).length;
  const total = picks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  $("popup-progress").textContent = total ? `${done}/${total}` : "—";
  $("popup-bar").style.width = pct + "%";
  $("popup-detail").textContent = total
    ? `已标记 ${done} 位，共 ${total} 位待关注。`
    : "暂无今日推荐，点开面板试试「重新随机」。";
  $("popup-sync").textContent = "最近同步：" + fmtDate(state.meta && state.meta.lastSyncAt);
}

document.addEventListener("DOMContentLoaded", async () => {
  $("brand-logo").innerHTML = window.XICONS.sparkles({ size: 22, fill: "currentColor", strokeW: 0 });
  $("btn-open-panel").innerHTML =
    window.XICONS.external({}) + "<span>打开面板</span>";
  $("btn-sync-now").innerHTML = window.XICONS.sync({}) + "<span>立即同步</span>";

  $("btn-open-panel").addEventListener("click", async () => {
    await send("OPEN_PANEL");
    window.close();
  });

  // 立即同步：只扫描当前页面，不跳转
  $("btn-sync-now").addEventListener("click", async () => {
    const btn = $("btn-sync-now");
    const sync = $("popup-sync");
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = window.XICONS.sync({}) + "<span>同步中…</span>";
    const res = await send("START_MANUAL_SYNC");
    if (res && res.ok) {
      sync.innerHTML = `<span style="color:var(--color-success);font-weight:600;">同步成功 · ${res.count || 0} 条</span>`;
    } else {
      const map = {
        "not-webcafe": `当前页不是 web.cafe（${(res && res.url) || ""}），请停在帖子页再同步`,
        "no-table": "当前页未找到列表表格，请确认列表已展开",
        "empty-table": "表格为空，未抓到账号",
        "inject-failed": `无法读取当前页（${(res && res.detail) || "被页面限制"}），请刷新该页重试`,
        "no-active-tab": "未找到当前标签页",
        "no-response": "当前页无响应，请刷新页面重试",
      };
      const reason = (res && res.reason) || "unknown";
      sync.innerHTML = `<span style="color:var(--color-danger);font-weight:600;">同步失败 · ${map[reason] || "未知错误"}</span>`;
    }
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = original;
    }, 1800);
  });

  chrome.storage.onChanged.addListener((_c, area) => {
    if (area === "local") refresh();
  });

  await refresh();
});
