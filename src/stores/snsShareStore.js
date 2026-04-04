import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * @typedef {'twitter' | 'instagram' | 'pixiv' | 'artstation' | 'blog' | 'other'} SnsPlatformId
 * @typedef {{ id: string; platform: SnsPlatformId; url: string; customLabel?: string }} SnsChannel
 */

const STORAGE_KEY = 'drawing_planner_sns_channels_v1'

function newId() {
  return `sns-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useSnsShareStore = create(
  persist(
    /** @returns {{ channels: SnsChannel[]; addChannel: (c: Omit<SnsChannel, 'id'>) => void; removeChannel: (id: string) => void }} */
    (set) => ({
      channels: /** @type {SnsChannel[]} */ ([]),

      /** @param {Omit<SnsChannel, 'id'>} channel */
      addChannel: (channel) =>
        set((s) => ({
          channels: [...s.channels, { ...channel, id: newId() }],
        })),

      /** @param {string} id */
      removeChannel: (id) =>
        set((s) => ({
          channels: s.channels.filter((c) => c.id !== id),
        })),
    }),
    { name: STORAGE_KEY },
  ),
)
