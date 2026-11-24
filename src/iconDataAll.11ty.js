import { renderAllIconsModule } from "../build-support/iconData.js";

export default {
  data() {
    return {
      permalink: "/js/iconDataAll.js",
    };
  },

  render() {
    return renderAllIconsModule();
  },
};
