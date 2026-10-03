import { useRef, useState } from 'react'
import { Button, Input, Modal, message } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { readScriptText } from './scriptImport'

/** Import into the editable draft; only the parent's explicit save persists a chapter. */
export function ScriptInput({ value, onChange, onImported }: {
  value: string
  onChange: (text: string) => void
  onImported: (filename: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)

  /** Validate the complete file before replacing any unsaved text. */
  const importFile = async (file: File) => {
    setReading(true)
    try {
      const text = await readScriptText(file)
      const apply = () => { onChange(text); onImported(file.name.replace(/\.txt$/i, '')) }
      if (value.trim()) Modal.confirm({ title: '替换当前未保存的剧本？', content: '导入文件会替换输入框中的文字。', okText: '替换文字', cancelText: '保留当前内容', onOk: apply })
      else apply()
    } catch (error) {
      message.error(error instanceof Error ? error.message : '读取剧本失败，现有文字已保留。')
    } finally {
      setReading(false)
    }
  }

  return <div className="pa-script-input">
    <input ref={fileInput} type="file" accept=".txt,text/plain" hidden onChange={(event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (file) void importFile(file)
    }} />
    <div className="pa-script-import">
      <Button icon={<UploadOutlined />} loading={reading} onClick={() => fileInput.current?.click()}>选择剧本文件</Button>
      <span>TXT · UTF-8 · 最大 2MB，也可以直接粘贴</span>
    </div>
    <Input.TextArea aria-label="剧本内容" rows={9} disabled={reading} placeholder="在这里粘贴本集完整剧本…" value={value} onChange={(event) => onChange(event.target.value)} />
    <small>{value.length.toLocaleString()} 字符 · 保存后才会进入拆分镜步骤</small>
  </div>
}
