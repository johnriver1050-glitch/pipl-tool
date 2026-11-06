import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { KnowledgeBaseSchema, type KnowledgeBase } from "../schemas";

let _cached: KnowledgeBase | null = null;

export function loadKnowledgeBase(): KnowledgeBase {
  if (_cached) return _cached;

  const kbPath = path.join(process.cwd(), "knowledge-base", "knowledge-base.yaml");

  const raw = fs.readFileSync(kbPath, "utf-8");
  const parsed = yaml.load(raw);

  const result = KnowledgeBaseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `知识库 schema 校验失败:\n${JSON.stringify(result.error.flatten(), null, 2)}`
    );
  }

  _cached = result.data;
  return _cached;
}

/** 测试用：清除缓存，强制重新加载 */
export function clearKbCache() {
  _cached = null;
}
