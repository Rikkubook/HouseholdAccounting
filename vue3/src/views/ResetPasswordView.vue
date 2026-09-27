<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { authApi } from "@/api/auth";
import { normalizeError } from "@/api/client";
import passCover from "@/assets/images/pass-cover.png";

const account = ref("");
const code = ref("");
const pw1 = ref("");
const pw2 = ref("");
const show = ref(false);
const loading = ref(false);
const done = ref(false);
const error = ref("");

async function submit() {
  if (loading.value) return;
  if (!account.value.trim() || !code.value || !pw1.value || !pw2.value) return (error.value = "請完整填寫所有欄位");
  if (pw1.value.length < 4) return (error.value = "新密碼至少 4 位");
  if (pw1.value !== pw2.value) return (error.value = "兩次輸入的新密碼不一致");
  loading.value = true;
  error.value = "";
  try {
    await authApi.resetPassword(account.value.trim(), code.value, pw1.value);
    done.value = true;
  } catch (e) {
    // 不區分帳號錯與碼錯，避免帳號探測
    error.value = normalizeError(e).message || "帳號或重設碼不正確";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-0">
    <div class="w-full max-w-[1040px] bg-surface md:grid md:grid-cols-2 overflow-hidden shadow-dialog">
      <div
        class="relative h-[230px] md:h-[640px] bg-surface-muted overflow-hidden bg-cover bg-center"
        :style="{ backgroundImage: `url(${passCover})` }"
      >
        <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,20,38,.55),rgba(16,20,38,0)_62%)]" />
        <div class="absolute left-0 right-0 top-10 md:top-14 flex justify-center pointer-events-none">
          <div class="font-mono text-[26px] md:text-[34px] tracking-[0.3em] text-fg-brand pl-[0.3em]">RESET</div>
        </div>
      </div>

      <div class="px-6 py-8 md:px-[68px] md:py-16 flex flex-col">
        <template v-if="done">
          <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center">
            <div class="w-14 h-14 rounded-pill bg-action-tint flex items-center justify-center text-action-600">
              <span class="material-symbols-rounded text-[30px]">check_circle</span>
            </div>
            <div class="text-[19px] font-bold text-fg-1">密碼已更新</div>
            <div class="text-[12.5px] text-fg-3 leading-loose">重設碼已失效，請用新密碼登入</div>
            <RouterLink
              to="/login"
              class="mt-2 h-12 px-7 rounded-md bg-fg-1 text-fg-brand flex items-center text-[14.5px] font-bold"
            >
              前往登入
            </RouterLink>
          </div>
        </template>

        <template v-else>
          <h1 class="text-title md:text-[28px] font-bold text-fg-1 text-center m-0">設定新密碼</h1>
          <p class="mt-2.5 text-[12px] text-fg-3 text-center m-0">請輸入管理者提供的 6 位重設碼</p>

          <p v-if="error" class="mt-5 text-[12.5px] text-danger text-center m-0">{{ error }}</p>

          <form class="mt-8 flex flex-col gap-7" @submit.prevent="submit">
            <input
              v-model="account"
              placeholder="帳號"
              class="h-11 border-0 border-b border-b-strong bg-transparent text-[16px] text-fg-1 outline-none px-0.5"
            />
            <input
              :value="code"
              inputmode="numeric"
              maxlength="6"
              placeholder="000000"
              class="h-11 border-0 border-b border-b-strong bg-transparent font-mono text-[19px] tracking-[0.34em] text-fg-1 outline-none px-0.5"
              @input="code = ($event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6)"
            />
            <div class="relative">
              <input
                v-model="pw1"
                :type="show ? 'text' : 'password'"
                placeholder="新密碼（至少 4 位）"
                class="w-full h-11 border-0 border-b border-b-strong bg-transparent text-[16px] text-fg-1 outline-none pl-0.5 pr-11 box-border"
              />
              <button
                type="button"
                aria-label="顯示或隱藏密碼"
                class="absolute right-0 top-0 w-hit h-hit flex items-center justify-center text-fg-3 cursor-pointer"
                @click="show = !show"
              >
                <span class="material-symbols-rounded text-[19px]">{{ show ? "visibility_off" : "visibility" }}</span>
              </button>
            </div>
            <input
              v-model="pw2"
              :type="show ? 'text' : 'password'"
              placeholder="再次輸入新密碼"
              class="h-11 border-0 border-b border-b-strong bg-transparent text-[16px] text-fg-1 outline-none px-0.5"
            />

            <button
              type="submit"
              :disabled="loading"
              class="h-12 rounded-md bg-fg-1 text-fg-brand text-[14.5px] font-bold cursor-pointer disabled:opacity-70"
            >
              {{ loading ? "更新中…" : "更新密碼" }}
            </button>
          </form>

          <div class="mt-auto pt-10 text-center text-[11.5px] text-fg-3 leading-loose">
            沒有重設碼？請聯繫家庭管理者產生<br />
            <RouterLink to="/login">返回登入</RouterLink>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
