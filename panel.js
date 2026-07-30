// panel.js — 侧边面板逻辑（标签页 + 顶部同步）

const send = (type, extra = {}) =>
  new Promise((resolve) => chrome.runtime.sendMessage({ type, ...extra }, resolve));

let state = { accounts: [], followed: {}, settings: {}, daily: { date: "", picks: [] }, meta: {} };

async function loadState() {
  state = await send("GET_STATE");
  await send("ENSURE_DAILY");
  state = await send("GET_STATE");
  return state;
}

const $ = (id) => document.getElementById(id);
const isFollowed = (h) => !!state.followed[h];
function initials(name) {
  const t = (name || "?").trim();
  return t ? Array.from(t)[0].toUpperCase() : "?";
}
function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

// ---------- 图标/文案 ----------
function setStatic() {
  $("brand-logo").innerHTML = window.XICONS.sparkles({ size: 18, fill: "currentColor", strokeW: 0 });
  $("nav-today").innerHTML = window.XICONS.sparkles({ size: 18 }) + "<span>今日</span>";
  $("nav-all").innerHTML = window.XICONS.list({ size: 18 }) + "<span>全部</span>";
  $("nav-settings").innerHTML = window.XICONS.settings({ size: 18 }) + "<span>设置</span>";

  $("btn-sync-now").innerHTML = window.XICONS.sync({}) + "<span>同步</span>";
  $("btn-follow-all").innerHTML = window.XICONS.checkCircle({}) + "<span>一键关注</span>";
  $("btn-repick").innerHTML = window.XICONS.refresh({}) + "<span>换一批</span>";
  $("btn-save-settings").innerHTML = window.XICONS.check({}) + "<span>保存</span>";
}

// ---------- 同步状态反馈 ----------
function setSyncStatus({ ok, text, keep }) {
  const box = $("sync-status");
  const span = $("sync-status-text");
  box.classList.remove("ok", "err");
  if (ok === true) box.classList.add("ok");
  if (ok === false) box.classList.add("err");
  span.textContent = text;
  if (keep) box.dataset.sticky = "1";
}
function showSyncIdle() {
  const box = $("sync-status");
  if (box.dataset.sticky === "1") return;
  $("sync-status-text").textContent = fmtDateTime(state.meta && state.meta.lastSyncAt);
}

// ---------- 渲染 ----------
function renderStats() {
  const total = state.accounts.length;
  const followed = state.accounts.filter((a) => isFollowed(a.handle)).length;
  $("stat-total").textContent = total;
  $("stat-followed").textContent = followed;
  $("stat-left").textContent = Math.max(0, total - followed);
  showSyncIdle();
}

function renderToday() {
  const wrap = $("today-list");
  const picks = (state.daily && state.daily.picks) || [];
  if (!picks.length) {
    wrap.innerHTML = `<div class="empty">暂无可推荐账号。点「换一批」重新随机，或先在顶部「同步」读取网页列表。</div>`;
    updateTodayHeader(0, 0);
    return;
  }
  const items = picks.map((h) => state.accounts.find((a) => a.handle === h)).filter(Boolean);
  updateTodayHeader(items.filter((a) => isFollowed(a.handle)).length, items.length);

  wrap.innerHTML = items.map(rowHtml).join("");
}

function updateTodayHeader(done, total) {
  $("today-sub").textContent = `今日 ${total} 位待关注，已标记 ${done} 位。`;
}

let allFilter = { q: "", onlyUnfollowed: false };
function renderAll() {
  const wrap = $("all-list");
  const q = allFilter.q.trim().toLowerCase();
  const list = state.accounts.filter((a) => {
    if (allFilter.onlyUnfollowed && isFollowed(a.handle)) return false;
    if (!q) return true;
    return (
      (a.name || "").toLowerCase().includes(q) ||
      (a.handle || "").toLowerCase().includes(q) ||
      (a.note || "").toLowerCase().includes(q)
    );
  });
  if (!list.length) {
    wrap.innerHTML = `<div class="empty">没有匹配的账号。</div>`;
    return;
  }
  wrap.innerHTML = list.map(rowHtml).join("");
}

// 单行渲染（今日 & 全部通用；全部多一个标记切换按钮）
function rowHtml(a) {
  const followed = isFollowed(a.handle);
  const inToday = !$("view-today").hidden;
  const badge = followed
    ? `<span class="badge badge-followed">${window.XICONS.check({ size: 14, strokeW: 3 })}已关注</span>`
    : `<span class="badge badge-pending">待关注</span>`;
  // 有推文链接跳推文，没有则跳 X 主页
  const tweetUrl = a.tweetUrl || (a.handle ? `https://x.com/${a.handle}` : "");
  const tweet = tweetUrl
    ? `<button class="icon-btn js-open-tweet" data-url="${escapeAttr(tweetUrl)}" aria-label="打开 ${escapeAttr(a.name)} 的 X（新标签）" title="${a.tweetUrl ? "直达推文" : "X 主页"}">${window.XICONS.twitter({})}</button>`
    : `<button class="icon-btn" disabled aria-label="暂无链接" title="暂无链接">${window.XICONS.user({})}</button>`;
  const toggle = inToday
    ? ""
    : followed
    ? `<button class="btn btn-sm btn-ghost js-toggle" data-handle="${a.handle}" data-val="0">取消</button>`
    : `<button class="btn btn-sm btn-primary js-toggle" data-handle="${a.handle}" data-val="1">已关注</button>`;
  return `
    <div class="row">
      <span class="avatar">${escapeHtml(initials(a.name))}</span>
      <div class="row-main">
        <div class="row-name">${escapeHtml(a.name)} <span class="row-handle">@${escapeHtml(a.handle)}</span> ${badge}</div>
        <div class="row-note" title="${escapeAttr(a.note)}">${escapeHtml(a.note || "（无备注）")}</div>
      </div>
      <div class="row-actions">${tweet} ${toggle}</div>
    </div>`;
}

function renderSettings() {
  $("set-daily").value = state.settings.dailyCount ?? 10;
}

// ---------- 视图切换 ----------
function switchView(view) {
  document.querySelectorAll(".view").forEach((s) => (s.hidden = true));
  document.querySelectorAll(".sp-tab").forEach((n) => {
    n.classList.remove("active");
    n.setAttribute("aria-selected", "false");
  });
  $("view-" + view).hidden = false;
  const tab = document.querySelector(`.sp-tab[data-view="${view}"]`);
  tab.classList.add("active");
  tab.setAttribute("aria-selected", "true");
  if (view === "today") renderToday();
  if (view === "all") renderAll();
  if (view === "settings") renderSettings();
}

// ---------- 事件 ----------
function bindEvents() {
  document.querySelectorAll(".sp-tab").forEach((n) =>
    n.addEventListener("click", () => switchView(n.dataset.view))
  );

  // 顶部同步：读取当前已打开的网页列表
  $("btn-sync-now").addEventListener("click", syncNow);

  // 一键关注当前批次
  $("btn-follow-all").addEventListener("click", async () => {
    const picks = (state.daily && state.daily.picks) || [];
    if (!picks.length) return;
    await send("FOLLOW_PICKS", { handles: picks });
    state = await send("GET_STATE");
    renderStats();
    renderToday();
  });

  // 重新随机
  $("btn-repick").addEventListener("click", async () => {
    await send("RE_PICK");
    state = await send("GET_STATE");
    renderStats();
    renderToday();
  });

  // 列表事件委托
  document.addEventListener("click", async (e) => {
    const open = e.target.closest(".js-open-tweet");
    if (open) {
      chrome.tabs.create({ url: open.dataset.url });
      return;
    }
    const toggle = e.target.closest(".js-toggle");
    if (toggle) {
      await send("SET_FOLLOWED", { handle: toggle.dataset.handle, value: toggle.dataset.val === "1" });
      state = await send("GET_STATE");
      renderStats();
      renderAll();
      if (!$("view-today").hidden) renderToday();
    }
  });

  $("search").addEventListener("input", (e) => {
    allFilter.q = e.target.value;
    renderAll();
  });
  $("filter-unfollowed").addEventListener("change", (e) => {
    allFilter.onlyUnfollowed = e.target.checked;
    renderAll();
  });

  $("btn-save-settings").addEventListener("click", async () => {
    const dailyCount = Math.max(1, Math.min(50, parseInt($("set-daily").value, 10) || 5));
    await send("SET_SETTINGS", { settings: { dailyCount } });
    state = await send("GET_STATE");
    setSyncStatus({ ok: true, text: "设置已保存", keep: true });
    setTimeout(() => {
      const box = $("sync-status");
      box.dataset.sticky = "";
      showSyncIdle();
    }, 2000);
  });

  $("btn-reset-followed").addEventListener("click", async () => {
    if (!confirm("确定清除所有「已关注」标记吗？")) return;
    await chrome.storage.local.set({ followed: {} });
    state = await send("GET_STATE");
    await send("RE_PICK");
    state = await send("GET_STATE");
    renderStats();
    renderToday();
    renderAll();
  });
}

// 同步逻辑（读取当前页 DOM）
const REASON_MAP = {
  "not-webcafe": (r) => `当前页不是 web.cafe（${r.url || ""}）`,
  "no-table": () => "当前页未找到列表表格",
  "empty-table": () => "表格为空，未抓到账号",
  "inject-failed": (r) => `无法读取当前页（${r.detail || "被页面限制"}）`,
  "no-active-tab": () => "未找到当前标签页",
  "no-response": () => "当前页无响应，请刷新页面重试",
};

async function syncNow() {
  const btn = $("btn-sync-now");
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = window.XICONS.sync({}) + "<span>同步中…</span>";
  setSyncStatus({ ok: null, text: "正在读取当前页面…" });

  const res = await send("START_MANUAL_SYNC");
  if (res && res.ok) {
    setSyncStatus({ ok: true, text: `成功 · 共 ${res.count || 0} 条账号`, keep: true });
  } else {
    const reason = (res && res.reason) || "unknown";
    const fn = REASON_MAP[reason];
    setSyncStatus({ ok: false, text: `失败 · ${fn ? fn(res) : "未知错误"}`, keep: true });
  }
  btn.disabled = false;
  btn.innerHTML = original;
}

// 存储变化时刷新（同步成功后自动更新列表）
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area !== "local") return;
  loadState().then(() => {
    renderStats();
    if (!$("view-today").hidden) renderToday();
    if (!$("view-all").hidden) renderAll();
    if (!$("view-settings").hidden) renderSettings();
  });
});

// ---------- 工具 ----------
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
function escapeAttr(s) {
  return escapeHtml(s);
}

// ---------- 启动 ----------
(async function init() {
  setStatic();
  await loadState();
  renderStats();
  bindEvents();
  switchView("today");
})();
