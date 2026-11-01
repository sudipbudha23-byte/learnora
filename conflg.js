
import { createClient } from
  "https://dmffdlujlmffozgkohcg.supabase.co";

const SUPABASE_URL = "sb_secret_8j17tsXqvD-evXpug9tm7g_fcpavM1Q";
const SUPABASE_ANON_KEY = "sb_publishable_8rXrJYH3hGqfopTyGZf_Kw_4Nf2fLc7";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
