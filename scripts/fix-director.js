const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://obtjhfoffpskzvkbsgnv.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!key) {
  console.error("❌ ERROR: SUPABASE_SERVICE_ROLE_KEY no está configurada.");
  process.exit(1);
}

const supabaseAdmin = createClient(url, key, { auth: { persistSession: false } });

async function run() {
  console.log("Fixing director01 auth account...");
  try {
    const username = "director01";
    const pin = "310315";
    const email = "director01@crc.qrono.local"; // Using standard .qrono.local as seen in virgi's case

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pin,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes("already exists")) {
        console.log("Auth user already exists. Fetching...");
        // If already exists in auth, find the user
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const user = usersData.users.find(u => u.email === email);
        if (user) {
          console.log("Found user ID:", user.id);
          const { error: updateError } = await supabaseAdmin
            .from("personal")
            .update({ auth_user_id: user.id })
            .eq("username", username);
          
          if (updateError) console.error("Error updating personal:", updateError);
          else console.log("✅ Successfully linked existing auth user to director01!");
        } else {
          console.error("Could not find user in list");
        }
      } else {
        console.error("❌ Error creating auth user:", authError);
      }
      return;
    }

    const userId = authData.user.id;
    console.log(`✅ Auth user created with ID: ${userId}`);

    // 2. Update personal table
    const { error: updateError } = await supabaseAdmin
      .from("personal")
      .update({ auth_user_id: userId })
      .eq("username", username);

    if (updateError) {
      console.error("❌ Error updating personal table:", updateError);
    } else {
      console.log("✅ Successfully linked auth user to director01!");
    }

  } catch (err) {
    console.error("❌ Exception:", err);
  }
}

run();
