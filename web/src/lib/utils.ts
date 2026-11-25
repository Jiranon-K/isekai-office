import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const TYPE_SCALE_TOKENS = ['page-title', 'section-title', 'body', 'body-strong', 'small', 'caption', 'kbd']

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: TYPE_SCALE_TOKENS }] } }
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
