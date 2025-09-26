import { supabase } from "@/integrations/supabase/client";

export interface TriggerBriefOptions {
  force?: boolean;
  notes?: string;
  workerUrl?: string;
}

export interface TriggerBriefResponse {
  success: boolean;
  message?: string;
  result?: any;
  error?: string;
}

/**
 * Manually trigger market brief generation via Supabase edge function
 */
export const triggerMarketBrief = async (options: TriggerBriefOptions = {}): Promise<TriggerBriefResponse> => {
  try {
    console.log('Triggering market brief generation with options:', options);
    
    const { data, error } = await supabase.functions.invoke('trigger-market-brief', {
      body: {
        force: options.force || false,
        notes: options.notes || `Manual generation triggered at ${new Date().toLocaleString()}`,
        workerUrl: options.workerUrl // Optional: specify your Cloudflare worker URL
      }
    });

    if (error) {
      console.error('Supabase function error:', error);
      throw new Error(`Supabase function error: ${error.message}`);
    }

    console.log('Market brief generation response:', data);
    return data as TriggerBriefResponse;

  } catch (error) {
    console.error('Failed to trigger market brief generation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

/**
 * Quick trigger function with default options
 */
export const quickTriggerBrief = () => {
  return triggerMarketBrief({
    force: true,
    notes: 'Quick manual generation'
  });
};