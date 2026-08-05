"use client"

import { useRouter, usePathname } from "next/navigation"
import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

export default function ProfesorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile?.role !== "profesor" && profile?.role !== "admin" && profile?.role !== "super_admin") {
        router.push("/")
      }
    }

    checkRole()
  }, [])

  return (
    <div className="flex bg-zr-background min-h-dvh">
      <nav className="w-64 border-r border-zr-border px-6 py-8 space-y-2">
        <h1 className="text-2xl font-bold text-zr-text mb-8">Panel Profesor</h1>
        {[
          { href: "/profesor/hoy", label: "Hoy" },
          { href: "/profesor/examenes", label: "Exámenes" },
          { href: "/profesor/calificar", label: "Calificar" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={`block px-4 py-3 rounded-lg font-medium transition-all ${"'"}{
              pathname === item.href
                ? "bg-zr-blue text-white"
                : "text-zr-text hover:bg-zr-surface"
            }${"'"}`}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
