import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import type { RenderedDocument } from "../templates/render";

/** 将 "text with **bold** parts" 拆为 TextRun 数组 */
function parseInline(text: string, baseOptions: { size?: number } = {}): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, ...baseOptions }));
    } else if (part) {
      runs.push(new TextRun({ text: part, ...baseOptions }));
    }
  }
  return runs;
}

/** 将 bodyZh / bodyEn Markdown 字符串转为 Paragraph 数组 */
function parseBody(body: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(line.slice(2))] })
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(line.slice(3))] })
      );
    } else if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(line.slice(4))] })
      );
    } else if (line.startsWith("- ")) {
      paragraphs.push(
        new Paragraph({ bullet: { level: 0 }, children: parseInline(line.slice(2)) })
      );
    } else if (line === "") {
      paragraphs.push(new Paragraph({ children: [] }));
    } else {
      paragraphs.push(new Paragraph({ children: parseInline(line) }));
    }
  }
  return paragraphs;
}

/**
 * 将 RenderedDocument 序列化为 DOCX Buffer。
 * 可直接写入文件或通过 Next.js Route Handler 返回给浏览器。
 */
export async function renderToDocx(doc: RenderedDocument): Promise<Buffer> {
  const sections: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: doc.titleZh, bold: true })],
    }),
    new Paragraph({ children: [] }),
    ...parseBody(doc.bodyZh),
  ];

  if (doc.bodyEn) {
    sections.push(
      new Paragraph({ children: [] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("English Version")],
      }),
      ...parseBody(doc.bodyEn)
    );
  }

  sections.push(
    new Paragraph({ children: [] }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${doc.disclaimer} (知识库版本 ${doc.kbVersion})`,
          italics: true,
          size: 18,
          color: "888888",
        }),
      ],
    })
  );

  const wordDoc = new Document({
    sections: [{ properties: {}, children: sections }],
  });

  return Buffer.from(await Packer.toBuffer(wordDoc));
}
