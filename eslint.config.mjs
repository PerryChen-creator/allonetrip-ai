import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // 🟢 允許使用原生 <img> 標籤（適合動態圖片與 Base64 預覽）
      "@next/next/no-img-element": "off",
      // 🟢 允許彈性的型別設定
      "@typescript-eslint/no-explicit-any": "off",
      // 🟢 允許 JSX 中的特殊字元
      "react/no-unescaped-entities": "off",
      // 🟢 忽略未使用的變數警告
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];

export default eslintConfig;