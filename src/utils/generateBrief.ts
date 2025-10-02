import { supabase } from "@/integrations/supabase/client";

export async function triggerBriefGeneration() {
  console.log('🚀 Triggering brief generation with LunarCrush API...');
  
  const { data, error } = await supabase.functions.invoke('generate-daily-brief', {
    body: { briefType: 'premarket' }
  });
  
  if (error) {
    console.error('❌ Brief generation failed:', error);
    throw error;
  }
  
  console.log('✅ Brief generated successfully:', data);
  return data;
}
