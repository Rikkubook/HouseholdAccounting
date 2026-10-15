# 專案資料夾導覽（新手版）

給第一次接觸這個專案的人：為什麼資料夾這樣分、每個資料夾做什麼、裡面有哪些東西。最後的「問答」一節會隨著提問持續補充。

> 這個結構從第一個 commit（`37603e0`，2026-09-27）就是這樣，之後的功能都是在既有結構裡增加檔案。

---

## 1. 為什麼要分成這幾個資料夾？

用一間**餐廳**來比喻：

| 餐廳 | 這個專案 | 資料夾 |
|---|---|---|
| 🪑 外場（客人看到的桌椅、菜單、服務生） | **前端**：手機上看到的畫面 | `vue3/` |
| 🍳 廚房（煮菜、管食材，客人進不去） | **後端**：檢查權限、計算數字、存取資料 | `api/` |
| 📋 外場和廚房共用的點菜單格式 | **共用規格**：一筆交易長什麼樣子 | `shared/` |
| 📦 倉庫 | **資料庫**（PostgreSQL） | 不在這裡，在雲端 |

### 為什麼外場和廚房要分開？

- **安全**：客人不能自己走進廚房拿東西。像「別人的個人帳一律回 404」這種規則一定要寫在後端，因為前端的程式碼使用者可以自己改。
- **分工**：改畫面顏色不會動到計算邏輯，改計算也不會弄壞畫面。
- **部署**：前端和後端各自部署到 Vercel，可以分開更新。

### 為什麼還要多一個 `shared/`？

如果外場寫「金額」、廚房寫「價錢」，兩邊就對不上。`shared/` 把「一筆交易有哪些欄位、金額必須大於 0」**只寫一次**，前後端都拿同一份來用。

### 為什麼三個放在同一個大資料夾？

這種做法叫 **monorepo**（單一倉庫）。好處是改一個功能時，前端、後端、共用規格可以**一次 commit 一起改**。例如加 `ownerId` 欄位時，三個地方就是在同一個 commit 一起改的。

[pnpm-workspace.yaml](../pnpm-workspace.yaml) 就是在告訴套件管理工具 pnpm：「這三個資料夾是同一家人」。

---

## 2. 最外層：每個東西的用途

| 項目 | 用途 | 新手要不要碰 | 討論過 |
|---|---|---|:-:|
| `.claude/` | Claude Code 的設定，例如啟動 dev server 的方式 | 不用 |  |
| `api/` | 後端 | 常改 | ✅ Q2 |
| `docs/` | 文件：需求規格、CRUD 對照表、修改紀錄、事故紀錄、這份導覽 | 會看 |  |
| `node_modules/` | 下載回來的別人寫的套件，可能有幾萬個檔案 | ❌ **絕對不要改**；壞了就刪掉重新 `pnpm install` |  |
| `shared/` | 前後端共用的規格 | 偶爾改 | ✅ |
| `vue3/` | 前端 | 常改 |  |
| [.gitignore](../.gitignore) | 列出**不要**放進 git 的東西：`node_modules`、`dist`，還有**密碼檔 `api/.env`** | 少改 |  |
| [package.json](../package.json) | 整個專案的「遙控器」，例如 `pnpm test` 會去跑後端測試 | 少改 |  |
| `pnpm-lock.yaml` | 記錄每個套件的**精確版本**，讓每台電腦裝到一模一樣的東西 | ❌ 不要手改，讓 pnpm 自動更新 |  |
| [pnpm-workspace.yaml](../pnpm-workspace.yaml) | 宣告這是 monorepo，裡面有哪三個子專案 | 少改 | ✅ Q1 |

---

## 3. 內部介紹

樹狀圖照 VS Code 檔案總管的順序排列（資料夾在前、檔案在後）。行尾 **✅** 表示有討論過，後面是問答的編號。

### 📋 `shared/`：共用規格（最小，建議先看）

```
shared/
├── dist/          ← ⚠️ 自動產生的，不要改                              ✅
├── index.ts       ← 出口：把下面兩個打包給別人用                        ✅
├── package.json   ← 套件設定；"private": true＝不發布到 npm             ✅ Q1
├── schema.ts      ← 規則：「金額必須 > 0」「scope 只能是 family 或 personal」 ✅
└── types.ts       ← 型別：一筆交易有 id、amount、ownerId…               ✅
```

**關於 `dist/`**：`dist` 是 distribution（成品）的意思。我們寫的是 `.ts`（TypeScript），執行 `build` 後會**翻譯**成 `.js` 放進 `dist/`。所以要改內容時，**改 `schema.ts`，不要改 `dist/schema.js`**，下次 build 時 `dist/` 會被整個蓋掉。它也列在 `.gitignore` 裡，不會進 git。

### 🍳 `api/`：後端（廚房）

```
api/
├── api/                   ← 給 Vercel 的接頭（[...route].ts）
├── node_modules/          ← 後端自己的套件，不要改
├── public/                ← 後端首頁，有 Swagger 連結                    ✅ Q7
├── sql/                   ← 資料庫改建工程紀錄（0000 → 0001 → …）
├── src/
│   ├── db/                ← 倉庫管理員：資料表定義、匯入資料
│   ├── docs/              ← Swagger 文件內容（openapi.ts）              ✅ Q7
│   ├── lib/               ← 工具箱（菜刀）：日期、密碼、錯誤訊息          ✅ Q1 Q3
│   ├── middleware/        ← 門口警衛：檢查有沒有登入
│   ├── routes/            ← 服務生：一種資料一個檔案                     ✅ Q4 Q5 Q6 Q7
│   │   ├── summary.ts        （首頁、統計、年度彙整的數字）             ✅ Q6 Q7
│   │   ├── transactions.ts   （交易的 CRUD：記帳、改帳、刪帳）          ✅ Q2 Q4
│   │   └── auth.ts / budgets.ts / categories.ts / cron.ts / members.ts / subscriptions.ts …
│   ├── services/          ← 廚師（食譜）：記帳專用的計算                 ✅ Q3 Q6
│   │   ├── charges.ts        （訂閱扣款，兩個服務生共用）               ✅ Q6
│   │   ├── dashboard.ts      （首頁的數字怎麼算）                       ✅ Q3 Q6
│   │   ├── fixed.ts          （固定支出怎麼分攤）
│   │   ├── scope.ts          （⭐ 家庭帳／個人帳的判斷全在這裡）         ✅ Q3
│   │   └── year.ts           （年度彙整怎麼算）                         ✅ Q3
│   ├── app.ts             ← 把各個 routes 接上網址                      ✅ Q4
│   ├── env.ts             ← 讀設定（金鑰、CORS 網址）                    ✅ Q1
│   └── index.ts           ← 本機啟動伺服器
├── test/                  ← 自動測試
├── .env.example           ← 設定檔範本（真正的 .env 有密碼，不進 git）
└── package.json           ← 後端的套件清單；"private": true             ✅ Q1
```

**`routes/` 和 `services/` 為什麼要分開？** 窗口只負責「收單、回應」，廚師負責「怎麼煮」。很多窗口可能用到同一個計算（首頁和統計都要算支出），所以把計算抽出來放在 `services/`，寫一次就好。

**`sql/` 為什麼有編號？** 資料庫就像一棟已經有人住的房子，不能拆掉重蓋，只能一次一次「加蓋」。編號就是施工順序，例如 `0002_owner_columns.sql` 就是幫交易加上 `owner_id`（個人帳用）那一次。

### 🪑 `vue3/`：前端（外場）

```
vue3/
├── .storybook/            ← 展示櫃本身的設定（去哪找展品、共同準備）     ✅ Q8 Q9
├── node_modules/          ← 前端自己的套件，不要改
├── public/                ← App 圖示、安裝到手機桌面的設定
├── src/
│   ├── api/               ← 傳話筒：負責跟後端 api/ 講話
│   ├── assets/            ← 圖片與樣式
│   │   └── tokens.css        （⭐ 顏色表，個人帳的青綠色就在這裡）
│   ├── components/        ← 可重複使用的零件
│   │   ├── base/             （按鈕、輸入框、載入圓環：最基本的積木）
│   │   ├── data/             （交易列、分類卡片：顯示資料的積木）
│   │   └── layout/           （側邊欄、手機頂端列：頁面骨架）
│   ├── composables/       ← 可重複使用的小功能（判斷是不是手機尺寸）
│   ├── constants/         ← 固定不變的值（圖示清單、成員顏色）           ✅ Q8
│   ├── mocks/             ← 假後端：沒開資料庫也能看畫面                 ✅ Q8
│   ├── router/            ← 地圖：哪個網址顯示哪一頁、選單有哪些項目
│   ├── stores/            ← 記憶：全 App 共用的狀態（Pinia）             ✅ Q8
│   │   └── scope.ts          （⭐ 現在在家庭帳還是個人帳）               ✅ Q8
│   ├── stories/           ← 展品：顏色、字級總表（Storybook）            ✅ Q8 Q9
│   ├── types/             ← 前端用的型別
│   ├── utils/             ← 小工具（金額格式、日期格式）
│   ├── views/             ← 一整頁一個檔（新增交易頁、交易列表頁…）
│   ├── App.vue            ← App 的最外層
│   └── main.ts            ← 大門：App 從這裡啟動（決定要不要裝假後端）   ✅ Q8
├── .env.development / .env.real / .env.production ← 三種模式的設定      ✅ Q8
└── tailwind.config.ts     ← 樣式工具設定
```

**`views/` 和 `components/` 的差別**：`views` 是**一整道菜**（一頁），`components` 是**食材**。例如「交易列」這個元件，首頁和交易列表頁都會用到，做一次、兩頁共用，兩頁的欄位才會對得齊。

**`.env` 的三種模式**：

| 模式 | 連到哪裡 | 用途 |
|---|---|---|
| `development` | 假後端 `mocks/` | 改畫面、截圖，不會弄壞真資料；重新整理後資料會重置 |
| `real` | 本機的真資料庫 | 上線前用真資料走一遍 |
| `production` | 正式上線版 | 家人實際在用的版本 |

---

## 4. 串起來看：記一筆個人帳時發生了什麼

以小妹記一筆「珍奶 88」為例：

```
① vue3/src/views/TransactionCreateView.vue   小妹填表、按「儲存」
        ↓ 從 stores/scope.ts 得知「現在在個人帳」
② vue3/src/api/transactions.ts               包成一張單：{金額 88, scope: personal}
        ↓ 透過網路送出
③ api/src/middleware/auth.ts                 警衛：你是誰？→ 小妹 ✓
④ api/src/routes/transactions.ts             窗口收單，用 shared/schema.ts 檢查格式
⑤ api/src/services/scope.ts                  決定這筆屬於「小妹的個人帳」
⑥ 資料庫                                      存進去，owner_id = 3（小妹）
        ↓ 一路回傳
⑦ 畫面跳出「已記在個人帳」
```

先生查交易時也是走同一條路，只是到第 ⑤ 步時，`scope.ts` 只會撈 `owner_id = 1` 的資料，所以先生看不到小妹那筆。

---

## 5. 建議閱讀順序

1. `shared/types.ts`：10 分鐘看懂「一筆交易長什麼樣子」
2. `vue3/src/views/` 挑一頁，例如 `TransactionCreateView.vue`
3. `api/src/routes/transactions.ts`
4. `api/src/services/scope.ts`

---

## 6. 問答

### Q1. 另一個專案可以拿這個 `api/` 裡的程式碼來用嗎？

**可以，但要先分清楚想拿的是哪一種東西。** 用餐廳比喻：另一家餐廳想要的是你廚房的**食譜**（程式碼），不是向你的廚房點菜（呼叫 API）。

#### 先看：`api/` 裡哪些東西拿得走？

食譜有的寫得很通用，有的寫死了「我們家的冰箱在左邊第二格」。程式碼也一樣，要看它**依賴了什麼**：

| 程式碼 | 依賴 | 能不能直接拿走 |
|---|---|---|
| `api/src/lib/dates.ts`（月份、日期計算） | 什麼都沒有，純計算 | ✅ 最容易，複製過去就能用 |
| `shared/`（欄位定義、檢查規則） | 只有 `zod` 這個套件 | ✅ 本來就設計成給別人用的套件 |
| `api/src/lib/auth.ts`（密碼雜湊、登入憑證） | 讀 `env.ts` 裡的金鑰 | 🟡 可以，但新專案要有**自己的**金鑰，不能共用 |
| `api/src/services/`（儀表板、統計、分攤） | 直接查**這個專案的資料庫**（`db`、`schema`） | ❌ 和家庭帳的資料表綁死，拿走也跑不起來 |
| `api/src/routes/` | 依賴 Hono、登入中介層、上面的 services | ❌ 是這個 App 專屬的窗口 |

判斷原則：**檔案開頭的 `import` 越少、越不碰資料庫，就越容易被別人重複使用。**

#### 四種拿法

| 方法 | 做法 | 優點 | 缺點 | 適合 |
|---|---|---|---|---|
| ① 複製貼上 | 把檔案直接複製到另一個專案 | 最快，馬上能用 | 兩份各自改，修了 bug 要記得兩邊都改 | 小工具，例如 `dates.ts` |
| ② 搬進同一個 monorepo | 把另一個專案也放進這個資料夾，在 [pnpm-workspace.yaml](../pnpm-workspace.yaml) 加一行 | 改一次兩邊同步，跟現在 `vue3/` 用 `shared/` 一模一樣 | 兩個專案綁在同一個倉庫 | 同一個人在維護、關係很近的專案 |
| ③ 抽成套件發布 | 把共用的程式碼抽到一個獨立套件（例如 `@family-ledger/utils`），發布到 npm 或 GitHub Packages，另一個專案用 `pnpm add` 安裝 | 兩個倉庫保持獨立，靠版本號控制更新 | 要學發布流程；每次改都要發新版 | 會有好幾個專案、或不同人在用 |
| ④ 不拿程式碼，改成呼叫 API | 另一個專案直接向這個後端要資料 | 完全不用搬程式碼 | 只能用到 API 開放的功能；這個後端要一直開著 | 需要的是**這裡的資料**，不是這裡的寫法 |

#### 如果要做，會怎麼做？

以「另一個專案也想用日期工具」為例，建議的步驟：

1. 先用 ① 複製 `dates.ts` 過去，確認真的用得到
2. 如果後來兩邊都一直在改，再把它搬到 `shared/`，或另外開一個 `utils/` 套件
3. 真的有第三個專案也要用時，才考慮 ③ 發布成套件

> 原則：**先複製，重複到第三次再抽出來共用。** 太早抽出共用套件，常常會變成為了「可能會用到」而增加維護成本。

#### 目前的現況

- `api/` 和 `shared/` 的 `package.json` 都寫了 `"private": true`，意思是「**不會發布到 npm**」，只在這個 monorepo 裡面互相使用
- 想用 ③，要先把 `private` 拿掉，並決定套件名稱與發布的地方
- `shared/` 已經有套件的樣子（有 `main`、`types`、`exports`），是最容易變成公開套件的那一個

### Q2. `api/` 這一包到底在做什麼？（白話版）

**一句話：它是一個一直在雲端待命的程式，專門回答 App 的問題。**

你在手機上按任何按鈕，App 其實都是在傳訊息問 `api/`：

- 「幫我記一筆 380 元的午餐」
- 「這個月花了多少？」
- 「把這筆刪掉」

`api/` 收到後做三件事：

1. **確認你是誰**：有沒有登入
2. **確認你可不可以做**：例如小妹不能刪先生的帳
3. **去資料庫拿資料或寫資料**，再把結果回傳給 App

手機上的 App 本身**不存任何帳目**，所有資料都在 `api/` 後面的資料庫裡。所以換一支手機登入，帳目還是都在。

#### 裡面的資料夾，一個一句話

先記住打 ⭐ 的三個就好：

| 資料夾 | 白話說明 |
|---|---|
| ⭐ `src/routes/` | **接電話的人**。每個檔案負責一類問題：`transactions.ts` 管記帳，`members.ts` 管成員 |
| ⭐ `src/services/` | **算數的人**。「這個月花多少」這種要計算的事情 |
| ⭐ `src/db/` | **資料表的樣子**。規定「交易」這張表有金額、日期、記帳者這些欄位 |
| `src/middleware/` | **門口檢查證件的人**。沒登入就不讓你進去 |
| `src/lib/` | **小工具**。例如把日期轉成「2026-10」這種格式 |
| `sql/` | **資料庫的修改紀錄**。每次資料表要加欄位，就多一個檔案 |
| `test/` | **自動檢查**。跑一次就知道功能有沒有壞掉 |

#### 看一段真的程式碼

「刪除一筆交易」，在 [api/src/routes/transactions.ts](../api/src/routes/transactions.ts)。程式碼不用看懂，看右邊的中文就好：

```ts
transactionRoutes.delete("/:id", ...            // 有人要「刪除」第幾號交易
  const user = c.get("user");                    // 是誰要刪？

  const [current] = await db.select()...         // 去資料庫找出這筆交易
  if (!current ...) throw notFound(...)          // 找不到，或是別人的個人帳 → 回「不存在」
  if (不是管理者 && 不是自己記的) throw forbidden(...)  // 不是你的 → 回「不可以」

  await db.update(...).set({ isDeleted: true })  // 標記成「已刪除」（不是真的刪掉）
  return ...                                     // 回覆：好了
```

**所有功能幾乎都是這個樣子**：先問「你是誰」→ 找資料 → 檢查可不可以 → 動手 → 回覆。

**為什麼「刪除」不是真的刪掉？** 上面只是把交易標成 `isDeleted: true`，資料其實還在，只是 App 不再顯示。萬一刪錯還找得回來。這種做法叫「軟刪除」。

### Q3. `src/services/` 跟 `src/lib/` 有什麼不一樣？

**判斷方法：把這個檔案拿到一個完全無關的 App（例如「待辦事項 App」），還用得到嗎？**

- **還用得到** → `lib/`
- **用不到，因為它在講記帳的事** → `services/`

| | `lib/` | `services/` |
|---|---|---|
| 比喻 | **菜刀、量杯、計時器** | **本店的招牌食譜** |
| 特色 | 每間廚房都有，跟煮什麼菜無關 | 只有這間店有，寫「怎麼做出我們家的菜」 |
| 會碰資料庫嗎 | 不會 | 會，要去拿食材（資料） |

#### 用真的檔案對照

**`lib/`（通用工具）**

| 檔案 | 在做什麼 | 待辦 App 用得到嗎？ |
|---|---|---|
| `dates.ts` 的 `monthOf` | 把「2026-10-15」變成「2026-10」 | ✅ |
| `auth.ts` | 把密碼加密、檢查密碼對不對 | ✅ 只要有登入就用得到 |
| `errors.ts` | 統一錯誤訊息的格式（「找不到」「不可以」） | ✅ |

**`services/`（記帳專用）**

| 檔案 | 在做什麼 | 待辦 App 用得到嗎？ |
|---|---|---|
| `dashboard.ts` | 算首頁：本月收入、支出、各分類花了多少 | ❌ 待辦 App 沒有「支出」 |
| `scope.ts` | 判斷這筆是家庭帳還是個人帳 | ❌ 只有這個 App 有兩本帳 |
| `year.ts` | 算年度彙整表 | ❌ |

#### 它們怎麼合作？

`services/` 會**拿 `lib/` 的工具來用**，就像照食譜做菜時會用到菜刀。

例如 `year.ts` 要算 2026 年的支出：先用 `lib/dates.ts` 的 `yearRange` 算出「2026-01-01 到 2026-12-31」，再拿這個範圍去資料庫撈資料、加總。

反過來不會發生：`lib/` 不會去用 `services/`。菜刀不需要知道食譜。

#### 灰色地帶

`lib/dates.ts` 裡也有幾個不那麼通用的函式，例如 `monthlyEquivalent`（把年繳金額換算成每月）。它其實跟訂閱有關，但因為只是純計算、不碰資料庫，所以放在 `lib/`。界線不是百分之百清楚時，**「碰不碰資料庫」**也是很好用的判斷依據。

### Q4. `routes/` 是怎麼拆的？是照每個頁面的 CRUD 嗎？

**不是照頁面，是照「資料的種類」拆。CRUD 是每個檔案「裡面」的分法。**

#### 外層：一種資料一個檔案

每個 routes 檔案管**一種東西**，像倉庫一樣：交易一個倉庫、成員一個倉庫、分類一個倉庫。對應寫在 [api/src/app.ts](../api/src/app.ts)。

| 檔案 | 管的東西 | 網址開頭 |
|---|---|---|
| `transactions.ts` | 交易 | `/api/transactions` |
| `members.ts` | 成員 | `/api/members` |
| `categories.ts` | 分類 | `/api/categories` |
| `budgets.ts` | 預算 | `/api/budgets` |
| `subscriptions.ts` | 訂閱 | `/api/subscriptions` |

#### 為什麼不照頁面拆？

因為**頁面和資料不是一對一**：

| 頁面 | 用到哪些 routes |
|---|---|
| 新增交易頁 | `transactions`（記帳）＋ `categories`（選分類）＋ `members`（選記帳者） |
| 交易列表頁 | `transactions`（列表、修改、刪除）＋ `categories`（篩選） |
| 預算管理頁 | `budgets` ＋ `categories` |

- **一頁會用到好幾個檔案**
- **一個檔案會被好幾頁用到**：`categories` 被新增、列表、預算、分類設定四頁共用

如果照頁面拆，「列出分類」要在四個檔案各寫一次，改一次規則要改四個地方。照資料拆，**同一件事只寫一次**。另一個好處：頁面改版時後端不用動（例如拿掉新增頁的「記在」選擇，後端完全沒改）。

#### 內層：每個檔案裡面才是 CRUD

以 [transactions.ts](../api/src/routes/transactions.ts) 為例：

| CRUD | 意思 | 程式裡的寫法 | 誰在用 |
|---|---|---|---|
| **C**reate 新增 | 記一筆 | `post("/")` | 新增交易頁 |
| **R**ead 讀取 | 列出交易 | `get("/")` | 交易列表頁、首頁 |
| **U**pdate 修改 | 改一筆 | `patch("/:id")` | 交易列表頁的編輯視窗 |
| **D**elete 刪除 | 刪一筆 | `delete("/:id")` | 交易列表頁的垃圾桶 |

也就是說：CRUD 確實是分法，但它是「**每種資料**各有一套 CRUD」，不是「每個頁面各有一套」。

#### 三個例外

| 檔案 | 為什麼例外 |
|---|---|
| `summary.ts` | 首頁、統計、年度彙整的**計算結果**。沒有「報表」這張資料表，都是從交易算出來的，所以大多只有「讀」。這是少數接近照頁面拆的檔案（一個網址對一頁） |
| `auth.ts` | 管的是**動作**（登入、登出、重設密碼），不是資料 |
| `cron.ts` | **沒有頁面**：每天凌晨自動跑的工作（訂閱自動扣款、備份），由機器呼叫 |

想查某一頁打了哪些 API，看 [crud-matrix.md](crud-matrix.md)：那份是「頁面 × API × CRUD」的完整對照表。

### Q5. 身為 SA，拿到一個新頁面時，怎麼知道要拆幾支 API？

**方法：先看畫面，把上面的東西拆成「名詞」和「動詞」，再去對照現有的 API。**

#### 步驟 1：列出畫面上「顯示什麼」和「能做什麼」

先不要想 API，只列兩張清單：

- **看得到的東西**：畫面上顯示了哪些資料？→ 通常是「讀」（R）
- **按得到的東西**：有哪些按鈕、表單、開關？→ 通常是「新增、修改、刪除」（C／U／D）

#### 步驟 2：圈出「名詞」，每個名詞就是一種資料

例如交易、分類、成員。**一種名詞，大概就是一個 routes 檔案**（見 Q4）。

#### 步驟 3：對照現有的 API

每個名詞和動作都去 [crud-matrix.md](crud-matrix.md) 查：

| 情況 | 結果 |
|---|---|
| 這個名詞已經有了，這個動作也有了 | ✅ **直接用**，不用新增 |
| 名詞有了，但缺這個動作 | ➕ 在現有檔案裡**加一支** |
| 名詞有、動作也有，但要多帶一個條件 | 🔧 **改現有那支**，加參數 |
| 名詞是全新的 | 🆕 **開一個新檔案**，通常要一整套 CRUD |
| 要顯示的是「算出來的數字」 | 📊 放 `summary.ts`，通常只要「讀」 |

#### 步驟 4：每支 API 問清楚細節

- **誰可以用？** 全員、只有管理者，還是只能看自己的？
- **要一次給全部，還是要分頁、篩選？**
- **刪除是真的刪掉，還是軟刪除？**
- **修改要不要留紀錄？**
- **資料有什麼限制？** 例如金額要大於 0、名稱不能重複

#### 演練一：下一版的「個人分類」

設計稿：分類設定頁多一個家庭／個人切換。

| 畫面上的東西 | 名詞 | 動作 | 對照現有 API | 結論 |
|---|---|---|---|---|
| 分類列表 | 分類 | 讀 | 已有 | 🔧 加 `scope` 參數 |
| 「新增分類」按鈕 | 分類 | 新增 | 已有 | 🔧 加 `scope` 參數 |
| 改名、停用、排序 | 分類 | 修改 | 已有 | ✅ 直接用（後端檢查是不是你的分類） |

**結果：新增 0 支，修改 2 支。** 很多新頁面其實不需要新的 API，所以一定要先對照現有的。

#### 演練二：全新的「存錢目標」頁（假設）

設計稿：可以設定「旅遊基金 50,000 元」，顯示目前存了多少、進度條。

| 畫面上的東西 | 名詞 | 動作 | 對照現有 API | 結論 |
|---|---|---|---|---|
| 目標列表 | 存錢目標 | 讀 | 沒有 | 🆕 新檔案 `goals.ts` |
| 「新增目標」 | 存錢目標 | 新增 | 沒有 | 🆕 |
| 編輯目標金額 | 存錢目標 | 修改 | 沒有 | 🆕 |
| 刪除目標 | 存錢目標 | 刪除 | 沒有 | 🆕 |
| 進度條「已存 32,000」 | （算出來的） | 讀 | 沒有 | 📊 放 `goals.ts` 或 `summary.ts` |

**結果：新增 1 個檔案、4～5 支 API**，另外要加一張資料表（`sql/` 多一個檔案）。

進度條「已存多少」最需要問清楚：**是從哪裡算出來的？** 手動記錄存了多少，還是從收支結餘自動算？答案不同，API 就完全不同。

> 🔍 **SA 技巧**：數 API 時，**看名詞，不要看按鈕**。按鈕可能有 10 個，但如果都在操作同一個名詞，通常也就是同一個檔案裡的 4、5 支。最容易漏掉的是「畫面上算出來的數字」：設計稿上只是一個數字，背後可能要一支專門的 API 去算。

### Q6. `routes/` 和 `services/` 還是分不清楚？

用**一個真的例子**從頭跟到尾。

#### 比喻：服務生和廚師

| | route（服務生） | service（廚師） |
|---|---|---|
| 站在哪 | 外場，**直接面對客人** | 廚房，**客人看不到** |
| 做什麼 | 聽懂點什麼 → 確認能不能點 → 把單交給廚師 → 把菜端出去 | 真的把菜煮出來 |
| 需要知道 | 客人是誰、點了什麼、點得對不對 | 怎麼煮 |
| 不需要知道 | 怎麼煮 | 客人是誰、從哪一桌點的 |

#### 真的例子：打開首頁

App 問後端：「**2026 年 10 月**的首頁數字給我。」

**① route 收到**：[api/src/routes/summary.ts](../api/src/routes/summary.ts)，整段只有 3 行：

```ts
summaryRoutes.get("/dashboard", ...檢查月份格式..., async (c) => {
  const { month, scope } = c.req.valid("query");    // 1. 聽懂點什麼：哪個月？哪本帳？
  return c.json(await buildDashboard(month, ...));   // 2. 交給廚師 buildDashboard
});                                                   // 3. 把結果端回去
```

服務生只做三件事：**聽懂、交出去、端回來**，完全不知道首頁數字怎麼算。

**② service 真的去算**：[api/src/services/dashboard.ts](../api/src/services/dashboard.ts) 的 `buildDashboard`，100 多行：

- 算出 10 月的日期範圍（10/1 到 10/31）
- 去資料庫撈這個月的交易
- 加總收入、支出
- 每個分類花了多少、預算多少
- 固定支出多少
- 最近 5 筆交易

#### 一眼分辨的方法

打開一個檔案，看它**有沒有在處理「網址」和「客人」**：

| 看到這些 → route | 看到這些 → service |
|---|---|
| `get("/dashboard")` 這種**網址** | 沒有網址 |
| `c.req`（讀取客人送來的東西） | 沒有 `c` |
| `c.json(...)`（把結果回傳） | 只是 `return` 一個結果 |
| `c.get("user")`（是誰在點） | 只拿到「月份」這種整理好的參數 |
| 通常**很短** | 通常**很長** |

#### 為什麼要分成兩個人？

**同一道菜，好幾個服務生都會點。** 「訂閱扣款」（`services/charges.ts`）有兩個地方會點：

- `routes/subscriptions.ts`：使用者手動按「標記已扣款」
- `routes/cron.ts`：每天凌晨機器自動扣款

扣款規則寫在 service 裡，兩邊點的是**同一個廚師**，規則只寫一次。

**廚師可以單獨測試。** 測「首頁數字算得對不對」時，直接叫 `buildDashboard("2026-10")` 就好，不用假裝成登入的使用者去打網址。

> **記一句話：route 負責「誰、點什麼」，service 負責「怎麼算」。** route 很短、看得到網址；service 很長、在算東西。

### Q7. 可以把 Swagger 上的 route 當成「只是路徑」，真正的方法是 service 嗎？

**大致可以，但要修正兩個地方。** 結論先講：**Swagger 上列的每一項，對應的都是 route；service 不會出現在 Swagger 上。**

#### 修正一：「方法」這個詞要小心

在 API 的世界裡，「方法」（method）專指 **GET、POST、PATCH、DELETE**，就是 Swagger 每一項前面那個彩色標籤。

```
GET    /summary/dashboard     ← GET 是「方法」，/summary/dashboard 是「路徑」
POST   /transactions
DELETE /transactions/{id}
```

這個「方法」屬於 **route**。比較精確的說法：

| | 是什麼 | 在哪裡 |
|---|---|---|
| **方法 + 路徑** | `GET /summary/dashboard` | route |
| **真正的邏輯**（怎麼算） | `buildDashboard` | service |

「真正做事的是 service」是對的，只是那個東西叫**邏輯**（商業邏輯），不叫「方法」。

#### 修正二：route 不「只是」路徑

Swagger 上每一項除了路徑，還寫了這些，**全都是 route 負責的**：

| Swagger 上寫的 | route 在做的事 |
|---|---|
| 參數：`month`（必填，格式 YYYY-MM） | **檢查**送來的東西對不對，不對就回 400 |
| 需要登入（鎖頭圖示） | **確認**你是誰，沒登入就回 401 |
| 回應：200 成功、401 未登入 | **決定**回什麼結果 |

route 是**服務生**，不只是門牌號碼：要聽懂、要檢查、要回話。只有「把菜煮出來」交給 service。

#### 對照 Swagger 看一次

這個專案的 Swagger 在 `/api/docs`（入口在 [api/public/index.html](../api/public/index.html)）。以「首頁儀表板」為例：

| Swagger 上看到的 | 對應的程式 |
|---|---|
| `GET /summary/dashboard` | [routes/summary.ts](../api/src/routes/summary.ts) 的 `get("/dashboard")` |
| 參數 `month` | 同一行的 `zValidator(...month...)` |
| 回應 `DashboardPayload` | `shared/` 裡定義的格式 |
| **（Swagger 上看不到）** | [services/dashboard.ts](../api/src/services/dashboard.ts) 的 `buildDashboard`，真正去算的地方 |

**Swagger 是「菜單」**：告訴你能點什麼、要給什麼、會拿到什麼。客人不需要知道廚房怎麼煮，所以菜單上不會寫 service。

#### 注意：這裡的 Swagger 是手寫的

這個專案的 Swagger 寫在 [api/src/docs/openapi.ts](../api/src/docs/openapi.ts)，分成兩部分：

| 部分 | 怎麼來的 | 程式改了會不會自動跟上 |
|---|---|---|
| **資料格式**（交易長什麼樣、新增時要送什麼） | 從 `shared/` 的規則**自動產生**（`toSchema(...)`） | ✅ 會 |
| **路徑、查詢參數、說明文字** | **手寫** | ❌ 不會，要記得手動改 |

實例（2026-10-15）：個人帳加的 `ownerId` 欄位、新增交易的 `scope`，因為在 `shared/` 裡，Swagger 自動就有了；但交易列表、首頁、統計、年度彙整的 `scope` 查詢參數是手寫部分，當時漏了，從 Swagger 看會以為只能查家庭帳（已補上）。**改 route 的查詢參數時，要記得同步改 `openapi.ts`。**

### Q8. `vue3/` 裡的 `constants/`、`mocks/`、`stores/`、`stories/` 是什麼？

這四個都跟 Vue 本身無關，是這個專案**另外加的慣例或工具**。

#### `constants/`：寫死、不會變的值

一般的 `export const`，沒有響應式。目前只有 [constants/icons.ts](../vue3/src/constants/icons.ts)：

```ts
export const CURATED_ICONS = ["restaurant", "apparel", "home", ...];  // 分類可選的圖示
export const MEMBER_COLORS = ["#6b5cf5", "#2bb3d9", ...];             // 成員頭像可選的顏色
```

`IconPicker.vue`、`MembersView.vue` 會用到。獨立出來是為了不讓同一份清單散落在好幾個元件裡。

判斷方式：**執行中永遠不會變** → `constants/`；**會變** → `ref` 或 store。

#### `mocks/`：假後端

讓你**不用開後端和資料庫也能跑前端**。開關在 `.env`：

| 指令 | `.env` 檔 | `VITE_USE_MOCK` | 結果 |
|---|---|---|---|
| `pnpm dev` | `.env.development` | `true` | 用假後端 |
| `pnpm dev:real` | `.env.real` | `false` | 打本機的真後端 |

運作方式在 [main.ts](../vue3/src/main.ts) 開頭：

```ts
if (USE_MOCK) {
  const { installMocks } = await import("./mocks");
  installMocks();      // 把 axios 的 adapter 換成假的
}
createApp(App)...
```

它**不是**另外開一個伺服器，而是把 axios 送出請求的那一層（adapter）換掉。元件和 store 照樣呼叫 `summaryApi.dashboard()`，請求沒送出去就被 [mocks/index.ts](../vue3/src/mocks/index.ts) 攔下、回傳假資料。所以**元件完全不知道接的是真的還是假的**。

- `data.ts`：假資料（成員、分類、2026 年 1～9 月的交易）
- `index.ts`：假的 API，要**模仿真後端的規則**（例如別人的個人帳回 404）。改後端規則時，mock 也要跟著改

注意：**資料存在記憶體，重新整理就重置**；**mock 跑得過不代表真後端沒問題**，規則是各寫一份的。

#### `stores/`：Pinia，全 App 共用的狀態

store 就是**放在元件外面的 `ref`／`computed`**，所有元件拿到的都是**同一份**。寫法跟 `<script setup>` 幾乎一樣。

| 狀態 | 放哪 | 原因 |
|---|---|---|
| 新增頁表單的「金額」 | 元件內 `ref` | 只有這一頁用，離開就丟掉 |
| 目前登入的是誰 | `stores/auth.ts` | 側邊欄、每一頁、API 都要知道 |
| 現在在家庭帳還是個人帳 | `stores/scope.ts` | 側邊欄、頂端列、每一頁的資料、顏色都要跟著它 |

以 [stores/scope.ts](../vue3/src/stores/scope.ts) 為例：

```ts
const selected = ref<ScopeName>(...)                          // 目前選哪本帳
const isPersonal = computed(() => current.value === "personal")
function set(scope) { ... }                                   // 切換，並記住這個帳號的選擇
watch(current, v => document.documentElement.dataset.ledger = v)  // 讓顏色跟著換
```

有 **8 個地方**讀它：側邊欄、切換按鈕、手機頂端列、載入畫面、首頁、統計、年度彙整、「這裡仍是家庭帳」提示。按一下切換，這 8 個地方**同時**更新。不用 store 的話，得一路用 props 往下傳、用 emit 往上傳，很難管。

這個專案的習慣：像 `stores/dashboard.ts` 把「打 API ＋ loading ＋ error」包在一起，頁面只要 `store.load()`，再讀 `store.data`、`store.loading`，不用每頁重寫 try/catch。

#### `stories/`：Storybook，零件展示櫃

Storybook 是一個**獨立的網頁**（`pnpm storybook` → `localhost:6006`），可以**把單一元件拿出來單獨看**，不用進 App、不用登入、不用找到那一頁。

| 在哪 | 是什麼 |
|---|---|
| `src/components/**/*.stories.ts`（26 個） | 跟元件放在一起，例如 `AppButton.stories.ts` 展示按鈕的 5 種樣式、3 種大小 |
| `src/stories/` | 不屬於任何元件的展示：`DesignTokens.stories.ts` ＋ `TokenSheet.vue` 把**所有顏色、字級、間距**列成一張表 |
| `.storybook/` | Storybook 本身的設定（例如幫它裝好 Pinia） |

[AppButton.stories.ts](../vue3/src/components/base/AppButton.stories.ts)：

```ts
const meta = {
  title: "Base/AppButton",                 // 在 Storybook 左側選單的位置
  component: AppButton,
  argTypes: {
    variant: { options: ["primary", "action", "secondary", "ghost", "link"] },  // 可以切換的選項
  },
};
```

打開後右邊有控制面板，點一下就能切換 `variant` 看效果。改元件樣式時可以一次看到所有狀態，也是**設計師和工程師對照**的地方。

### Q9. 為什麼 `.storybook/` 跟 `stories/` 要拆開？

**`.storybook/` 是「展示櫃本身」的設定，`stories/` 是「放進展示櫃的展品」。**

| | `.storybook/` | `stories/`（和 `*.stories.ts`） |
|---|---|---|
| 比喻 | **博物館的管理規則**：燈光怎麼打、展品去哪裡找 | **展品**本身 |
| 多久改一次 | 架好之後幾乎不動 | 每加一個元件就多一個 |
| 誰在改 | 架設 Storybook 的人 | 寫元件的人 |

#### `.storybook/` 裡只有兩個設定檔

[.storybook/main.ts](../vue3/.storybook/main.ts)：告訴 Storybook「**去哪裡找展品**」

```ts
stories: ["../src/**/*.stories.@(ts|tsx)"],   // 整個 src/ 底下，檔名是 .stories.ts 的都算
addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],  // 裝哪些外掛
framework: { name: "@storybook/vue3-vite" },  // 用 Vue3 + Vite
```

[.storybook/preview.ts](../vue3/.storybook/preview.ts)：每個展品**展出前的共同準備**

```ts
import "../src/assets/main.css";      // 載入全站樣式，元件才會有顏色
app.use(createPinia());               // 裝好 Pinia，用到 store 的元件才不會壞
app.component("RouterLink", ...)      // Storybook 沒有 router，把 RouterLink 換成普通 <a>
viewport: { 手機 390、桌機 1280 }     // 可以切換的螢幕尺寸
```

這些都**不是任何一個元件**，而是「讓所有元件都能在 Storybook 裡正常顯示」的環境準備。

#### 為什麼 `.storybook/` 前面有一個點？

1. **這是 Storybook 規定的名字**：啟動時預設去找 `.storybook/`，改名就找不到設定
2. **點開頭是「工具設定」的慣例**：Mac／Linux 預設會隱藏，意思是「給工具看的，平常不用管」。`.claude/`、`.gitignore` 也是一樣

所以 `.storybook/` 放在 `vue3/` 最外層，跟 `vite.config.ts`、`tailwind.config.ts` 這些設定檔一起；展品放在 `src/` 裡，跟程式碼一起。

#### 補充：展品大部分不在 `stories/`

| 放在哪 | 數量 | 是什麼 |
|---|---|---|
| 元件旁邊，例如 `components/base/AppButton.stories.ts` | 26 個 | 某一個元件的展示 |
| `src/stories/` | 1 個 | **不屬於任何元件**的展示（顏色、字級總表） |

**展品放在元件旁邊**，是為了改 `AppButton.vue` 時，展示檔就在隔壁，不會忘記一起改。只有「設計總表」找不到可以跟著的元件，才獨立放在 `src/stories/`。

`main.ts` 的 `"../src/**/*.stories.ts"` 就是在說：**展品放在 `src/` 底下哪裡都找得到**。

### Q10. 改了元件，Storybook 也會跟著改嗎？

**簡單說：大部分會自動跟著改，但有三種情況不會。**

#### ✅ 會自動跟著改

story 是**直接引用你的元件**，不是另外複製一份：

```ts
import AppButton from "./AppButton.vue";   // AppButton.stories.ts 第 2 行
```

改 `AppButton.vue` 的**樣式、文字、邏輯**，Storybook 畫面馬上更新，不用動 story。

#### ❌ 不會自動跟著改的三種情況

| 情況 | 例子 | 要做什麼 |
|---|---|---|
| **1. 加了新的選項** | 按鈕多一種 `variant: "danger"` | story 裡的選項清單是**手寫**的，要自己把 `"danger"` 加進去，不然控制面板點不到 |
| **2. 改名或刪掉 prop** | `variant` 改名成 `kind` | story 還在傳舊的 `variant`，畫面會變成預設樣式或出錯 |
| **3. 新做一個元件** | 新寫一個 `ScopeSwitch.vue` | 不會自動出現，要**另外寫一個 `.stories.ts`** |

#### 這個專案的實際狀況（2026-10-15）

- **元件 44 個，story 只有 26 個**：18 個元件沒有 story，包括個人帳的 `ScopeSwitch.vue`，所以切換按鈕的新樣式在 Storybook 裡看不到
- **設計總表 [TokenSheet.vue](../vue3/src/stories/TokenSheet.vue) 的色碼是手寫的**（例如 `["--canvas", "#f6f4f0", "頁面底色"]`）：改 `tokens.css` 時這張表**不會**跟著變，個人帳的青綠色也不在上面

> **記法：改「元件裡面」→ 自動；改「元件的介面」（有哪些 prop、有哪些選項）或新增元件 → 要手動改 story。**

### Q11. 有了 claude.ai 的 design system，還需要 Storybook 嗎？

**兩個看的是不同的東西，不是互相取代。**

| | claude.ai design system | Storybook |
|---|---|---|
| 是什麼 | **設計圖**：應該長什麼樣子 | **樣品屋**：程式**實際**長什麼樣子 |
| 內容來源 | 設計時畫出來、寫出來的 | 直接執行 `vue3/` 裡真的元件 |
| 程式寫錯了，看得出來嗎 | ❌ 看不出來，它不知道程式怎麼寫 | ✅ 看得出來，畫面就是程式的結果 |
| 主要用途 | 做新設計、出原型、討論長相 | 開發時單獨檢查元件、各種狀態、無障礙檢查 |

**實例（2026-10-15）**：設計稿裡個人帳是綠色，v2.0.0 的程式卻沒做。只看設計稿會以為「有綠色」，只看程式會以為「本來就是紫色」，**兩邊放在一起比對才發現少做了**。Storybook 就是方便拿來跟設計稿對照的那一邊。

#### 建議：留著，但只留「值得的部分」

小專案維護 Storybook 是有成本的（例如當時發現 18 個元件沒有 story、設計總表的顏色沒跟上）。

| 保留 | 原因 |
|---|---|
| ✅ `base/` 的基本元件（按鈕、輸入框、載入圓環…） | 每頁都在用、狀態多，在 App 裡不好一個一個找出來看 |
| ✅ 設計總表（`src/stories/`） | 跟 claude.ai design system 對照最方便 |
| 🟡 頁面級、只用一次的元件 | 不用硬補 story，直接在 App 裡看 |

**什麼時候可以不要 Storybook？** 如果平常都直接在 App 裡看畫面、從沒打開過 Storybook，它就只是維護負擔，拿掉也可以。決定的關鍵是**實際會不會用**，不是「專業的專案都有」。

**能不能從程式碼自動同步到 claude.ai？這個專案不行。** Claude Code 的 `/design-sync` 可以把元件庫上傳到 claude.ai/design，讓設計 AI 直接用真元件組畫面，但它**只支援 React 元件庫**（claude.ai/design 是用 React 畫畫面）。這個專案是 **Vue3**，元件也放在 App 裡、不是獨立套件，所以兩邊只能**人工對照**：改了 `tokens.css` 的顏色，要記得同步改設計稿，反過來也一樣。這也是 Storybook 的設計總表值得留著的原因：它是程式這一側最方便對照的地方。

### Q12. `/design-sync` 是什麼、要怎麼用？

**它把寫好的元件庫搬到 claude.ai/design 給設計 AI 用。** 搬過去之後，在 claude.ai/design 請 AI 設計畫面時，它用的是**你真的元件**（你的按鈕、你的顏色），不是通用的預設元件；設計出來的東西，工程師可以直接照著寫。

#### 使用前要符合的條件

| 條件 | 說明 |
|---|---|
| **React 元件庫** | 必要條件。Vue、Angular 都不行 |
| 有 Storybook 更好 | 會拿 Storybook 的畫面當標準，逐一比對有沒有搬錯 |
| 能正常安裝、打包 | 會用專案自己的指令安裝套件、建置 |
| 登入 claude.ai | 要有權限建立、寫入 claude.ai/design 的專案 |

#### 使用流程

在**元件庫的專案資料夾**打開 Claude Code，輸入 `/design-sync`：

```
① 檢查是不是第一次同步
   └ 第一次：先說明可能要花幾小時，問要不要繼續
② 建立一個新的 claude.ai/design 專案（先問專案名稱）
③ 安裝套件、建置元件庫
④ 每個元件做預覽卡，截圖跟 Storybook 比對，畫錯就修
⑤ 一開始請你同意「一次」上傳權限
   └ 之後每驗證好一批就上傳，可以邊跑邊打開專案看
⑥ 寫一份說明書給設計 AI（元件怎麼包、顏色變數叫什麼）
⑦ 完成後留下 .design-sync/ 設定檔
```

⑦ 的設定檔讓**下一次同步**很快：元件改了再跑一次 `/design-sync`，只處理有變動的元件。

#### 上傳到 claude.ai 的東西

| 上傳的東西 | 給誰用 |
|---|---|
| 打包好的元件程式碼 | 設計 AI：畫畫面時真的拿來用 |
| 顏色、字型、樣式 | 每一張設計圖：外觀才會對 |
| 每個元件的使用說明、參數定義 | 設計 AI：知道怎麼正確使用 |
| 預覽卡 | 人：在專案裡瀏覽有哪些元件 |

#### 這個專案怎麼辦？

這個專案是 **Vue3**，元件也不是獨立套件，`/design-sync` 用不了（2026-10-15 試跑時在檢查階段就停下，沒有建立任何東西）。三條路：

| 做法 | 適合 |
|---|---|
| **① 人工對照**（目前的做法） | 小專案。改顏色時兩邊一起改，用 Storybook 的設計總表對照 |
| ② 在 claude.ai/design 手動建一個 design system，只放顏色、字級等**設計規格**，不放元件 | 想讓設計 AI 至少用對顏色和字級 |
| ③ 把元件改寫成 React | ❌ 不建議，等於重寫整個前端 |

以家用記帳 App 的規模，**① 就夠了**；之後常用 claude.ai/design 出新畫面，再考慮 ②。

#### 以後開 React 專案：先照這 5 點規劃

> 完整版（含 Storybook 是否必要、既有專案怎麼搬）見 [react-component-library-guide.md](react-component-library-guide.md)。

| 情況 | 值得用 `/design-sync` 嗎 |
|---|---|
| 會常用 claude.ai/design 出新畫面、做原型 | ✅ 很值得：設計 AI 直接用你的元件，設計稿等於半成品 |
| 有設計師和工程師兩邊要對照 | ✅ 值得：兩邊看的是同一套元件 |
| 只是自己寫、很少出設計稿 | 🟡 可有可無 |

下面這 5 點**一開始做很簡單、事後補很痛苦**：

| # | 建議 | 為什麼 |
|---|---|---|
| 1 | **元件庫獨立成一個套件**（例如 monorepo 裡的 `packages/ui/`），不要放在 App 的 `src/components/` | 它要打包「元件庫」的成品（`dist/`）；和 App 混在一起就很難單獨打包 |
| 2 | **每個元件都有 Storybook story**，放在元件旁邊 | 拿 Storybook 當標準答案比對；沒有 story 的元件只能拿到陽春的預覽卡 |
| 3 | **顏色、字級做成 CSS 變數**（像現在的 `tokens.css`） | 設計 AI 會照變數名稱用顏色；寫死色碼它只能亂猜 |
| 4 | **用 TypeScript 寫元件的 props** | 會產生每個元件的參數說明書給設計 AI |
| 5 | 元件需要包 Provider（主題、語系）的話，**寫在文件裡** | 設計 AI 不知道要包，畫出來就沒有樣式 |

這個專案已經做到 3 和一部分的 2（`tokens.css`、26 個 story），這些習慣可以直接帶到新專案。

建議的資料夾長相：

```
my-app/
├── packages/
│   └── ui/                  ← 元件庫（/design-sync 在這裡跑）
│       ├── .storybook/
│       ├── src/
│       │   ├── tokens.css   ← 顏色、字級變數
│       │   └── Button/
│       │       ├── Button.tsx
│       │       └── Button.stories.tsx
│       └── dist/            ← 打包成品
├── apps/
│   └── web/                 ← App 本身，引用 packages/ui
└── api/
```

和這個專案的 monorepo 是同一個概念：`packages/ui/` 的角色就像 `shared/`，只是共用的東西從「資料格式」換成「元件」。

### Q13. 所以是把元件也拆成一個 monorepo，讓其他專案也能用？

**方向對，用詞要調整**：不是「拆成一個 monorepo」，而是「**在 monorepo 裡，把元件拆成一個獨立的套件**」。

| 詞 | 是什麼 | 比喻 |
|---|---|---|
| **monorepo** | 整個大資料夾（一個 git 倉庫），裡面裝好幾個套件 | 一棟大樓 |
| **套件**（package） | 大樓裡的一間房，有自己的 `package.json` | 大樓裡的房間 |

元件庫是**大樓裡多隔出來的一間房**（`packages/ui/`），不是另外蓋一棟。這個專案的 `shared/`、`api/`、`vue3/` 就是同一棟大樓裡的三間房。

#### 拆出來之後，誰能用？

| 其他專案在哪 | 能不能用 | 怎麼用 |
|---|---|---|
| **同一個 monorepo 裡**（例如多一個 `apps/admin/`） | ✅ 馬上能用 | 跟 `vue3/` 用 `shared/` 一樣，在 `package.json` 寫上依賴 |
| **另一個 git 倉庫** | 🟡 要多一步 | 把 `packages/ui/` **發布**成套件（npm 或 GitHub Packages），對方 `pnpm add` 安裝（見 Q1 方法 ③） |

#### 兩個目的不一樣

| 目的 | 需要做到哪裡 |
|---|---|
| 讓 `/design-sync` 能用 | 只要拆成**獨立套件、能單獨打包出 `dist/`**，不需要發布 |
| 讓**別的倉庫**也能用 | 還要再**發布**，並管理版本號 |

拆成獨立套件是第一步，兩個目的都需要；要不要發布，等真的有第二個倉庫要用時再決定（Q1 的原則：重複到第三次再抽出來共用）。
