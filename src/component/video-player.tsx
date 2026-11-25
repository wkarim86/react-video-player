
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

export type VideoPlayerProps = {
  src: string
  poster?: string
  title?: string
  date?: string
  className?: string
  autoPlay?: boolean
  showDuration?: boolean
  showControls?: boolean
  enableFloatingPlayer?: boolean
}

type DisplayMode = 'thumbnail' | 'modal' | 'floating'

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '00:00'

  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

const VideoPlayer = ({
  src,
  poster,
  title = 'Featured video',
  date = '3 days ago',
  className = '',
  autoPlay = false,
  showDuration = false,
  showControls = true,
  enableFloatingPlayer = true,
}: VideoPlayerProps) => {
  const playerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // The original thumbnail location.
  const inlineMountRef = useRef<HTMLDivElement>(null)

  // The modal location.
  const modalMountRef = useRef<HTMLDivElement>(null)

  // Persistent portal host. Moving this DOM node does not recreate
  // the video element rendered inside it.
  const [portalHost, setPortalHost] =
    useState<HTMLDivElement | null>(null)

  const [mode, setMode] = useState<DisplayMode>('thumbnail')

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState('')

  // Create one persistent portal host after mounting.
  useEffect(() => {
    const host = document.createElement('div')

    host.style.display = 'contents'

    setPortalHost(host)

    return () => {
      host.remove()
    }
  }, [])

  // Move the SAME player DOM host between its different locations.
  useEffect(() => {
    if (!portalHost) return

    let target: HTMLElement | null = null

    if (mode === 'thumbnail') {
      target = inlineMountRef.current
    } else if (mode === 'modal') {
      target = modalMountRef.current
    } else {
      target = document.body
    }

    if (target && portalHost.parentElement !== target) {
      target.appendChild(portalHost)
    }
  }, [mode, portalHost])

  // Sync native fullscreen state.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        document.fullscreenElement === playerRef.current
      )
    }

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    )

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      )
    }
  }, [])

  // Lock page scrolling while the modal is open.
  useEffect(() => {
    if (mode !== 'modal') return

    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mode])

  // Escape closes the modal. Native fullscreen handles its own Escape.
  useEffect(() => {
    if (mode !== 'modal' || isFullscreen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode('thumbnail')
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mode, isFullscreen])

  // Automatically switch to the floating player when the post
  // scrolls outside the viewport.
  useEffect(() => {
    if (!enableFloatingPlayer) return

    const anchor = inlineMountRef.current

    if (!anchor) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return

        if (!entry.isIntersecting) {
          if (isPlaying && mode === 'thumbnail') {
            setMode('floating')
          }
        } else {
          if (mode === 'floating') {
            setMode('thumbnail')
          }
        }
      },
      {
        threshold: 0.1,
      }
    )

    observer.observe(anchor)

    return () => observer.disconnect()
  }, [isPlaying, mode, enableFloatingPlayer])

  // Playback.
  const togglePlay = useCallback(async () => {
    const video = videoRef.current

    if (!video) return

    if (video.paused) {
      try {
        await video.play()
        setError('')
      } catch {
        setIsPlaying(false)
        setError('Unable to play this video.')
      }
    } else {
      video.pause()
    }
  }, [])

  // Volume.
  const toggleMute = useCallback(() => {
    const video = videoRef.current

    if (!video) return

    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [])

  // Seek.
  const seek = (value: number) => {
    const video = videoRef.current

    if (!video || !Number.isFinite(video.duration)) return

    const nextTime = Math.max(
      0,
      Math.min(value, video.duration)
    )

    video.currentTime = nextTime
    setProgress(nextTime)
  }

  // Open native browser fullscreen.
  const enterFullscreen = useCallback(async () => {
    const player = playerRef.current

    if (!player) return

    try {
      if (player.requestFullscreen) {
        await player.requestFullscreen()
      } else {
        setError('Fullscreen is not supported by this browser.')
      }
    } catch {
      setError('Unable to enter fullscreen mode.')
    }
  }, [])

  // Exit native browser fullscreen.
  const exitFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return

    try {
      await document.exitFullscreen()
    } catch {
      setError('Unable to exit fullscreen mode.')
    }
  }, [])

  // Close modal and return to thumbnail.
  const closeModal = useCallback(async () => {
    if (document.fullscreenElement === playerRef.current) {
      await exitFullscreen()
    }

    setMode('thumbnail')
  }, [exitFullscreen])

  // Thumbnail -> Modal -> Native Fullscreen.
  const toggleFullscreen = () => {
    if (isFullscreen) {
      exitFullscreen()
      return
    }

    if (mode === 'thumbnail' || mode === 'floating') {
      setMode('modal')
      return
    }

    if (mode === 'modal') {
      enterFullscreen()
    }
  }

  // Floating player close.
  const closeFloatingPlayer = () => {
    videoRef.current?.pause()
    setMode('thumbnail')
  }

  // Return to modal from floating player.
  const expandFloatingPlayer = () => {
    setMode('modal')
  }

  // Video state.
  const handleTimeUpdate = (
    event: React.SyntheticEvent<HTMLVideoElement>
  ) => {
    setProgress(event.currentTarget.currentTime)
  }

  // Player markup.
  const player = (
    <div
      ref={playerRef}
      className={[
        'group relative flex flex-col overflow-hidden',
        'bg-black text-white',

        // Thumbnail.
        mode === 'thumbnail'
          ? [
              'h-full w-full aspect-video rounded-[24px]',
              'shadow-[0_24px_60px_rgba(22,25,29,0.16)]',
            ].join(' ')
          : '',

        // Modal.
        mode === 'modal'
          ? 'h-full w-full rounded-[24px] shadow-2xl'
          : '',

        // Floating YouTube-style mini player.
        mode === 'floating'
          ? [
              '!fixed !bottom-4 !right-4',
              '!left-auto !top-auto',
              '!z-[999999]',
              '!w-[min(360px,calc(100vw-2rem))]',
              '!h-auto !aspect-video',
              '!rounded-2xl',
              '!shadow-[0_12px_50px_rgba(0,0,0,0.5)]',
            ].join(' ')
          : '',

        // Native fullscreen.
        '[&:fullscreen]:!fixed',
        '[&:fullscreen]:!inset-0',
        '[&:fullscreen]:!z-[1000000]',
        '[&:fullscreen]:!h-dvh',
        '[&:fullscreen]:!w-screen',
        '[&:fullscreen]:!max-h-none',
        '[&:fullscreen]:!max-w-none',
        '[&:fullscreen]:!rounded-none',
        '[&:fullscreen]:!p-5',
        '[&:fullscreen]:!bg-black',
        '[&:fullscreen]:!shadow-none',
        '[&::backdrop]:bg-black/95',

        className,
      ].join(' ')}
      role={mode === 'modal' || isFullscreen ? 'dialog' : undefined}
      aria-modal={
        mode === 'modal' || isFullscreen || undefined
      }
      aria-label={title}
    >
      {/* Modal / Fullscreen header */}
      {(mode === 'modal' || isFullscreen) && (
        <header className="z-20 flex shrink-0 items-center justify-between gap-4 rounded-t-[32px] overflow-hidden bg-neutral-50 dark:bg-neutral-600 p-[20px]">
          <div className="w-full flex flex-col gap-[2px] min-w-0">
            <h2 className="truncate text-[18px] m-0 text-black dark:text-white font-medium tracking-tight">
              {title}
            </h2>

            <p className="text-[12px] text-black dark:text-white m-0">
              {date}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="flex w-[40px] h-[40px] bg-gray-100 dark:bg-gray-600 p-0 border-none shrink-0 items-center justify-center rounded-full"
            aria-label="Close video"
          >
            <span className="material-symbols-rounded text-[24px] text-black dark:text-white">
              close
            </span>
          </button>
        </header>
      )}

      {/* Video container */}
      <div
        className={[
          'relative min-h-0 flex-1 overflow-hidden',
          mode === 'thumbnail'
            ? 'size-full'
            : 'bg-black rounded-b-[32px]',
        ].join(' ')}
      >
        <video
          ref={videoRef}
          className={[
            'absolute inset-0 size-full cursor-pointer bg-black',
            mode === 'thumbnail'
              ? 'object-cover'
              : 'object-contain',
          ].join(' ')}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          autoPlay={autoPlay}
          onClick={togglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0)
          }}
          onDurationChange={(event) => {
            setDuration(event.currentTarget.duration || 0)
          }}
          onVolumeChange={(event) => {
            setIsMuted(event.currentTarget.muted)
          }}
          onEnded={() => setIsPlaying(false)}
          onError={() => {
            setError('Unable to load this video.')
          }}
          aria-label={title}
        />

        {/* Gradient overlay */}
        <div
          className={[
            'pointer-events-none absolute inset-0',
            'bg-gradient-to-t from-black/75 via-transparent to-black/10',
            'transition-opacity duration-300',
            isFullscreen || mode !== 'thumbnail'
              ? 'opacity-100'
              : 'opacity-80 group-hover:opacity-100',
          ].join(' ')}
          aria-hidden="true"
        />

        {/* Floating player top actions */}
        {mode === 'floating' && (
          <div className="absolute right-2 top-2 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={expandFloatingPlayer}
              className="flex w-[36px] h-[36px] items-center justify-center rounded-full bg-black/60 border-none text-white backdrop-blur-sm transition hover:bg-black/90"
              aria-label="Expand video"
            >
              <span className="material-symbols-rounded text-[22px]">
                fullscreen
              </span>
            </button>

            <button
              type="button"
              onClick={closeFloatingPlayer}
              className="flex w-[36px] h-[36px] items-center justify-center rounded-full bg-black/60 border-none text-white backdrop-blur-sm transition hover:bg-black/90"
              aria-label="Close floating player"
            >
              <span className="material-symbols-rounded text-[22px]">
                close
              </span>
            </button>
          </div>
        )}

        {/* Center play / pause */}
        <button
          type="button"
          onClick={togglePlay}
          className={[
            'absolute left-1/2 top-1/2 z-10',
            'flex w-[48px] h-[48px] -translate-x-1/2 -translate-y-1/2',
            'items-center justify-center rounded-full',
            'bg-white dark:bg-neutral-600 text-black dark:text-white',
            'transition-all duration-300 ease-out',
            'hover:scale-110 hover:bg-white',
            'focus-visible:outline-2 focus-visible:outline-white',
            'border-none',
            isPlaying
              ? 'pointer-events-none scale-90 opacity-0 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
              : 'scale-100 opacity-100',
          ].join(' ')}
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          <span className="material-symbols-rounded text-[28px] fill-icon">
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
        </button>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg bg-black/80 px-4 py-2 text-center text-xs text-white"
          >
            {error}
          </div>
        )}

        {/* Player controls */}
        {showControls && (
          <div
            className={[
              'absolute inset-x-0 bottom-0 z-20',
              'flex items-center gap-[10px] px-3 pb-3 pt-8 sm:gap-3 sm:px-5 sm:pb-4',
              'transition-all duration-300 ease-in-out',
              'opacity-0 translate-y-2',
              'group-hover:translate-y-0 group-hover:opacity-100',
              'group-focus-within:translate-y-0 group-focus-within:opacity-100',
              '[@media(hover:none)]:translate-y-0',
              '[@media(hover:none)]:opacity-100',
              mode !== 'thumbnail'
                ? '!translate-y-0 !opacity-100'
                : '',
            ].join(' ')}
          >
            {/* Play / Pause */}
            <button
              type="button"
              onClick={togglePlay}
              className="flex w-[40px] h-[40px] bg-transparent p-0 border-none shrink-0 items-center justify-center rounded text-white transition"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              <span className="material-symbols-rounded text-[24px] fill-icon">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Current time */}
            <span className="w-10 shrink-0 text-xs tabular-nums text-white">
              {formatTime(progress)}
            </span>

            {/* Progress */}
            <input
              className={[
                'h-1 min-w-0 flex-1 cursor-pointer appearance-none',
                'rounded-full bg-white/40 accent-white',
                'transition-all duration-200 hover:h-1.5',
                'focus-visible:outline-2 focus-visible:outline-offset-4',
                'focus-visible:outline-white',
                '[&::-webkit-slider-thumb]:size-3.5',
                '[&::-webkit-slider-thumb]:appearance-none',
                '[&::-webkit-slider-thumb]:rounded-full',
                '[&::-webkit-slider-thumb]:bg-white',
                '[&::-moz-range-thumb]:size-3.5',
                '[&::-moz-range-thumb]:rounded-full',
                '[&::-moz-range-thumb]:border-0',
                '[&::-moz-range-thumb]:bg-white',
              ].join(' ')}
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={progress}
              onChange={(event) => seek(Number(event.target.value))}
              aria-label="Video progress"
              disabled={!Number.isFinite(duration) || !duration}
            />

            {/* Duration */}
            {showDuration && (
              <span className="w-10 shrink-0 text-right text-xs tabular-nums text-white">
                {formatTime(duration)}
              </span>
            )}

            {/* Mute */}
            <button
              type="button"
              onClick={toggleMute}
              className="flex w-[40px] h-[40px] bg-transparent p-0 border-none shrink-0 items-center justify-center rounded text-white transition"
              aria-label={isMuted ? 'Unmute video' : 'Mute video'}
            >
              <span className="material-symbols-rounded text-[23px]">
                {isMuted ? 'volume_off' : 'volume_up'}
              </span>
            </button>

            {/* Fullscreen / Modal */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex w-[40px] h-[40px] bg-transparent p-0 border-none shrink-0 items-center justify-center rounded text-white transition"
              aria-label={
                isFullscreen
                  ? 'Exit fullscreen'
                  : mode === 'thumbnail'
                    ? 'Open video modal'
                    : 'Enter fullscreen'
              }
            >
              <span className="material-symbols-rounded text-[24px]">
                {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Thumbnail placeholder / original post location */}
      <div
        ref={inlineMountRef}
        className="relative w-full aspect-video"
      />

      {/* Render player into its persistent DOM host */}
      {portalHost && createPortal(player, portalHost)}

      {/* Modal backdrop */}
      {mode === 'modal' &&
        createPortal(
          <div
            className={[
              'fixed inset-0 z-[999998]',
              'flex items-center justify-center',
              'bg-black/85 backdrop-blur-sm',
              'p-3 sm:p-6',
              'animate-in fade-in duration-200',
            ].join(' ')}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeModal()
              }
            }}
            role="presentation"
          >
            <div
              ref={modalMountRef}
              className={[
                'w-full max-w-8xl',
                'h-[min(95vh,720px)]',
                'min-h-0',
              ].join(' ')}
            />
          </div>,
          document.body
        )}
    </>
  )
}

export default VideoPlayer
