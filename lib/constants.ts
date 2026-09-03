import { version } from "../package.json" assert { type: "json" };

export const VERSION = version;
declare const __BUILD_ID__: string;
export const BUILD_ID = typeof __BUILD_ID__ === "undefined" ? "source" : __BUILD_ID__;
export const STATUS_STABLE = "stable";
export const STATUS_EXPERIMENTAL = "experimental";
