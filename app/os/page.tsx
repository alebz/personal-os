import { redirect } from 'next/navigation'

// El OS de tambor ahora vive en la raíz `/`. Mantenemos /os como redirect
// para no romper links ni bookmarks viejos.
export default function OsRedirect() {
  redirect('/')
}
