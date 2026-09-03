'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoPerfil, IconoCamara } from '@/components/ui/Iconos'
import { Aviso } from '@/components/ui/Aviso'

/**
 * R-51 (docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md, Fase 5): foto de perfil del
 * estudiante. `profiles.avatar_url` guarda la RUTA dentro del bucket privado
 * `avatars` (migración 071), no una URL pública — son fotos de menores, se
 * muestran con signed URL. El límite de tamaño/tipo también está forzado en
 * el bucket mismo; esta validación en cliente es solo para dar el error al
 * toque en vez de esperar la respuesta del servidor.
 */

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
const TAMANO_MAXIMO = 3 * 1024 * 1024

interface Props {
  uid: string
  rutaInicial: string | null
}

export function FotoPerfil({ uid, rutaInicial }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function mostrarFoto(ruta: string) {
    const { data } = await createClient().storage.from('avatars').createSignedUrl(ruta, 3600)
    if (data) setUrl(data.signedUrl)
  }

  useEffect(() => {
    if (rutaInicial) mostrarFoto(rutaInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutaInicial])

  async function subir(archivo: File) {
    setError(null)

    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      setError('Solo se aceptan fotos en JPG, PNG o WEBP.')
      return
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setError('La foto pesa demasiado. El máximo es 3 MB.')
      return
    }

    setSubiendo(true)
    const supabase = createClient()
    const extension = archivo.type === 'image/png' ? 'png' : archivo.type === 'image/webp' ? 'webp' : 'jpg'
    const ruta = `${uid}/avatar.${extension}`

    const { error: falloSubida } = await supabase.storage
      .from('avatars')
      .upload(ruta, archivo, { contentType: archivo.type, upsert: true })

    if (falloSubida) {
      setError('No se pudo subir la foto. Intenta de nuevo.')
      setSubiendo(false)
      return
    }

    const { error: falloPerfil } = await supabase
      .from('profiles')
      .update({ avatar_url: ruta })
      .eq('id', uid)

    if (falloPerfil) {
      setError('La foto se subió pero no se pudo guardar en tu perfil. Intenta de nuevo.')
      setSubiendo(false)
      return
    }

    await mostrarFoto(ruta)
    setSubiendo(false)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="group relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-zr-border bg-zr-surface text-zr-text-muted disabled:opacity-60"
      >
        {url ? (
          <img src={url} alt="Tu foto de perfil" className="h-full w-full object-cover" />
        ) : (
          <IconoPerfil size={40} />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-active:opacity-100">
          <IconoCamara size={26} className="text-white" />
        </span>
      </button>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="text-sm font-semibold text-zr-blue disabled:opacity-60"
      >
        {subiendo ? 'Subiendo…' : url ? 'Cambiar foto' : 'Agregar foto'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) subir(archivo)
        }}
      />

      {error && <Aviso tipo="error">{error}</Aviso>}
    </div>
  )
}
