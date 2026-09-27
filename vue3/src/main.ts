import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { USE_MOCK } from "./api/client";
import "./assets/main.css";

async function bootstrap() {
  if (USE_MOCK) {
    const { installMocks } = await import("./mocks");
    installMocks();
  }
  createApp(App).use(createPinia()).use(router).mount("#app");
}

bootstrap();
