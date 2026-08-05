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

async function check() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Total users: ${users?.users.length || 0}\n`);
  if (users?.users) {
    users.users.forEach(u => {
      console.log(`Email: ${u.email}, ID: ${u.id}`);
    });
  }
}

check();
