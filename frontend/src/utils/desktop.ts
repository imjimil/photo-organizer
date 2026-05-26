import { open } from '@tauri-apps/plugin-dialog'
import { isDesktopShell } from '../api/client'

export async function pickPhotoFolder(): Promise<string | null> {
  if (!isDesktopShell()) return null
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose a photo folder',
  })
  if (typeof selected === 'string') return selected
  return null
}

export async function revealPath(path: string): Promise<void> {
  if (!isDesktopShell()) return
  const { invoke } = await import('@tauri-apps/api/core')
  await invoke('reveal_in_file_manager', { path })
}
