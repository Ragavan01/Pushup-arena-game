import { createClient } from '@supabase/supabase-js';

// Pull the secure keys from your newly created .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Export the connected client so we can use it anywhere in the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);