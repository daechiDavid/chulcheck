import { useEffect, useRef, useState } from 'react'

function trimAndClear(source: HTMLImageElement, threshold: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.drawImage(source, 0, 0)
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const i = (y * canvas.width + x) * 4
      const bright = Math.max(data[i], data[i + 1], data[i + 2])
      if (bright >= threshold) data[i + 3] = 0
      else data[i + 3] = 255
      if (data[i + 3] > 0) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  if (maxX < minX || maxY < minY) return canvas.toDataURL('image/png')
  const cut = document.createElement('canvas')
  cut.width = maxX - minX + 1
  cut.height = maxY - minY + 1
  cut.getContext('2d')?.drawImage(canvas, minX, minY, cut.width, cut.height, 0, 0, cut.width, cut.height)
  return cut.toDataURL('image/png')
}

export function SignatureStudio({
  label,
  dataUrl,
  onChange,
}: {
  label: string
  dataUrl: string
  onChange: (value: string) => void
}) {
  const [threshold, setThreshold] = useState(230)
  const source = useRef<HTMLImageElement | null>(null)
  const [preview, setPreview] = useState(dataUrl)

  useEffect(() => setPreview(dataUrl), [dataUrl])

  const apply = (image: HTMLImageElement, value: number) => {
    const next = trimAndClear(image, value)
    setPreview(next)
    onChange(next)
  }

  return (
    <div className="border border-ink/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-lg">{label}</p>
        {preview ? <button type="button" className="text-sm underline" onClick={() => { setPreview(''); onChange('') }}>지우기</button> : null}
      </div>
      <label className="mt-3 block text-sm">
        이미지
        <input
          className="mt-1 block w-full text-sm"
          type="file"
          accept="image/png,image/jpeg"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            const url = URL.createObjectURL(file)
            const image = new Image()
            image.onload = () => {
              source.current = image
              apply(image, threshold)
              URL.revokeObjectURL(url)
            }
            image.src = url
          }}
        />
      </label>
      <label className="mt-3 block text-sm">
        흰 배경 제거 {threshold}
        <input
          className="mt-1 w-full"
          type="range"
          min={180}
          max={254}
          value={threshold}
          onChange={(event) => {
            const value = Number(event.target.value)
            setThreshold(value)
            if (source.current) apply(source.current, value)
          }}
        />
      </label>
      <div className="mt-3 grid h-24 place-items-center bg-[linear-gradient(45deg,#ddd_25%,transparent_25%),linear-gradient(-45deg,#ddd_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#ddd_75%),linear-gradient(-45deg,transparent_75%,#ddd_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0]">
        {preview ? <img src={preview} alt="" className="max-h-20 max-w-full" /> : <span className="text-sm text-ink/50">미리보기</span>}
      </div>
    </div>
  )
}
