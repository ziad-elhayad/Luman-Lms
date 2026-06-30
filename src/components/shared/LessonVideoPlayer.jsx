import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import {
  checkVideoUrlAccessible,
  getMediaErrorMessage,
  getVideoPlaybackUrl,
  isYouTubeEmbedUrl,
  logVideoPlaybackError,
} from '@/lib/videoPlayback'

export function LessonVideoPlayer({ video, className = '', onError }) {
  const [playbackUrl, setPlaybackUrl] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setStatus('loading')
    setErrorMessage('')

    const url = getVideoPlaybackUrl(video)
    if (!url) {
      logVideoPlaybackError(video, 'resolve', { reason: 'missing video_url and public_id' })
      setPlaybackUrl(null)
      setErrorMessage('Video URL is missing from this record.')
      setStatus('error')
      onError?.('Video URL is missing from this record.')
      return
    }

    setPlaybackUrl(url)
    setStatus('ready')

    if (!isYouTubeEmbedUrl(url)) {
      checkVideoUrlAccessible(url).then((check) => {
        if (!check.ok) {
          logVideoPlaybackError(video, 'url-check-warning', {
            resolvedUrl: url,
            httpStatus: check.status,
            checkError: check.error,
          })
        }
      })
    }
  }, [video, onError])

  const handleVideoError = (event) => {
    const mediaError = event.currentTarget?.error
    const message = getMediaErrorMessage(mediaError)
    logVideoPlaybackError(video, 'html5-error', {
      resolvedUrl: playbackUrl,
      mediaErrorCode: mediaError?.code,
      mediaErrorMessage: message,
    })
    setErrorMessage(message)
    setStatus('error')
    onError?.(message)
  }

  if (status === 'loading') {
    return (
      <div className={`flex aspect-video items-center justify-center bg-black text-sm text-white/70 ${className}`}>
        Loading video…
      </div>
    )
  }

  if (status === 'error' || !playbackUrl) {
    return (
      <div className={`flex aspect-video flex-col items-center justify-center gap-2 bg-black px-4 text-center ${className}`}>
        <AlertCircle className="h-8 w-8 text-white/50" />
        <p className="text-sm font-medium text-white/80">Video not available</p>
        <p className="text-xs text-white/50">{errorMessage || 'Unable to play this video.'}</p>
      </div>
    )
  }

  if (isYouTubeEmbedUrl(playbackUrl)) {
    return (
      <iframe
        src={playbackUrl}
        title={video?.title || 'Lesson video'}
        className={`aspect-video w-full ${className}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <video
      key={playbackUrl}
      src={playbackUrl}
      controls
      autoPlay
      playsInline
      preload="metadata"
      className={`aspect-video w-full bg-black ${className}`}
      onError={handleVideoError}
    />
  )
}
