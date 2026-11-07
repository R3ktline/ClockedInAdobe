import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets phones/laptops on the local network load the dev server (HMR etc.).
  // shortcut: private IPv4 ranges only, widen if the demo network uses another range.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.16.*.*"],
  // Only the routes the script-tag adapter (public/babel.js) calls are open to other sites. The adapter posts
  // text/plain, a "simple" request, so no preflight is needed. Merchant, debug and insights routes stay same-origin.
  async headers() {
    const cors = [{ key: "Access-Control-Allow-Origin", value: "*" }];
    return ["/api/visit", "/api/events", "/api/slide", "/api/forget", "/babel.js"].map((source) => ({ source, headers: cors }));
  },
};

export default config;
