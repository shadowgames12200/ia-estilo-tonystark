import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";

// Inicialização robusta: só cria o cliente se as URLs existirem
export const supabase = (ENV.supabaseUrl && ENV.supabaseAnonKey) 
  ? createClient(ENV.supabaseUrl, ENV.supabaseAnonKey)
  : null as any;
