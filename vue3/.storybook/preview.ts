import { setup, type Preview } from "@storybook/vue3";
import { h } from "vue";
import { createPinia } from "pinia";
import "../src/assets/main.css";

/** 全站唯一斷點 768px，因此只提供手機與桌機兩個 viewport。 */
export const VIEWPORTS = {
  mobile: { name: "手機 390", styles: { width: "390px", height: "844px" } },
  desktop: { name: "桌機 1280", styles: { width: "1280px", height: "900px" } },
};

setup((app) => {
  app.use(createPinia());
  // 元件內的 <RouterLink> 在 Storybook 沒有 router，改為渲染成純 <a>
  app.component("RouterLink", {
    props: { to: { type: [String, Object], default: "#" } },
    setup: (props, { slots }) => () =>
      h("a", { href: typeof props.to === "string" ? props.to : "#" }, slots.default?.()),
  });
});

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: {
      default: "canvas",
      values: [
        { name: "canvas", value: "#f6f4f0" },
        { name: "surface", value: "#ffffff" },
      ],
    },
    viewport: { viewports: VIEWPORTS, defaultViewport: "desktop" },
    a11y: { config: { rules: [{ id: "color-contrast", enabled: true }] } },
    options: { storySort: { order: ["Design Tokens", "Base", "Data", "*"] } },
  },
  tags: ["autodocs"],
};

export default preview;
