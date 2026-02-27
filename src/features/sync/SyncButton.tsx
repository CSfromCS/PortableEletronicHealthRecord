import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Cloud, CloudOff, Loader2, RefreshCw, TriangleAlert, XCircle } from 'lucide-react'

export type SyncStatus = 'not-configured' | 'idle' | 'syncing' | 'success' | 'conflict' | 'error'

type SyncButtonProps = {
  status: SyncStatus
  onClick: () => void
  disabled?: boolean
  lastSyncedAt?: string | null
}

const getStatusMeta = (status: SyncStatus) => {
  switch (status) {
    case 'not-configured':
      return {
        icon: CloudOff,
        label: 'Set up sync',
        badgeLabel: 'Off',
        badgeClassName: 'bg-clay/15 text-clay border-clay/30',
      }
    case 'syncing':
      return {
        icon: Loader2,
        label: 'Syncing…',
        badgeLabel: 'Syncing',
        badgeClassName: 'bg-action-edit/15 text-action-edit border-action-edit/30',
      }
    case 'success':
      return {
        icon: CheckCircle2,
        label: 'Synced',
        badgeLabel: 'OK',
        badgeClassName: 'bg-green-100 text-green-700 border-green-200',
      }
    case 'conflict':
      return {
        icon: TriangleAlert,
        label: 'Resolve conflict',
        badgeLabel: 'Conflict',
        badgeClassName: 'bg-amber-100 text-amber-700 border-amber-200',
      }
    case 'error':
      return {
        icon: XCircle,
        label: 'Retry sync',
        badgeLabel: 'Error',
        badgeClassName: 'bg-red-100 text-red-700 border-red-200',
      }
    default:
      return {
        icon: Cloud,
        label: 'Sync now',
        badgeLabel: 'Ready',
        badgeClassName: 'bg-action-primary/15 text-action-primary border-action-primary/30',
      }
  }
}

export function SyncButton({ status, onClick, disabled, lastSyncedAt }: SyncButtonProps) {
  const meta = getStatusMeta(status)
  const Icon = meta.icon
  const lastSyncedLabel = lastSyncedAt
    ? `Last ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Not synced yet'

  return (
    <Button
      type='button'
      variant={status === 'error' ? 'destructive' : status === 'conflict' ? 'secondary' : 'outline'}
      size='sm'
      className='gap-2 border-clay/35'
      onClick={onClick}
      disabled={disabled || status === 'syncing'}
    >
      <Icon className={`h-4 w-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
      <span className='hidden sm:inline'>{meta.label}</span>
      <span className='sm:hidden'><RefreshCw className='h-3.5 w-3.5' /></span>
      <Badge className={meta.badgeClassName}>{meta.badgeLabel}</Badge>
      <span className='hidden lg:inline text-[11px] text-clay'>{lastSyncedLabel}</span>
    </Button>
  )
}
