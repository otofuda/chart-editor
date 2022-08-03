import Vue from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";

Vue.config.productionTip = false;

declare module "vue/types/vue" {
  interface Vue {
    // TODO
    $vuetify: string;
  }
}

new Vue({
  // @ts-ignore
  vuetify,
  render: h => h(App)
}).$mount("#app");
