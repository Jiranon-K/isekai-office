import {
  Alert02Icon,
  ArrowReloadHorizontalIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CastleIcon,
  CheckmarkCircle02Icon,
  ComputerTerminal01Icon,
  DrinkIcon,
  FlowerIcon,
  GitMergeIcon,
  KanbanIcon,
  Leaf01Icon,
  LinkSquare02Icon,
  Loading03Icon,
  Moon02Icon,
  Notification01Icon,
  NotificationBlock01Icon,
  Robot01Icon,
  SentIcon,
  StopIcon,
  Sun03Icon,
  WifiOff01Icon
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

type IconProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, 'icon'>

function makeIcon(icon: IconSvgElement) {
  return function Icon({ className, strokeWidth = 1.5, ...props }: IconProps) {
    return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} aria-hidden="true" className={cn('size-4', className)} {...props} />
  }
}

export const AlertIcon = makeIcon(Alert02Icon)
export const RefreshIcon = makeIcon(ArrowReloadHorizontalIcon)
export const XIcon = makeIcon(Cancel01Icon)
export const DenyIcon = makeIcon(CancelCircleIcon)
export const KeepIcon = makeIcon(CastleIcon)
export const AllowIcon = makeIcon(CheckmarkCircle02Icon)
export const TerminalIcon = makeIcon(ComputerTerminal01Icon)
export const TavernIcon = makeIcon(DrinkIcon)
export const MeadowIcon = makeIcon(FlowerIcon)
export const MergeIcon = makeIcon(GitMergeIcon)
export const BoardIcon = makeIcon(KanbanIcon)
export const GroveIcon = makeIcon(Leaf01Icon)
export const ExternalLinkIcon = makeIcon(LinkSquare02Icon)
export const LoaderCircleIcon = makeIcon(Loading03Icon)
export const MoonIcon = makeIcon(Moon02Icon)
export const AlertsOnIcon = makeIcon(Notification01Icon)
export const AlertsOffIcon = makeIcon(NotificationBlock01Icon)
export const AgentIcon = makeIcon(Robot01Icon)
export const SendIcon = makeIcon(SentIcon)
export const StopIcon2 = makeIcon(StopIcon)
export const SunIcon = makeIcon(Sun03Icon)
export const OfflineIcon = makeIcon(WifiOff01Icon)
