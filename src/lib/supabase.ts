import {createClient} from '@supabase/supabase-js';
export const SUPABASE_URL='https://angvsuxibbkfscggboum.supabase.co';
export const SUPABASE_KEY='sb_publishable_zOZ9VhtDXAv0TReElbW0OQ_U43SWASP';
export const db=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
