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
    password: "Test123!*",
    fullName: "Juan Carlos Pérez",
    phone: "+58 412 1234567",
    dateOfBirth: "2002-03-15", // 22 años
  },
  {
    cedula: "E-87654321",
    email: "e87654321@estudiante.zrmecademy.com",
    password: "Test123!*",
    fullName: "María José García",
    phone: "+58 414 9876543",
    dateOfBirth: "2005-07-22", // 19 años
  },
  {
    cedula: "V-11111111",
    email: "v11111111@estudiante.zrmecademy.com",
    password: "Test123!*",
    fullName: "Carlos Antonio López",
    phone: "+58 416 5555555",
    dateOfBirth: "2009-01-10", // 17 años (menor)
  },
];

async function crearUsuarios() {
  console.log("🔄 Creando usuarios de prueba...\n");

  for (const usuario of usuarios) {
    try {
      // 1. Crear usuario en Auth
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: usuario.email,
        password: usuario.password,
        email_confirm: true,
      });

      if (authError) {
        console.error(`❌ Error creando auth para ${usuario.cedula}:`, authError.message);
        continue;
      }

      console.log(`✅ Auth creado para ${usuario.cedula}`);

      // 2. Crear perfil
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: authUser.user.id,
          cedula: usuario.cedula,
          full_name: usuario.fullName,
          phone: usuario.phone,
          date_of_birth: usuario.dateOfBirth,
          role: "estudiante",
          consent_status: usuario.dateOfBirth.includes("2009") ? "pendiente" : "completado",
        })
        .select()
        .single();

      if (profileError) {
        console.error(`❌ Error creando perfil para ${usuario.cedula}:`, profileError.message);
        continue;
      }

      console.log(`✅ Perfil creado para ${usuario.cedula}\n`);
    } catch (err) {
      console.error(`❌ Error inesperado para ${usuario.cedula}:`, err.message);
    }
  }

  console.log("🎉 ¡Usuarios de prueba creados!");
}

crearUsuarios();
