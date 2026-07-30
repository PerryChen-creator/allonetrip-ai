import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals"],
    rules: {
      // 🟢 允許使用原生 <img> 標籤
      "@next/next/no-img-element": "off",
      // 🟢 允許彈性型別
      "@typescript-eslint/no-explicit-any": "off",
      // 🟢 允許 JSX 特殊字元
      "react/no-unescaped-entities": "off",
      // 🟢 忽略未使用的變數
      "@typescript-eslint/no-unused-vars": "off",
    },
  }),
];

export default eslintConfig;