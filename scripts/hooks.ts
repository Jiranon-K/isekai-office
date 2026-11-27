import { join } from 'node:path'
import { hooksSettings } from './hooks-snippet'

const scriptPath = join(import.meta.dir, 'hook.ts')

console.log('วาง JSON นี้ในส่วน "hooks" ของ ~/.claude/settings.json (รวมกับ hooks เดิมที่มีอยู่)')
console.log('คำสั่งนี้แค่พิมพ์ออกมา ไม่แก้ไฟล์ให้\n')
console.log(JSON.stringify(hooksSettings(scriptPath), null, 2))
