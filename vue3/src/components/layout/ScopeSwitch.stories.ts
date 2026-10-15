import type { Meta, StoryObj } from "@storybook/vue3";
import { defineComponent, h, provide, reactive } from "vue";
import { createMemoryHistory, createRouter, routeLocationKey, routerKey } from "vue-router";
import ScopeSwitch from "./ScopeSwitch.vue";
import { useScopeStore, type ScopeName } from "@/stores/scope";

/**
 * 家庭帳／個人帳切換：選中的一格白底、品牌色粗體。
 * 切換會改 <html data-ledger>，整個 Storybook 的品牌色會跟著換成青綠，可以直接看到效果。
 */

// Storybook 沒有 router；ScopeSwitch 停在成員頁才會換頁，這裡給一個不會真的換頁的 router
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/:p(.*)*", component: { render: () => null } }] });

const withRouter = (story: () => unknown) =>
  defineComponent({
    setup() {
      provide(routerKey, router);
      provide(routeLocationKey, reactive({ name: "dashboard" }) as never);
      return () => h(story() as never);
    },
  });

const meta = {
  title: "Layout/ScopeSwitch",
  component: ScopeSwitch,
  decorators: [withRouter],
  parameters: { layout: "padded" },
  render: (_args, { parameters }) => ({
    components: { ScopeSwitch },
    setup() {
      useScopeStore().set((parameters.ledger as ScopeName) ?? "family");
    },
    template: '<div style="width: 196px"><ScopeSwitch /></div>',
  }),
} satisfies Meta<typeof ScopeSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const 家庭帳: Story = { parameters: { ledger: "family" } };
export const 個人帳: Story = { parameters: { ledger: "personal" } };
