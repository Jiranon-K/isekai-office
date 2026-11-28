import { READ_ONLY_REASON } from '@/lib/source-caps'

const COMMAND_FAILURES = new Map<string, string>([
  ['pending_decision', 'ตอบ อนุญาต หรือ ปฏิเสธ ก่อนจึงส่งข้อความต่อได้'],
  ['read_only_source', READ_ONLY_REASON],
  ['no_pending_prompt', 'ไม่มีคำขออนุญาตค้างอยู่แล้ว ลองรีเฟรชดู'],
  ['no_terminal', 'session นี้ยังรับคำสั่งจากที่นี่ไม่ได้'],
  ['empty_prompt', 'ยังไม่มีข้อความให้ส่ง'],
  ['server_unreachable', 'ติดต่อ server ไม่ได้ ลองใหม่อีกครั้ง']
])

const GENERIC_FAILURE = 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'

export function commandFailureText(reason: string): string {
  return COMMAND_FAILURES.get(reason) ?? GENERIC_FAILURE
}
