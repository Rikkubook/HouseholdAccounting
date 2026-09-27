import { onMounted, onUnmounted, ref, computed } from "vue";

/** 全站唯一斷點：768px。 */
export const MOBILE_BREAKPOINT = 768;

export function useBreakpoint() {
  const width = ref(typeof window === "undefined" ? 1280 : window.innerWidth);
  const onResize = () => (width.value = window.innerWidth);
  onMounted(() => window.addEventListener("resize", onResize));
  onUnmounted(() => window.removeEventListener("resize", onResize));
  return {
    width,
    isMobile: computed(() => width.value < MOBILE_BREAKPOINT),
    isDesktop: computed(() => width.value >= MOBILE_BREAKPOINT),
  };
}
