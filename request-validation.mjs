export function validateImageDataUrl(value) {
  if (typeof value !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/i.test(value)) {
    throw new Error('只接受 JPEG、PNG 或 WebP Data URL')
  }
  if (value.length > 10_500_000) throw new Error('图像超过 8 MB 安全上限')
  return value
}

