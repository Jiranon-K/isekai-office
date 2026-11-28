import { lazy } from 'react'

export const CommandPanel = lazy(() => import('@/agent/CommandPanel').then((module) => ({ default: module.CommandPanel })))
export const DecisionQueue = lazy(() => import('@/agent/DecisionQueue').then((module) => ({ default: module.DecisionQueue })))
export const HotspotPanels = lazy(() => import('@/room-panels/HotspotPanels').then((module) => ({ default: module.HotspotPanels })))
export const QuestBoard = lazy(() => import('@/board/QuestBoard').then((module) => ({ default: module.QuestBoard })))
export const QuickReply = lazy(() => import('@/agent/QuickReply').then((module) => ({ default: module.QuickReply })))
export const ReplayOverlay = lazy(() => import('@/replay/ReplayOverlay').then((module) => ({ default: module.ReplayOverlay })))
