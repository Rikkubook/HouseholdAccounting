<script setup lang="ts">
const colors = [
  ["--canvas", "#f6f4f0", "頁面底色"],
  ["--surface", "#ffffff", "卡片底"],
  ["--surface-muted", "#efece5", "圖示方塊"],
  ["--track", "#eeebe4", "進度條底"],
  ["--fg-1", "#191817", "標題與金額"],
  ["--fg-2", "#5c5852", "導覽與內容"],
  ["--fg-3", "#8b857c", "標籤與說明"],
  ["--fg-4", "#a8a39a", "日期 Mono"],
  ["--dot-idle", "#d5d1c9", "未選圓點"],
  ["--brand-500", "#6b5cf5", "品牌紫"],
  ["--brand-600", "#5a44e0", "紫色文字"],
  ["--brand-tint", "#f1eefe", "選中底色"],
  ["--note", "#9a8fe8", "備註文字"],
];
const gradients = [
  ["--gradient-brand", "linear-gradient(135deg,#6b5cf5,#b04bd6)", "身分／開關／佔比"],
  ["--gradient-action", "linear-gradient(140deg,#2f6bf5,#22b8e6)", "主要動作／浮動按鈕"],
  ["--gradient-budget-ok", "linear-gradient(90deg,#2bb3d9,#3ddc97)", "安全 <70%"],
  ["--gradient-budget-near", "linear-gradient(90deg,#f5b23c,#ef7c2b)", "警示 ≥70%"],
  ["--gradient-budget-over", "linear-gradient(90deg,#f2568f,#d94ba8)", "超支 ≥100%"],
];
const type = [
  ["--fs-hero", "38", "手機主要數字", "text-hero"],
  ["--fs-metric", "30", "桌機 KPI", "text-metric"],
  ["--fs-metric-sm", "26", "強調卡數字", "text-metric-sm"],
  ["--fs-page-title", "20", "頁面標題", "text-title"],
  ["--fs-section", "14.5", "區塊標題", "text-section"],
  ["--fs-body", "13.5", "內文與列表", "text-body"],
  ["--fs-label", "11.5", "欄位標籤", "text-label"],
];
const radii = [
  ["--r-sm", "7px"],
  ["--r-md", "9px"],
  ["--r-lg", "11px"],
  ["--r-card", "14px"],
  ["--r-dialog", "18px"],
  ["--r-pill", "99px"],
];
const layout = [
  ["--sidebar-w", "216px", "桌機側欄"],
  ["--content-max", "1160px", "內容最大寬"],
  ["--bp-mobile", "768px", "全站唯一斷點"],
  ["--hit-min", "44px", "手機最小觸控高"],
  ["--shadow-none", "none", "卡片一律 1px 邊框分層"],
  ["--shadow-fab", "0 8px 22px rgba(47,107,245,.34)", "唯一帶陰影的元件"],
];
</script>

<template>
  <div class="p-8 flex flex-col gap-8 max-w-content">
    <section class="flex flex-col gap-3">
      <h2 class="text-section font-bold text-fg-1 m-0">色彩</h2>
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(212px, 1fr))">
        <div v-for="[name, value, note] in colors" :key="name" class="flex items-center gap-2.5 min-w-0">
          <span class="w-10 h-10 shrink-0 rounded-md border" :style="{ background: value }" />
          <span class="flex flex-col gap-0.5 min-w-0">
            <span class="font-mono text-[11px] text-fg-1">{{ name }}</span>
            <span class="text-[10.5px] text-fg-4 truncate">{{ value }} · {{ note }}</span>
          </span>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-section font-bold text-fg-1 m-0">漸層</h2>
      <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))">
        <div v-for="[name, value, note] in gradients" :key="name" class="flex flex-col gap-2">
          <span class="h-12 rounded-md" :style="{ background: value }" />
          <span class="font-mono text-[11px] text-fg-1">{{ name }}</span>
          <span class="text-[10.5px] text-fg-4">{{ note }}</span>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-section font-bold text-fg-1 m-0">字級</h2>
      <div class="flex flex-col gap-3">
        <div v-for="[name, px, note, cls] in type" :key="name" class="flex items-baseline gap-3 flex-wrap">
          <span class="font-bold text-fg-1 tnum" :class="cls">56,160</span>
          <span class="font-mono text-[10.5px] text-fg-4">{{ name }} {{ px }} · {{ note }}</span>
        </div>
        <div class="flex items-baseline gap-3">
          <span class="font-mono text-mono text-fg-3">08/28 · 70% · 980901</span>
          <span class="font-mono text-[10.5px] text-fg-4">--font-mono 11 · 日期、百分比、代碼</span>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-section font-bold text-fg-1 m-0">圓角</h2>
      <div class="flex flex-wrap gap-3">
        <span v-for="[name, value] in radii" :key="name" class="flex flex-col items-center gap-1.5">
          <span class="w-14 h-10 bg-surface-muted" :style="{ borderRadius: value }" />
          <span class="font-mono text-[10px] text-fg-4">{{ name }}</span>
        </span>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-section font-bold text-fg-1 m-0">版面與高度</h2>
      <div class="flex flex-col gap-1.5 font-mono text-[11px] text-fg-3">
        <span v-for="[name, value, note] in layout" :key="name">{{ name }}: {{ value }} — {{ note }}</span>
      </div>
    </section>
  </div>
</template>
