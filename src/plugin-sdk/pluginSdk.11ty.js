export default {
  data() {
    return {
      permalink: (data) => `/plugin-sdk/${data.pluginSdk.fileName}`,
    };
  },

  render(data) {
    return data.pluginSdk.code;
  },
};
