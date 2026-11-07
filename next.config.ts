import type { NextConfig } from "next";

const config: NextConfig = {
  // Lets phones/laptops on the local network load the dev server (HMR etc.).
  // shortcut: private IPv4 ranges only, widen if the demo network uses another range.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.16.*.*"],
};

export default config;
