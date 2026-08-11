declare module 'heic-convert' {
  // libheif-js bajo el capó. Convierte un buffer HEIC/HEIF a JPEG/PNG. Solo declaramos lo que usamos.
  interface ConvertOptions {
    buffer: ArrayBufferLike | Uint8Array
    format: 'JPEG' | 'PNG'
    quality?: number   // 0..1, solo JPEG
  }
  function convert(options: ConvertOptions): Promise<ArrayBuffer>
  export default convert
}
