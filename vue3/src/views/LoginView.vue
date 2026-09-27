<script setup lang="ts">
import { ref } from "vue";
import { RouterLink } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import loginCover from "@/assets/images/login-cover.png";

const auth = useAuthStore();
const account = ref("");
const password = ref("");
const show = ref(false);
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-0">
    <div class="w-full max-w-[1040px] bg-surface md:grid md:grid-cols-2 overflow-hidden shadow-dialog">
      <div
        class="relative h-[230px] md:h-[640px] bg-surface-muted overflow-hidden bg-cover bg-center"
        :style="{ backgroundImage: `url(${loginCover})` }"
      >
        <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,20,38,.55),rgba(16,20,38,0)_62%)]" />
        <div class="absolute left-0 right-0 top-10 md:top-14 flex justify-center pointer-events-none">
          <div class="font-mono text-[26px] md:text-[34px] tracking-[0.3em] text-fg-brand pl-[0.3em]">FAMILY LEDGER</div>
        </div>
      </div>

      <div class="px-6 py-8 md:px-[68px] md:py-16 flex flex-col">
        <h1 class="text-title md:text-[28px] font-bold text-fg-1 text-center m-0">歡迎回來</h1>
        <p class="mt-2.5 text-[12px] text-fg-3 text-center m-0">請以家庭帳號登入</p>

        <p v-if="auth.error" class="mt-5 text-[12.5px] text-danger text-center m-0">{{ auth.error }}</p>

        <form class="mt-8 flex flex-col gap-7" @submit.prevent="auth.login(account, password)">
          <input
            v-model="account"
            placeholder="帳號"
            class="h-11 border-0 border-b bg-transparent text-[16px] text-fg-1 outline-none px-0.5"
            :class="auth.error ? 'border-b-[#c9718f]' : 'border-b-strong'"
          />
          <div class="relative">
            <input
              v-model="password"
              :type="show ? 'text' : 'password'"
              placeholder="密碼"
              class="w-full h-11 border-0 border-b bg-transparent text-[16px] text-fg-1 outline-none pl-0.5 pr-11 box-border"
              :class="auth.error ? 'border-b-[#c9718f]' : 'border-b-strong'"
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

          <RouterLink to="/reset-password" class="text-[11.5px] text-brand-500 font-medium text-right">
            忘記密碼？
          </RouterLink>

          <button
            type="submit"
            :disabled="auth.loading"
            class="h-12 rounded-md bg-fg-1 text-fg-brand text-[14.5px] font-bold cursor-pointer disabled:opacity-70"
          >
            {{ auth.loading ? "登入中…" : "登入" }}
          </button>
        </form>

        <div class="mt-auto pt-10 text-center text-[11.5px] text-fg-3 leading-loose">
          首次登入起 6 個月內免重新登入<br />
          帳號請聯繫家庭管理者建立
        </div>
      </div>
    </div>
  </div>
</template>
