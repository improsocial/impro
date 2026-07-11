export default {
  data() {
    return {
      permalink: "/version.json",
    };
  },

  render(data) {
    return JSON.stringify({ version: data.version }, null, 2);
  },
};
