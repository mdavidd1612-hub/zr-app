import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = "http://127.0.0.1:54321";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function seedDB() {
  console.log("🔄 Leyendo seed.sql...");
  const seedSQL = fs.readFileSync("supabase/seed/seed_dev.sql", "utf-8");

  console.log("🔄 Ejecutando seed...");
  const { data, error } = await supabase.rpc("exec_sql", { sql: seedSQL }).catch(() => ({
    error: "exec_sql no disponible, usando método alternativo"
  }));

  if (error) {
    console.log("ℹ️  exec_sql no disponible. Creando usuarios manualmente...");
    
    // Crear usuarios de prueba simples
    const usuarios = [
      { cedula: "V-30000001", email: "v30000001@test.com", nombre: "Juan Carlos Pérez" },
      { cedula: "V-30000002", email: "v30000002@test.com", nombre: "María José García" },
    ];

    for (const u of usuarios) {
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: "Prueba123!",
        email_confirm: true,
      });

      if (authErr) {
        console.error(`❌ ${u.cedula}:`, authErr.message);
        continue;
      }

      const { error: profileErr } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          cedula: u.cedula,
          full_name: u.nombre,
          contact_email: u.email,
          role: "estudiante",
        });

      if (profileErr) {
        console.error(`❌ Perfil ${u.cedula}:`, profileErr.message);
      } else {
        console.log(`✅ ${u.cedula} creado`);
      }
    }
  } else {
    console.log("✅ Seed ejecutado");
  }
}

seedDB();
