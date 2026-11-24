import { renderUsedIconsModule } from "../build-support/iconData.js";

export default {
  data() {
    return {
      permalink: "/js/iconData.js",
    };
  },

  render() {
    return renderUsedIconsModule();
  },
};
