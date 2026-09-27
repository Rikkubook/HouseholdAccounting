import { defineStore } from "pinia";
import { ref } from "vue";

export interface Toast {
  message: string;
  tone: "success" | "danger";
}

export const useUiStore = defineStore("ui", () => {
  const toast = ref<Toast | null>(null);
  let timer: number | undefined;

  function flash(message: string, tone: Toast["tone"] = "success") {
    window.clearTimeout(timer);
    toast.value = { message, tone };
    timer = window.setTimeout(() => (toast.value = null), 3000);
  }

  return { toast, flash };
});
