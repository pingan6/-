/** Read a bounded UTF-8 text file without sending its contents to any service. */
export async function readScriptText(file: { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }): Promise<string> {
  if (!/\.txt$/i.test(file.name)) throw new Error('请选择 TXT 纯文本剧本；其他格式请先复制文字后粘贴。')
  if (file.size > 2 * 1024 * 1024) throw new Error('文件超过 2MB，请按集拆分后导入。')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new Error('文件读取失败，请另存为 UTF-8 编码的 TXT，或直接粘贴剧本文字。')
  }
  if (!text.trim()) throw new Error('文件里没有剧本文字，请选择其他文件。')
  if (text.includes('\u0000')) throw new Error('文件不是可读取的纯文本，请转换成 TXT 后重试。')
  return text
}
