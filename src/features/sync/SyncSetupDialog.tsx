import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, EyeOff } from 'lucide-react'
import { sha256Hex } from './crypto'

export type SetupDeviceName = 'Phone' | 'Laptop'

type SyncSetupDialogProps = {
  open: boolean
  title?: string
  submitLabel?: string
  initialRoomCode?: string
  initialDeviceName?: SetupDeviceName
  onOpenChange: (open: boolean) => void
  onSubmit: (params: { roomCode: string; deviceName: SetupDeviceName }) => Promise<void>
}

export function SyncSetupDialog({
  open,
  title = 'Set up sync',
  submitLabel = 'Save & Sync',
  initialRoomCode = '',
  initialDeviceName = 'Phone',
  onOpenChange,
  onSubmit,
}: SyncSetupDialogProps) {
  const [roomCode, setRoomCode] = useState('')
  const [deviceName, setDeviceName] = useState<SetupDeviceName>('Phone')
  const [roomTagPreview, setRoomTagPreview] = useState('-----')
  const [isSaving, setIsSaving] = useState(false)
  const [showRoomCode, setShowRoomCode] = useState(false)

  const deviceTagPreview = useMemo(() => `${roomTagPreview}-${deviceName}`, [deviceName, roomTagPreview])

  const refreshRoomTagPreview = async (input: string) => {
    const trimmed = input.trim()
    if (!trimmed) {
      setRoomTagPreview('-----')
      return
    }

    const roomHash = await sha256Hex(trimmed)
    setRoomTagPreview(roomHash.slice(0, 5))
  }

  useEffect(() => {
    if (!open) return

    const prefilledRoomCode = initialRoomCode.trim()
    setRoomCode(prefilledRoomCode)
    setDeviceName(initialDeviceName)
    setShowRoomCode(false)

    void refreshRoomTagPreview(prefilledRoomCode)
  }, [initialDeviceName, initialRoomCode, open])

  const handleSubmit = async () => {
    if (!roomCode.trim()) return

    setIsSaving(true)
    try {
      await onSubmit({
        roomCode: roomCode.trim(),
        deviceName,
      })
      onOpenChange(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <div className='space-y-1'>
            <Label htmlFor='sync-room-code'>Room code</Label>
            <div className='relative'>
              <Input
                id='sync-room-code'
                type={showRoomCode ? 'text' : 'password'}
                value={roomCode}
                onChange={(event) => {
                  setRoomCode(event.target.value)
                  void refreshRoomTagPreview(event.target.value)
                }}
                placeholder='Enter room code'
                autoComplete='off'
              />
              <button
                type='button'
                onClick={() => setShowRoomCode((previous) => !previous)}
                className='absolute right-2 top-1/2 -translate-y-1/2 text-clay'
                aria-label='Toggle room code visibility'
              >
                {showRoomCode ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
              </button>
            </div>
          </div>
          <div className='space-y-1'>
            <Label htmlFor='sync-device-name'>Device name</Label>
            <Select value={deviceName} onValueChange={(value) => setDeviceName(value as SetupDeviceName)}>
              <SelectTrigger id='sync-device-name'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='Phone'>Phone</SelectItem>
                <SelectItem value='Laptop'>Laptop</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='rounded-md border border-clay/25 bg-blush-sand/45 p-2'>
            <p className='text-xs text-clay'>Device tag</p>
            <p className='text-sm font-semibold text-espresso'>{deviceTagPreview}</p>
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button variant='secondary' onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={() => void handleSubmit()} disabled={isSaving || roomCode.trim().length === 0}>
              {isSaving ? 'Saving...' : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
