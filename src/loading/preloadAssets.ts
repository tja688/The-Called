import publicAssets from 'virtual:public-assets'

const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'])
const MAX_CONCURRENT_LOADS = 6

function assetUrl(path: string) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${import.meta.env.BASE_URL}${encodedPath}`
}

function extensionOf(path: string) {
  return path.slice(path.lastIndexOf('.') + 1).toLowerCase()
}

function preloadImage(path: string) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      void image.decode?.().catch(() => undefined).finally(resolve)
    }
    image.onerror = () => reject(new Error(`Unable to load image: ${path}`))
    image.src = path
  })
}

async function preloadFile(path: string) {
  const response = await fetch(path, { cache: 'force-cache' })
  if (!response.ok) throw new Error(`Unable to load asset (${response.status}): ${path}`)
  await response.blob()
}

export async function preloadGameAssets(onProgress: (progress: number) => void) {
  const assets = publicAssets.map(assetUrl)
  let completed = 0
  onProgress(0)

  if (assets.length === 0) {
    onProgress(1)
    return
  }

  let nextAssetIndex = 0
  const worker = async () => {
    while (nextAssetIndex < assets.length) {
      const path = assets[nextAssetIndex++]
      try {
        if (IMAGE_EXTENSIONS.has(extensionOf(path))) await preloadImage(path)
        else await preloadFile(path)
      } catch (error) {
        // One optional or damaged asset should not permanently trap the player.
        console.warn('[preload] Asset failed to load', error)
      } finally {
        completed += 1
        onProgress(completed / assets.length)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_LOADS, assets.length) }, worker),
  )
}
