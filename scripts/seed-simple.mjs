import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "http://127.0.0.1:54321";
const serviceRoleKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  const usuarios = [
    { cedula: "V-30000001", email: "v30000001@test.com", nombre: "Juan Carlos" },
    { cedula: "V-30000002", email: "v30000002@test.com", nombre: "María García" },
  ];

  for (const u of usuarios) {
    try {
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: u.email,
        password: "Prueba123!",
        email_confirm: true,
      });

      if (authErr) {
        console.log(`⏭️  ${u.cedula}: ${authErr.message}`);
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

      console.log(profileErr ? `❌ ${u.cedula}: ${profileErr.message}` : `✅ ${u.cedula}`);
    } catch (err) {
      console.error(`❌ ${u.cedula}:`, err.message);
    }
  }
}

seed();
