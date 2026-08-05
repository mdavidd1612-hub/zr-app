import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "http://127.0.0.1:54321";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const usuarios = [
  {
    cedula: "V-12345678",
    email: "v12345678@estudiante.zrmecademy.com",
    fullName: "Juan Carlos Pérez",
    phone: "+58 412 1234567",
  },
  {
    cedula: "E-87654321",
    email: "e87654321@estudiante.zrmecademy.com",
    fullName: "María José García",
    phone: "+58 414 9876543",
  },
  {
    cedula: "V-11111111",
    email: "v11111111@estudiante.zrmecademy.com",
    fullName: "Carlos Antonio López",
    phone: "+58 416 5555555",
  },
];

async function crearPerfiles() {
  console.log("🔄 Creando perfiles de prueba...\n");

  for (const usuario of usuarios) {
    try {
      // Buscar el usuario por email
      const { data: users } = await supabase.auth.admin.listUsers();
      const foundUser = users?.users.find(u => u.email === usuario.email);

      if (!foundUser) {
        console.error(`❌ No se encontró usuario auth para ${usuario.cedula}`);
        continue;
      }

      // Crear perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: foundUser.id,
          cedula: usuario.cedula,
          full_name: usuario.fullName,
          phone: usuario.phone,
          contact_email: usuario.email,
          role: "estudiante",
        })
        .select()
        .single();

      if (profileError) {
        if (profileError.message.includes("duplicate")) {
          console.log(`⏭️  Perfil ya existe para ${usuario.cedula}`);
        } else {
          console.error(`❌ Error creando perfil para ${usuario.cedula}:`, profileError.message);
        }
        continue;
      }

      console.log(`✅ Perfil creado para ${usuario.cedula}`);
    } catch (err) {
      console.error(`❌ Error inesperado para ${usuario.cedula}:`, err.message);
    }
  }

  console.log("\n🎉 ¡Perfiles procesados!");
}

crearPerfiles();
