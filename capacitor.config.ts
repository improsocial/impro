import { CapacitorConfig } from "@capacitor/cli";

const localIp = process.env.LOCAL_IP;

const config = <CapacitorConfig>{
  appId: "social.impro",
  appName: "Impro",
  webDir: "build",
  ios: {
    backgroundColor: "#1a1a1a",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "DARK",
      backgroundColor: "#1a1a1a",
    },
  },
};

if (process.env.NODE_ENV === "development") {
  config.server = {
    // https://capacitorjs.com/docs/guides/live-reload
    url: `http://${localIp}:8080`,
    cleartext: true,
  };
}

export default config;
