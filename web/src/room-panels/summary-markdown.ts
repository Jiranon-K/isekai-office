import type { DaySummary } from './summary-logic'
import { busiestHourText, EMPTY_DAY_NOTE, formatDuration, isEmptyDay, isUnwatchedDay, longestWaitText, medianText, spendText, UNWATCHED_NOTE, watchedNote } from './summary-format'

function tableRows(summary: DaySummary): string[] {
  const header = ['| session | ทำงาน | รอ | ครั้งที่รอ |', '| --- | --- | --- | --- |']
  const rows = summary.agents.map((agent) => `| ${agent.title.replaceAll('|', '/')} | ${formatDuration(agent.workingMs)} | ${formatDuration(agent.waitingMs)} | ${agent.waits} |`)
  return [...header, ...rows]
}

function optionalLines(summary: DaySummary): string[] {
  const lines: string[] = []
  const median = medianText(summary)
  const busiest = busiestHourText(summary)
  if (median) {
    lines.push(`- รอครั้งกลาง: ${median}`)
  }
  if (busiest) {
    lines.push(`- ชั่วโมงที่ทำงานมากที่สุด: ${busiest}`)
  }
  const spend = spendText(summary)
  if (spend) {
    lines.push(`- ค่าใช้จ่าย: ${spend}`)
  }
  return lines
}

function unwatchedMarkdown(summary: DaySummary): string {
  return `# สรุปวัน ${summary.date}\n\n- session: ${summary.sessions}\n- เสร็จแล้ว: ${summary.finished}\n\n${UNWATCHED_NOTE}\n`
}

export function toMarkdown(summary: DaySummary): string {
  if (isEmptyDay(summary)) {
    return `# สรุปวัน ${summary.date}\n\n${EMPTY_DAY_NOTE}\n`
  }
  if (isUnwatchedDay(summary)) {
    return unwatchedMarkdown(summary)
  }
  const longest = longestWaitText(summary)
  const lines = [
    `# สรุปวัน ${summary.date}`,
    '',
    `- session: ${summary.sessions}`,
    `- เสร็จแล้ว: ${summary.finished}`,
    `- รอรวม: ${formatDuration(summary.waitingMs)} (${summary.waits} ครั้ง)`,
    `- รอนานที่สุด: ${longest ?? '-'}`,
    ...optionalLines(summary),
    '',
    ...tableRows(summary),
    '',
    `_${watchedNote(summary.watchedMs)}_`
  ]
  return `${lines.join('\n')}\n`
}
