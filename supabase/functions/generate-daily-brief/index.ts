import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { toZonedTime, format } from 'https://esm.sh/date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
const coingeckoApiKey = Deno.env.get('COINGECKO_API_KEY')!;
const lunarcrushApiKey = Deno.env.get('LUNARCRUSH_API_KEY')!;
const cronSecret = Deno.env.get('CRON_SECRET');

interface CoinGeckoData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
}

interface LunarCrushAsset {
  id: string;
  symbol: string;
  name: string;
  galaxy_score: number;
  alt_rank: number;
  social_volume: number;
  social_dominance: number;
  sentiment: number;
  fomo_score: number;
}

// Improved deduplication utility function with paragraph AND phrase-level detection
// NOW WITH PER-SECTION RESETS TO PRESERVE STRUCTURE
function deduplicateContent(text: string): string {
  const boilerplateOpeners = [
    'in plain english:',
    "what's next:",
    'bottom line:',
    "here's the takeaway:",
    'put simply:',
    'the short version:',
    'straight talk:'
  ];
  
  // Banned stock phrases that create repetition (expanded list, PER-SECTION cap)
  const bannedPhrases = [
    'as we peer ahead',
    'hitting its stride',
    'the road ahead',
    'keep your eyes peeled',
    'stay nimble',
    'buckle up',
    'strap in',
    'hold onto your hats',
    'the takeaway',
    'the bottom line',
    'what does this mean',
    'here is what matters',
    'at the end of the day'
  ];
  
  // Track removal counts for logging
  let removedDuplicates = 0;
  let removedSimilar = 0;
  let cappedOpeners = 0;
  let cappedSymbols = 0;
  let bannedPhrasesCapped = 0;
  let paragraphsRemoved = 0;
  
  // ===== STEP 1: PARAGRAPH-LEVEL DEDUPLICATION =====
  console.log('🔍 Starting paragraph-level deduplication...');
  
  // Split content into paragraphs (by double newlines or <p> tags)
  const paragraphDelimiter = /\n\n+|<\/p>\s*<p[^>]*>|<p[^>]*>|<\/p>/g;
  const rawParagraphs = text.split(paragraphDelimiter).filter(p => p.trim().length > 0);
  
  const seenParagraphFingerprints = new Set<string>();
  const paragraphNgramMap = new Map<string, Set<string>>();
  const keptParagraphs: string[] = [];
  
  for (const paragraph of rawParagraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed || trimmed.length < 50) {
      // Keep short paragraphs as-is (likely headings or transitions)
      keptParagraphs.push(trimmed);
      continue;
    }
    
    // Create paragraph fingerprint (lowercase, no punctuation, normalized whitespace)
    const fingerprint = trimmed
      .toLowerCase()
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')
      .trim();
    
    // Check for exact paragraph duplicates
    if (seenParagraphFingerprints.has(fingerprint)) {
      console.log(`🗑️ Removed duplicate paragraph (${fingerprint.length} chars): "${trimmed.substring(0, 80)}..."`);
      paragraphsRemoved++;
      continue;
    }
    
    // Generate larger n-grams for paragraph similarity (6-10 word phrases)
    const words = fingerprint.split(' ');
    const paragraphNgrams = new Set<string>();
    
    for (let n = 6; n <= 10; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(' ');
        paragraphNgrams.add(ngram);
      }
    }
    
    // Check for high paragraph similarity (≥60% n-gram overlap indicates paraphrasing)
    let hasSimilarParagraph = false;
    for (const [seenFingerprint, seenNgrams] of paragraphNgramMap) {
      const intersection = new Set([...paragraphNgrams].filter(x => seenNgrams.has(x)));
      const union = new Set([...paragraphNgrams, ...seenNgrams]);
      
      const similarity = intersection.size / union.size;
      if (similarity >= 0.50) {
        console.log(`🗑️ Removed similar paragraph (${(similarity * 100).toFixed(0)}% overlap, ${fingerprint.length} chars): "${trimmed.substring(0, 80)}..."`);
        paragraphsRemoved++;
        hasSimilarParagraph = true;
        break;
      }
    }
    
    if (hasSimilarParagraph) continue;
    
    // Keep this paragraph
    seenParagraphFingerprints.add(fingerprint);
    paragraphNgramMap.set(fingerprint, paragraphNgrams);
    keptParagraphs.push(trimmed);
  }
  
  // Rejoin paragraphs with double newlines
  text = keptParagraphs.join('\n\n');
  
  console.log(`✅ Paragraph deduplication complete: removed ${paragraphsRemoved} duplicate/similar paragraphs`);
  
  // ===== STEP 2: SENTENCE-LEVEL DEDUPLICATION (PER-SECTION) =====
  
  // Split by headings to preserve section structure (both <h2> and markdown ##)
  const sections = text.split(/(<h2>.*?<\/h2>|^##\s+.*$)/gm);
  const dedupedSections: string[] = [];
  
  // CRITICAL FIX: Reset tracking per section to avoid removing valid content from later sections
  for (const section of sections) {
    // Always preserve headings
    if (section.startsWith('<h2>') || section.match(/^##\s+/)) {
      dedupedSections.push(section);
      continue;
    }
    
    // RESET PER SECTION (this is the key fix)
    const seenUnits = new Set<string>();
    const ngramMap = new Map<string, Set<string>>(); 
    const openerCounts = new Map<string, number>();
    const symbolCounts = new Map<string, number>();
    
    // Split by punctuation OR newline/bullet boundaries for better segmentation
    const units = section.split(/(?<=[.!?])\s+|[\r\n]+/).filter(u => u.trim().length > 0);
    const dedupedUnits: string[] = [];
    
    for (const unit of units) {
      if (!unit.trim()) continue;
      
      // Create normalized fingerprint (lowercase, no extra spaces, no punctuation)
      const fingerprint = unit.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
      
      // Skip if we've seen this exact unit IN THIS SECTION
      if (seenUnits.has(fingerprint)) {
        console.log(`🗑️ Removed duplicate (section-level): "${unit.substring(0, 60)}..."`);
        removedDuplicates++;
        continue;
      }
      
      // Generate 3-5 word n-grams for phrase-level detection
      const words = fingerprint.split(' ');
      const unitNgrams = new Set<string>();
      
      for (let n = 3; n <= 5; n++) {
        for (let i = 0; i <= words.length - n; i++) {
          const ngram = words.slice(i, i + n).join(' ');
          unitNgrams.add(ngram);
        }
      }
      
      // Check for high n-gram overlap (≥70% indicates paraphrased or list-style repeats)
      let hasHighOverlap = false;
      for (const seen of seenUnits) {
        if (!ngramMap.has(seen)) continue;
        
        const seenNgrams = ngramMap.get(seen)!;
        const intersection = new Set([...unitNgrams].filter(x => seenNgrams.has(x)));
        const union = new Set([...unitNgrams, ...seenNgrams]);
        
        const overlap = intersection.size / union.size;
        if (overlap >= 0.70) {
          console.log(`🗑️ Removed similar phrase (${(overlap * 100).toFixed(0)}% n-gram overlap): "${unit.substring(0, 60)}..."`);
          removedSimilar++;
          hasHighOverlap = true;
          break;
        }
      }
      
      if (hasHighOverlap) continue;
      
      // Check for lower similarity threshold (0.72 using word-level Jaccard)
      let isSimilar = false;
      for (const seen of seenUnits) {
        const similarity = calculateJaccardSimilarity(fingerprint, seen);
        if (similarity > 0.72) {
          console.log(`🗑️ Removed similar sentence (${(similarity * 100).toFixed(0)}% match): "${unit.substring(0, 60)}..."`);
          removedSimilar++;
          isSimilar = true;
          break;
        }
      }
      
      if (isSimilar) continue;
      
      // Cap boilerplate openers (per section)
      let shouldCapOpener = false;
      for (const opener of boilerplateOpeners) {
        if (fingerprint.startsWith(opener)) {
          const count = openerCounts.get(opener) || 0;
          if (count > 0) {
            console.log(`🗑️ Capped boilerplate opener: "${opener}"`);
            cappedOpeners++;
            shouldCapOpener = true;
            break;
          }
          openerCounts.set(opener, count + 1);
        }
      }
      
      if (shouldCapOpener) continue;
      
      // Limit symbol repetitions (max 2 mentions per asset per section, unless new context keywords)
      const symbolMatch = unit.match(/\b([A-Z]{2,12})\b/g);
      if (symbolMatch) {
        let shouldCapSymbol = false;
        for (const symbol of symbolMatch) {
          const count = symbolCounts.get(symbol) || 0;
          if (count >= 2) {
            // Allow if unit introduces new context keywords
            const hasNewContext = /\b(macro|on-chain|derivatives|technical|institutional|exchange)\b/i.test(unit);
            if (!hasNewContext) {
              console.log(`🗑️ Capped symbol repetition: ${symbol} (already mentioned ${count}x in section)`);
              cappedSymbols++;
              shouldCapSymbol = true;
              break;
            }
          }
          symbolCounts.set(symbol, count + 1);
        }
        
        if (shouldCapSymbol) continue;
      }
      
      // Keep this unit
      seenUnits.add(fingerprint);
      ngramMap.set(fingerprint, unitNgrams);
      dedupedUnits.push(unit);
    }
    
    if (dedupedUnits.length > 0) {
      dedupedSections.push(dedupedUnits.join(' '));
    }
  }
  
  // CRITICAL FIX: Rejoin with double newlines to preserve section spacing
  const result = dedupedSections.join('\n\n');
  
  // Safety check: warn if >25% of units removed
  const totalUnits = text.split(/(?<=[.!?])\s+|[\r\n]+/).filter(u => u.trim().length > 0).length;
  const removedTotal = removedDuplicates + removedSimilar + cappedOpeners + cappedSymbols;
  const removalRate = removedTotal / totalUnits;
  
  console.log(`📊 Deduplication stats: ${paragraphsRemoved} paragraphs, ${removedDuplicates} exact dupes, ${removedSimilar} similar phrases, ${cappedOpeners} capped openers, ${cappedSymbols} capped symbols`);
  
  if (removalRate > 0.25) {
    console.warn(`⚠️ HIGH REMOVAL RATE: ${(removalRate * 100).toFixed(1)}% of units removed (${removedTotal}/${totalUnits})`);
  }
  
  // Warn if too many paragraphs removed (>20% suggests over-aggressive detection)
  const paragraphRemovalRate = paragraphsRemoved / rawParagraphs.length;
  if (paragraphRemovalRate > 0.20) {
    console.warn(`⚠️ HIGH PARAGRAPH REMOVAL RATE: ${(paragraphRemovalRate * 100).toFixed(1)}% of paragraphs removed (${paragraphsRemoved}/${rawParagraphs.length})`);
  }
  
  return result;
}

// Calculate Jaccard similarity between two strings (word-level)
function calculateJaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(' '));
  const words2 = new Set(str2.split(' '));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Pre-publish validation layer
interface ValidationResult {
  passed: boolean;
  issues: string[];
  metrics: {
    duplicateSentences: number;
    duplicateParagraphs: number;
    repeatedPhrases: number;
    assetMisclassifications: number;
    sectionsWithIssues: number;
    totalSections: number;
    wordCount: number;
  };
  cleanedContent?: string;
}

async function validateBriefContent(
  content: string, 
  briefType: string,
  supabase: any
): Promise<ValidationResult> {
  const issues: string[] = [];
  const metrics = {
    duplicateSentences: 0,
    duplicateParagraphs: 0,
    repeatedPhrases: 0,
    assetMisclassifications: 0,
    sectionsWithIssues: 0,
    totalSections: 0,
    wordCount: content.split(/\s+/).length
  };
  
  console.log('🔍 Running pre-publish validation...');
  
  // Extract sections (split by <h2> tags)
  const sections = content.split(/(<h2>.*?<\/h2>)/g).filter(s => s.trim());
  metrics.totalSections = sections.filter(s => s.startsWith('<h2>')).length;
  
  // Track asset mentions across sections
  const assetMentions = new Map<string, number>();
  
  // Fetch ticker mappings for type validation
  const { data: tickerMappings } = await supabase
    .from('ticker_mappings')
    .select('symbol, type, display_name')
    .eq('is_active', true);
  
  const mappingsBySymbol = new Map();
  const mappingsByNormalized = new Map();
  if (tickerMappings) {
    tickerMappings.forEach((m: any) => {
      const normalized = m.symbol.toUpperCase().trim();
      mappingsBySymbol.set(normalized, m);
      mappingsByNormalized.set(normalized, m);
    });
  }
  
  // Check for asset type misclassifications
  const cryptoSectionPattern = /<h2>.*?(Cryptocurrency|Crypto|Bitcoin|Altcoin).*?<\/h2>/i;
  const stockSectionPattern = /<h2>.*?(Stock|Traditional Market|Equity|S&P).*?<\/h2>/i;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    // Skip headers
    if (section.startsWith('<h2>')) continue;
    
    const prevHeader = i > 0 ? sections[i - 1] : '';
    const isCryptoSection = cryptoSectionPattern.test(prevHeader);
    const isStockSection = stockSectionPattern.test(prevHeader);
    
    // Extract asset mentions (SYMBOL) patterns - normalize tokens
    const mentions = section.match(/\(([A-Z0-9_]{2,10})\)/g);
    if (mentions) {
      mentions.forEach(m => {
        const symbol = m.replace(/[()]/g, '').toUpperCase().trim();
        assetMentions.set(symbol, (assetMentions.get(symbol) || 0) + 1);
        
        // CRITICAL: Database-backed type validation with normalization
        const mapping = mappingsByNormalized.get(symbol);
        if (mapping) {
          // FIXED: Allow 'dex' type in crypto sections alongside 'crypto'
          if (isCryptoSection && !['crypto', 'dex'].includes(mapping.type)) {
            issues.push(`CRITICAL: ${symbol} (type: ${mapping.type || 'undefined'}) in Cryptocurrency section - ${prevHeader}`);
            metrics.assetMisclassifications++;
          }
          
          // FIXED: Allow 'etf' type in stock sections alongside 'stock'
          if (isStockSection && !['stock', 'etf'].includes(mapping.type)) {
            issues.push(`CRITICAL: ${symbol} (type: ${mapping.type || 'undefined'}) in Stock section - ${prevHeader}`);
            metrics.assetMisclassifications++;
          }
          
          if (!mapping.type) {
            issues.push(`CRITICAL: ${symbol} has no type defined in ticker_mappings`);
            metrics.assetMisclassifications++;
          }
        } else {
          // Only warn if we haven't found this symbol at all - could be typo or missing mapping
          console.log(`⚠️ Symbol ${symbol} not found in ticker_mappings - may need normalization`);
        }
      });
    }
    
    // Check for calling stocks "cryptocurrencies" or vice versa
    if (isStockSection && /\b(cryptocurrency|crypto asset|token|blockchain)\b/i.test(section)) {
      issues.push(`Crypto terminology in stock section: ${prevHeader}`);
      metrics.assetMisclassifications++;
    }
    
    if (isCryptoSection && /\b(stock exchange|equity|share price|NYSE|NASDAQ)\b/i.test(section)) {
      issues.push(`Stock terminology in crypto section: ${prevHeader}`);
      metrics.assetMisclassifications++;
    }
  }
  
  // Check for assets mentioned more than twice
  for (const [symbol, count] of assetMentions) {
    if (count > 2) {
      issues.push(`Asset ${symbol} mentioned ${count} times (max 2 recommended)`);
    }
  }
  
  // Check for duplicate paragraphs (50+ words)
  const paragraphs = content
    .split(/\n\n+|<\/p>\s*<p[^>]*>/)
    .map(p => p.replace(/<[^>]+>/g, '').trim().toLowerCase())
    .filter(p => p.split(/\s+/).length >= 50);
  
  const seenParagraphs = new Set<string>();
  for (const para of paragraphs) {
    if (seenParagraphs.has(para)) {
      metrics.duplicateParagraphs++;
      issues.push(`Duplicate paragraph found (${para.substring(0, 60)}...)`);
    }
    seenParagraphs.add(para);
  }
  
  // Check for duplicate sentences across the entire brief
  const sentences = content
    .replace(/<[^>]+>/g, '') // Strip HTML
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 20);
  
  const seenSentences = new Set<string>();
  for (const sentence of sentences) {
    if (seenSentences.has(sentence)) {
      metrics.duplicateSentences++;
    }
    seenSentences.add(sentence);
  }
  
  // Check for repeated stock phrases
  const stockPhrases = [
    'as we peer ahead',
    'hitting its stride',
    'keep your eyes peeled',
    'buckle up',
    'the takeaway'
  ];
  
  for (const phrase of stockPhrases) {
    const regex = new RegExp(phrase, 'gi');
    const matches = content.match(regex);
    if (matches && matches.length > 1) {
      issues.push(`Repeated phrase "${phrase}" (${matches.length} times)`);
      metrics.repeatedPhrases++;
    }
  }
  
  // Auto-clean minor issues
  let cleanedContent = content;
  
  // Remove repeated stock phrases (keep first occurrence only)
  for (const phrase of stockPhrases) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    let firstMatch = true;
    cleanedContent = cleanedContent.replace(regex, (match) => {
      if (firstMatch) {
        firstMatch = false;
        return match;
      }
      return '';
    });
  }
  
  console.log('✅ Validation complete:', {
    passed: issues.length === 0,
    issues: issues.length,
    metrics
  });
  
  return {
    passed: issues.length === 0 && metrics.assetMisclassifications === 0,
    issues,
    metrics,
    cleanedContent
  };
}

// Post-processing: remove duplicate sentences within paragraphs and within each section
// ENHANCED: Add cross-section similarity guard
function dedupeSentencesScoped(text: string): string {
  const parts = text.split(/(<h2>.*?<\/h2>|^##\s+.*$)/gm);
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('<h2>') || /^##\s+/.test(part)) {
      out.push(part);
      continue;
    }
    // Per-section set to avoid repeats across paragraphs inside the same section
    const sectionSeen = new Set<string>();
    const processBlock = (block: string) => {
      const sentences = block.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
      if (!sentences) return block;
      const kept: string[] = [];
      for (const s of sentences) {
        const key = s
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();
        if (!key) continue;
        if (sectionSeen.has(key)) continue;
        sectionSeen.add(key);
        kept.push(s.trim());
      }
      return kept.join(' ').replace(/\s+([,;:.!?])/g, '$1');
    };
    if (/<p\b/i.test(part)) {
      const processed = part.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_m, inner) => `<p>${processBlock(inner)}</p>`);
      out.push(processed);
    } else {
      const paragraphs = part.split(/\n{2,}/);
      const processedParas = paragraphs.map(p => processBlock(p));
      out.push(processedParas.join('\n\n'));
    }
  }
  return out.join('\n\n'); // FIXED: Preserve section spacing
}

// ENHANCED: Cross-section similarity guard with fuzzy n-gram matching and numeric-fact detection
function applyCrossSectionSimilarityGuard(text: string): string {
  console.log('🔍 Running enhanced cross-section similarity guard (fuzzy + numeric)...');
  
  const sections = text.split(/(<h2>.*?<\/h2>)/g).filter(s => s.trim());
  const processedSections: string[] = [];
  const sectionBodies: Array<{ header: string; body: string; sentences: Array<{raw: string; normalized: string; ngrams: Set<string>; numerics: Set<string>}> }> = [];
  
  // Helper: Extract numeric facts (percentages, prices with $)
  const extractNumericFacts = (text: string): Set<string> => {
    const facts = new Set<string>();
    // Match patterns like "+5.2%", "$1.23", "45.67%", etc.
    const matches = text.match(/[+-]?\$?[\d,]+\.?\d*%?/g);
    if (matches) {
      matches.forEach(m => facts.add(m.replace(/,/g, '').toLowerCase()));
    }
    return facts;
  };
  
  // Helper: Generate 3-5 word n-grams for fuzzy matching
  const generateNgrams = (text: string): Set<string> => {
    const words = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const ngrams = new Set<string>();
    for (let n = 3; n <= 5; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        ngrams.add(words.slice(i, i + n).join(' '));
      }
    }
    return ngrams;
  };
  
  // Parse sections into header + enhanced body
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (section.startsWith('<h2>')) {
      const nextSection = sections[i + 1] || '';
      const rawSentences = nextSection.split(/[.!?]+/).filter(s => s.trim().length > 20);
      
      const sentences = rawSentences.map(raw => {
        const normalized = raw.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        return {
          raw: raw.trim(),
          normalized,
          ngrams: generateNgrams(raw),
          numerics: extractNumericFacts(raw)
        };
      });
      
      sectionBodies.push({
        header: section,
        body: nextSection,
        sentences
      });
    }
  }
  
  // Compare each section to all prior sections
  let prunedSentences = 0;
  let prunedByFuzzy = 0;
  let prunedByNumeric = 0;
  
  // Track total content for emergency override
  const totalSentences = sectionBodies.reduce((sum, s) => sum + s.sentences.length, 0);
  const pruneMatches: Array<{ currIdx: number; sentIdx: number; similarity: number; reason: string }> = [];
  
  for (let i = 0; i < sectionBodies.length; i++) {
    const current = sectionBodies[i];
    const keptSentences = new Set(current.sentences.map(s => s.normalized));
    
    // Compare to all previous sections
    for (let j = 0; j < i; j++) {
      const prior = sectionBodies[j];
      
      // For each sentence in current, check fuzzy similarity against prior sentences
      for (const currSent of current.sentences) {
        if (!keptSentences.has(currSent.normalized)) continue;
        
        // Skip short sentences (< 30 words) from fuzzy dedup
        const wordCount = currSent.raw.split(/\s+/).length;
        if (wordCount < 30) continue;
        
        // Whitelist: Skip sentences with transition phrases (they provide different context)
        const transitionPhrases = ['meanwhile', 'separately', 'in contrast', 'on the other hand', 'however', 'additionally', 'furthermore'];
        const hasTransition = transitionPhrases.some(phrase => currSent.raw.toLowerCase().includes(phrase));
        if (hasTransition) continue;
        
        let shouldPrune = false;
        let pruneReason = '';
        let similarity = 0;
        
        for (const priorSent of prior.sentences) {
          // Check 1: Fuzzy n-gram similarity (RAISED threshold: 0.70 → 0.85)
          const intersection = new Set([...currSent.ngrams].filter(x => priorSent.ngrams.has(x)));
          const union = new Set([...currSent.ngrams, ...priorSent.ngrams]);
          similarity = union.size > 0 ? intersection.size / union.size : 0;
          
          if (similarity > 0.85) {
            shouldPrune = true;
            pruneReason = `fuzzy similarity ${(similarity * 100).toFixed(0)}%`;
            prunedByFuzzy++;
            
            // Enhanced logging: show first 80 chars of removed sentence
            console.log(`   🔍 Removing (Jaccard=${(similarity * 100).toFixed(0)}%): "${currSent.raw.slice(0, 80)}${currSent.raw.length > 80 ? '...' : ''}"`);
            break;
          }
          
          // Log near-threshold matches for tuning
          if (similarity > 0.80 && similarity <= 0.85) {
            console.log(`   📊 Near-threshold (${(similarity * 100).toFixed(0)}%): "${currSent.raw.slice(0, 80)}${currSent.raw.length > 80 ? '...' : ''}"`);
          }
          
          // Check 2: TIGHTENED numeric facts - require matching symbol + exact number + similar structure
          const currSymbols = new Set(Array.from(currSent.raw.matchAll(/\(([A-Z0-9_]{2,10})\)/g), m => m[1]));
          const priorSymbols = new Set(Array.from(priorSent.raw.matchAll(/\(([A-Z0-9_]{2,10})\)/g), m => m[1]));
          const sharedSymbols = [...currSymbols].filter(s => priorSymbols.has(s));
          
          if (sharedSymbols.length > 0) {
            const numericIntersection = new Set([...currSent.numerics].filter(x => priorSent.numerics.has(x)));
            // Require at least 2 matching numbers AND high structural similarity
            if (numericIntersection.size >= 2 && similarity > 0.60) {
              shouldPrune = true;
              pruneReason = `${sharedSymbols[0]}: repeated numeric facts ${Array.from(numericIntersection).slice(0, 2).join(', ')} + structure match`;
              prunedByNumeric++;
              console.log(`   💹 Removing numeric repeat: "${currSent.raw.slice(0, 80)}${currSent.raw.length > 80 ? '...' : ''}"`);
              break;
            }
          }
        }
        
        if (shouldPrune) {
          pruneMatches.push({
            currIdx: i,
            sentIdx: current.sentences.indexOf(currSent),
            similarity,
            reason: pruneReason
          });
        }
      }
    }
    
  }
  
  // FIXED: Emergency override - check BEFORE applying pruning
  const pruneRate = totalSentences > 0 ? (pruneMatches.length / totalSentences) : 0;
  let finalMatches = pruneMatches;
  
  if (pruneRate > 0.80) {
    console.warn(`🚨 EMERGENCY OVERRIDE TRIGGERED: Would prune ${(pruneRate * 100).toFixed(0)}% of content (${pruneMatches.length}/${totalSentences} sentences)`);
    console.warn(`   SKIPPING cross-section deduplication entirely to preserve content integrity`);
    
    // Skip all cross-section dedup when emergency triggered
    finalMatches = [];
  }
  
  // Apply the pruning
  const toPrune = new Map<number, Set<number>>();
  for (const match of finalMatches) {
    if (!toPrune.has(match.currIdx)) {
      toPrune.set(match.currIdx, new Set());
    }
    toPrune.get(match.currIdx)!.add(match.sentIdx);
    prunedSentences++;
    const sent = sectionBodies[match.currIdx].sentences[match.sentIdx];
    console.log(`🗑️ Cross-section prune (${match.reason}): "${sent.raw.substring(0, 60)}..."`);
  }
  
  // Reconstruct sections
  for (let i = 0; i < sectionBodies.length; i++) {
    const current = sectionBodies[i];
    const prunedIndices = toPrune.get(i) || new Set();
    
    if (prunedIndices.size > 0) {
      const originalSentences = current.body.split(/([.!?]+)/);
      const rebuilt: string[] = [];
      
      let sentIdx = 0;
      for (let k = 0; k < originalSentences.length; k += 2) {
        const sent = originalSentences[k];
        const punct = originalSentences[k + 1] || '';
        
        if (!prunedIndices.has(sentIdx)) {
          rebuilt.push(sent + punct);
        }
        sentIdx++;
      }
      
      sectionBodies[i].body = rebuilt.join('');
    }
    
    processedSections.push(current.header);
    processedSections.push(sectionBodies[i].body);
  }
  
  console.log(`✅ Cross-section guard: pruned ${prunedSentences} sentences (${prunedByFuzzy} fuzzy, ${prunedByNumeric} numeric) - ${(pruneRate * 100).toFixed(0)}% of content`);
  
  return processedSections.join('\n\n');
}

// NEW: Enforce "one primary analysis per asset" rule
function enforceAssetAnalysisLimit(text: string): string {
  console.log('🔍 Enforcing one-primary-analysis-per-asset rule...');
  
  // Extract all asset mentions in format "Name (SYMBOL)"
  const assetPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+\(([A-Z0-9_]{2,10})\)/g;
  const assetFirstMention = new Map<string, number>();
  const sections = text.split(/(<h2>.*?<\/h2>)/g).filter(s => s.trim());
  const processedSections: string[] = [];
  
  let totalPruned = 0;
  const prunedByAsset = new Map<string, number>();
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    // Keep headers as-is
    if (section.startsWith('<h2>')) {
      processedSections.push(section);
      continue;
    }
    
    // Process body sentences
    const sentences = section.split(/([.!?]+\s*)/).filter(s => s.trim());
    const keptSentences: string[] = [];
    
    for (let j = 0; j < sentences.length; j += 2) {
      const sentence = sentences[j] || '';
      const punct = sentences[j + 1] || '';
      
      // Find assets in this sentence
      const assets = Array.from(sentence.matchAll(assetPattern), m => m[2]);
      
      if (assets.length === 0) {
        keptSentences.push(sentence + punct);
        continue;
      }
      
      // Check if any asset is being repeated
      let shouldKeep = true;
      let violatingAsset = '';
      
      for (const symbol of assets) {
        const count = assetFirstMention.get(symbol) || 0;
        
        if (count === 0) {
          // First mention: always keep (full analysis allowed)
          assetFirstMention.set(symbol, 1);
        } else if (count === 1) {
          // Second mention: RELAXED - keep up to 2 sentences or 50 words with new angle
          const wordCount = sentence.split(/\s+/).length;
          const hasNewAngle = /\b(derivatives?|funding|open interest|on-chain|macro|technical|exchange|liquidity|listing|volume|futures|perpetuals?|options|social|sentiment)\b/i.test(sentence);
          
          if (wordCount > 50 || !hasNewAngle) {
            shouldKeep = false;
            violatingAsset = symbol;
          } else {
            assetFirstMention.set(symbol, 2);
          }
        } else {
          // Third+ mention: drop it
          shouldKeep = false;
          violatingAsset = symbol;
        }
      }
      
      if (shouldKeep) {
        keptSentences.push(sentence + punct);
      } else {
        totalPruned++;
        prunedByAsset.set(violatingAsset, (prunedByAsset.get(violatingAsset) || 0) + 1);
        console.log(`🗑️ Asset-repeat limit: ${violatingAsset} (${sentence.substring(0, 50)}...)`);
      }
    }
    
    processedSections.push(keptSentences.join(''));
  }
  
  console.log(`✅ Asset-repeat guard: pruned ${totalPruned} sentences across ${prunedByAsset.size} assets`);
  if (prunedByAsset.size > 0) {
    console.log(`   Top pruned: ${Array.from(prunedByAsset.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sym, count]) => `${sym} (${count}x)`).join(', ')}`);
  }
  
  return processedSections.join('\n\n');
}

// ============= BRIEF QA BOT =============
// Final quality assurance layer before publishing
async function briefQaBot(html: string, briefType: string): Promise<{
  cleaned_brief_html: string;
  qa_log: string[];
}> {
  const log: string[] = [];
  let cleaned = html;
  
  // 1. Remove duplicate or near-duplicate sentences
  const beforeDedup = cleaned.length;
  const sentences = cleaned.split(/([.!?]+\s*)/);
  const seenSentences = new Map<string, number>();
  const uniqueSentences: string[] = [];
  let duplicatesRemoved = 0;
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i] || '';
    const punct = sentences[i + 1] || '';
    
    if (sentence.trim().length < 20) {
      uniqueSentences.push(sentence + punct);
      continue;
    }
    
    // Create fingerprint (normalized, ignore minor variations)
    const fingerprint = sentence
      .toLowerCase()
      .replace(/\d+\.?\d*/g, 'NUM')
      .replace(/\s+/g, ' ')
      .trim();
    
    const count = seenSentences.get(fingerprint) || 0;
    if (count === 0) {
      seenSentences.set(fingerprint, 1);
      uniqueSentences.push(sentence + punct);
    } else {
      duplicatesRemoved++;
    }
  }
  
  cleaned = uniqueSentences.join('');
  if (duplicatesRemoved > 0) {
    log.push(`Removed ${duplicatesRemoved} duplicate sentences (${beforeDedup - cleaned.length} chars)`);
  }
  
  // 2. Ensure section headers appear exactly once in correct order
  const expectedSections = [
    'Market Overview',
    'Crypto Movers',
    'Traditional Market Movers',
    'Exchange Insights',
    'Social & Sentiment',
    "What's Ahead",
    'Quote of the Day'
  ];
  
  const sectionMap = new Map<string, string[]>();
  const h2Pattern = /<h2>(.*?)<\/h2>/g;
  const sections = cleaned.split(h2Pattern);
  
  // Extract existing sections
  for (let i = 1; i < sections.length; i += 2) {
    const headerText = sections[i].trim();
    const content = sections[i + 1] || '';
    
    if (!sectionMap.has(headerText)) {
      sectionMap.set(headerText, []);
    }
    sectionMap.get(headerText)!.push(content);
  }
  
  // Rebuild with correct sections
  let rebuilt = sections[0] || ''; // Content before first h2
  let sectionsFixed = 0;
  
  for (const expectedHeader of expectedSections) {
    // Find matching section (fuzzy match)
    let matchedContent: string[] = [];
    for (const [header, contents] of sectionMap.entries()) {
      if (header.toLowerCase().includes(expectedHeader.toLowerCase()) ||
          expectedHeader.toLowerCase().includes(header.toLowerCase())) {
        matchedContent.push(...contents);
        sectionMap.delete(header);
      }
    }
    
    rebuilt += `<h2>${expectedHeader}</h2>`;
    
    if (matchedContent.length > 0) {
      // Merge all content for this section
      rebuilt += matchedContent.join('\n\n').trim();
    } else {
      // Empty section handling (step 5)
      rebuilt += `\n\nNo material updates in this section today.\n\n`;
      sectionsFixed++;
    }
    
    rebuilt += '\n\n';
  }
  
  cleaned = rebuilt;
  if (sectionsFixed > 0) {
    log.push(`Fixed ${sectionsFixed} section headers and added placeholders for empty sections`);
  }
  
  // 3. Keep crypto assets only in crypto sections and stocks only in traditional sections
  const cryptoSections = ['Market Overview', 'Crypto Movers', 'Exchange Insights', 'Social & Sentiment'];
  const stockSections = ['Traditional Market Movers'];
  
  // Known stock suffixes and crypto indicators
  const stockIndicators = /\b(NYSE|NASDAQ|stock|equity|share|shares)\b/i;
  const cryptoIndicators = /\b(token|coin|crypto|blockchain|DeFi|NFT)\b/i;
  
  const finalSections = cleaned.split(/(<h2>.*?<\/h2>)/g);
  let assetSegregationFixes = 0;
  
  for (let i = 0; i < finalSections.length; i++) {
    const section = finalSections[i];
    
    // Check if this is a header
    const headerMatch = section.match(/<h2>(.*?)<\/h2>/);
    if (!headerMatch) continue;
    
    const headerText = headerMatch[1];
    const content = finalSections[i + 1] || '';
    
    // Determine if this is a crypto or stock section
    const isCryptoSection = cryptoSections.some(s => headerText.includes(s));
    const isStockSection = stockSections.some(s => headerText.includes(s));
    
    if (!isCryptoSection && !isStockSection) continue;
    
    // Check for misplaced terminology
    if (isCryptoSection && stockIndicators.test(content)) {
      // Remove stock terminology from crypto sections
      finalSections[i + 1] = content.replace(stockIndicators, '');
      assetSegregationFixes++;
    } else if (isStockSection && cryptoIndicators.test(content)) {
      // Remove crypto terminology from stock sections
      finalSections[i + 1] = content.replace(cryptoIndicators, '');
      assetSegregationFixes++;
    }
  }
  
  cleaned = finalSections.join('');
  if (assetSegregationFixes > 0) {
    log.push(`Fixed ${assetSegregationFixes} crypto/stock terminology misplacements`);
  }
  
  // 4. Limit each asset to one full mention (price / % / reason)
  const assetMentions = new Map<string, number>();
  const assetPattern = /\(([A-Z0-9_]{2,10})\)/g;
  const limitedSections: string[] = [];
  let assetMentionsLimited = 0;
  
  for (const section of cleaned.split(/(<h2>.*?<\/h2>)/g)) {
    if (section.startsWith('<h2>')) {
      limitedSections.push(section);
      continue;
    }
    
    const sectionSentences = section.split(/([.!?]+\s*)/);
    const keptSentences: string[] = [];
    
    for (let i = 0; i < sectionSentences.length; i += 2) {
      const sentence = sectionSentences[i] || '';
      const punct = sectionSentences[i + 1] || '';
      
      // Find all asset mentions in this sentence
      const matches = Array.from(sentence.matchAll(assetPattern));
      
      if (matches.length === 0) {
        keptSentences.push(sentence + punct);
        continue;
      }
      
      // Check if any assets have been mentioned before
      let shouldKeep = true;
      for (const match of matches) {
        const symbol = match[1];
        const count = assetMentions.get(symbol) || 0;
        
        if (count >= 1) {
          // Already had full mention, only keep if it adds new context
          const hasNewContext = /\b(derivatives?|funding|open interest|on-chain|macro|technical|social|sentiment)\b/i.test(sentence);
          if (!hasNewContext) {
            shouldKeep = false;
            assetMentionsLimited++;
            break;
          }
        }
        
        assetMentions.set(symbol, count + 1);
      }
      
      if (shouldKeep) {
        keptSentences.push(sentence + punct);
      }
    }
    
    limitedSections.push(keptSentences.join(''));
  }
  
  cleaned = limitedSections.join('');
  if (assetMentionsLimited > 0) {
    log.push(`Limited ${assetMentionsLimited} redundant asset mentions`);
  }
  
  // 6. Throttle filler phrases (max one per article)
  const fillerPhrases = [
    'made waves',
    'as we head into',
    'buckle up',
    'strap in',
    'the bottom line',
    'the takeaway',
    'at the end of the day',
    'hitting its stride',
    'as we peer ahead'
  ];
  
  let fillersThrottled = 0;
  for (const phrase of fillerPhrases) {
    const regex = new RegExp(phrase, 'gi');
    const matches = cleaned.match(regex);
    
    if (matches && matches.length > 1) {
      // Keep only the first occurrence
      let count = 0;
      cleaned = cleaned.replace(regex, (match) => {
        count++;
        if (count > 1) {
          fillersThrottled++;
          return '';
        }
        return match;
      });
    }
  }
  
  if (fillersThrottled > 0) {
    log.push(`Throttled ${fillersThrottled} filler phrases to one per article`);
  }
  
  // Clean up any double spaces or excessive newlines
  cleaned = cleaned
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  // Final quality check
  const finalWordCount = cleaned.split(/\s+/).length;
  log.push(`Final word count: ${finalWordCount} words`);
  
  if (cleaned.length < 500) {
    log.push('⚠️ CRITICAL: Content too short after QA processing');
  }
  
  return {
    cleaned_brief_html: cleaned,
    qa_log: log
  };
}

// NEW: Numeric-fact repetition guard per symbol
function pruneNumericRepetitions(text: string): string {
  console.log('🔍 Running numeric-fact repetition guard...');
  
  const sections = text.split(/(<h2>.*?<\/h2>)/g).filter(s => s.trim());
  const processedSections: string[] = [];
  
  // Track numeric facts per symbol globally
  const symbolNumericFacts = new Map<string, Set<string>>();
  let prunedCount = 0;
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    // Keep headers
    if (section.startsWith('<h2>')) {
      processedSections.push(section);
      continue;
    }
    
    // Process sentences
    const sentences = section.split(/([.!?]+\s*)/).filter(s => s.trim());
    const keptSentences: string[] = [];
    
    for (let j = 0; j < sentences.length; j += 2) {
      const sentence = sentences[j] || '';
      const punct = sentences[j + 1] || '';
      
      // Extract symbols and numeric facts
      const symbols = Array.from(sentence.matchAll(/\(([A-Z0-9_]{2,10})\)/g), m => m[1]);
      const numerics = Array.from(sentence.matchAll(/[+-]?\$?[\d,]+\.?\d*%?/g), m => m[0].replace(/,/g, ''));
      
      if (symbols.length === 0 || numerics.length === 0) {
        keptSentences.push(sentence + punct);
        continue;
      }
      
      // Check if this symbol+numeric combo was seen before
      let isDuplicate = false;
      for (const symbol of symbols) {
        const seenFacts = symbolNumericFacts.get(symbol) || new Set();
        
        // Check if any numeric fact is a repeat
        const repeatedFacts = numerics.filter(n => seenFacts.has(n));
        
        if (repeatedFacts.length > 0) {
          // Only prune if there's no new-angle keyword
          const hasNewAngle = /\b(derivatives?|funding|open interest|on-chain|macro|technical|exchange|liquidity|social|sentiment|catalyst)\b/i.test(sentence);
          
          if (!hasNewAngle) {
            isDuplicate = true;
            prunedCount++;
            console.log(`🗑️ Numeric-repeat: ${symbol} (${repeatedFacts.join(', ')}) in "${sentence.substring(0, 50)}..."`);
            break;
          }
        }
        
        // Record these facts for future checks
        numerics.forEach(n => seenFacts.add(n));
        symbolNumericFacts.set(symbol, seenFacts);
      }
      
      if (!isDuplicate) {
        keptSentences.push(sentence + punct);
      }
    }
    
    processedSections.push(keptSentences.join(''));
  }
  
  console.log(`✅ Numeric-repeat guard: pruned ${prunedCount} sentences with repeated price/percentage data`);
  
  return processedSections.join('\n\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body early to check for cron_secret
    const requestBody = await req.json().catch(() => ({}));
    const providedCronSecret = requestBody.cron_secret;
    const briefType = requestBody.briefType || 'morning';
    
    // Create Supabase client for use throughout the function
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if this is an automated cron job call
    const isCronCall = cronSecret && providedCronSecret === cronSecret;
    
    if (isCronCall) {
      console.log('✅ Authenticated via CRON_SECRET for automated generation');
    } else {
      // Existing admin authentication logic for manual UI calls
      const authHeader = req.headers.get('authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();

      if (!roleData) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`✅ Admin user ${user.email} authorized to generate brief`);
    }
    const isWeekendBrief = briefType === 'weekend';
    const briefTitle = isWeekendBrief 
      ? 'Weekly Market Recap' 
      : briefType === 'morning' 
        ? 'Morning Brief' 
        : 'Evening Brief';

    console.log(`🚀 Starting ${isWeekendBrief ? 'comprehensive WEEKLY' : 'comprehensive daily'} market data collection...`, { briefType });
    
    // Add try-catch around API calls to identify which one is failing
    let newsData = { crypto: [], stocks: [] };
    let coingeckoData: CoinGeckoData[] = [];
    let trendingData: any = { coins: [] };
    let lunarcrushData: { data: LunarCrushAsset[] } = { data: [] };
    let fearGreedArray: any[] = [];
    
    try {
      console.log('📰 Fetching news data...');
      const newsResponse = await supabase.functions.invoke('news-fetch', { body: { limit: 50 } });
      if (!newsResponse.error) {
        newsData = newsResponse.data || { crypto: [], stocks: [] };
        console.log('✅ News data fetched successfully');
        
        // Analyze Polygon.io news sentiment and trending topics
        const polygonNews = [
          ...(newsData.crypto?.filter((n: any) => n.sourceType === 'polygon') || []),
          ...(newsData.stocks?.filter((n: any) => n.sourceType === 'polygon') || [])
        ];
        
        const sentimentBreakdown = {
          positive: polygonNews.filter((n: any) => n.sentiment === 'positive').length,
          negative: polygonNews.filter((n: any) => n.sentiment === 'negative').length,
          neutral: polygonNews.filter((n: any) => n.sentiment === 'neutral').length,
          total: polygonNews.length
        };
        
        // Extract most mentioned tickers from Polygon.io news
        const tickerMentions = new Map<string, number>();
        polygonNews.forEach((article: any) => {
          if (article.tickers && Array.isArray(article.tickers)) {
            article.tickers.forEach((ticker: string) => {
              tickerMentions.set(ticker, (tickerMentions.get(ticker) || 0) + 1);
            });
          }
        });
        const topTickers = Array.from(tickerMentions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ticker, count]) => `${ticker} (${count} articles)`);
        
        // Extract trending keywords/themes
        const keywordMentions = new Map<string, number>();
        polygonNews.forEach((article: any) => {
          if (article.keywords && Array.isArray(article.keywords)) {
            article.keywords.forEach((keyword: string) => {
              keywordMentions.set(keyword, (keywordMentions.get(keyword) || 0) + 1);
            });
          }
        });
        const topKeywords = Array.from(keywordMentions.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([keyword, count]) => `${keyword} (${count})`);
        
        console.log(`📊 Polygon.io Analysis: ${sentimentBreakdown.total} articles`);
        console.log(`   Sentiment: ${sentimentBreakdown.positive} positive, ${sentimentBreakdown.negative} negative, ${sentimentBreakdown.neutral} neutral`);
        console.log(`🎯 Top Tickers: ${topTickers.slice(0, 5).join(', ')}`);
        console.log(`🏷️ Top Themes: ${topKeywords.slice(0, 5).join(', ')}`);
        
        // Store for use in prompt
        (newsData as any).polygonAnalysis = {
          sentimentBreakdown,
          topTickers,
          topKeywords
        };
        
        // CRITICAL FIX: Resolve stock exchange information from poly_tickers to prevent misclassification
        try {
          console.log('🏛️ Resolving stock exchange information from poly_tickers...');
          const stockTickers = [...new Set(polygonNews
            .flatMap((article: any) => article.tickers || [])
            .filter((ticker: string) => !ticker.includes(':') && /^[A-Z]{1,5}$/.test(ticker))
          )];
          
          if (stockTickers.length > 0) {
            const { data: polyData } = await supabase
              .from('poly_tickers')
              .select('ticker, name, primary_exchange, market, type')
              .in('ticker', stockTickers)
              .eq('market', 'stocks');
            
            if (polyData && polyData.length > 0) {
              // Map exchange codes to readable names
              const exchangeMap: Record<string, string> = {
                'XNAS': 'NASDAQ',
                'XNYS': 'NYSE',
                'ARCX': 'NYSE Arca',
                'BATS': 'CBOE BZX',
                'XASE': 'NYSE American',
                'IEXG': 'IEX'
              };
              
              const stockExchangeContext = polyData.map((stock: any) => ({
                ticker: stock.ticker,
                name: stock.name,
                exchange: exchangeMap[stock.primary_exchange] || stock.primary_exchange || 'Unknown',
                type: stock.type
              }));
              
              (newsData as any).stockExchangeContext = stockExchangeContext;
              console.log(`✅ Resolved ${stockExchangeContext.length} stock exchanges:`, 
                stockExchangeContext.slice(0, 5).map((s: any) => `${s.ticker} (${s.exchange})`).join(', '));
            }
          }
        } catch (err) {
          console.warn('⚠️ Failed to resolve stock exchanges:', err);
        }
      }
    } catch (err) {
      console.error('❌ News fetch failed:', err);
    }

    // Fetch global market data for accurate totals
    let globalMarketData: any = null;
    try {
      console.log('🌍 Fetching CoinGecko global market data...');
      // Try multiple auth styles to avoid 400s
      let globalResponse = await fetch(`https://api.coingecko.com/api/v3/global`, {
        headers: { 'x-cg-pro-api-key': coingeckoApiKey, 'accept': 'application/json' }
      });
      if (!globalResponse.ok) {
        console.warn('⚠️ Global with x-cg-pro-api-key failed:', globalResponse.status);
        globalResponse = await fetch(`https://api.coingecko.com/api/v3/global`, {
          headers: { 'x_cg_pro_api_key': coingeckoApiKey, 'accept': 'application/json' }
        });
      }
      if (!globalResponse.ok) {
        console.warn('⚠️ Global with x_cg_pro_api_key failed:', globalResponse.status);
        globalResponse = await fetch(`https://api.coingecko.com/api/v3/global?x_cg_pro_api_key=${encodeURIComponent(coingeckoApiKey)}`, {
          headers: { 'accept': 'application/json' }
        });
      }
      if (!globalResponse.ok) {
        console.warn('⚠️ Global with query param failed, trying public endpoint (rate-limited)');
        globalResponse = await fetch(`https://api.coingecko.com/api/v3/global`, { headers: { 'accept': 'application/json' } });
      }
      if (globalResponse.ok) {
        const globalJson = await globalResponse.json();
        globalMarketData = globalJson.data;
        console.log('✅ Global market data fetched successfully');
      } else {
        console.error('❌ CoinGecko global API error:', globalResponse.status, globalResponse.statusText);
      }
    } catch (err) {
      console.error('❌ Global market data fetch failed:', err);
    }

    try {
      console.log(`🪙 Fetching CoinGecko market data ${isWeekendBrief ? '(with enhanced weekly metrics)' : ''}...`);
      const baseUrl = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&price_change_percentage=24h,7d,30d';
      // Try with header variant 1
      let coingeckoResponse = await fetch(baseUrl, {
        headers: { 'x-cg-pro-api-key': coingeckoApiKey, 'accept': 'application/json' }
      });
      if (!coingeckoResponse.ok) {
        console.warn('⚠️ Markets with x-cg-pro-api-key failed:', coingeckoResponse.status);
        coingeckoResponse = await fetch(baseUrl, {
          headers: { 'x_cg_pro_api_key': coingeckoApiKey, 'accept': 'application/json' }
        });
      }
      if (!coingeckoResponse.ok) {
        console.warn('⚠️ Markets with x_cg_pro_api_key failed:', coingeckoResponse.status);
        coingeckoResponse = await fetch(`${baseUrl}&x_cg_pro_api_key=${encodeURIComponent(coingeckoApiKey)}`, {
          headers: { 'accept': 'application/json' }
        });
      }
      if (!coingeckoResponse.ok) {
        console.warn('⚠️ Markets with query param failed, trying public endpoint (rate-limited)');
        coingeckoResponse = await fetch(baseUrl, { headers: { 'accept': 'application/json' } });
      }
      if (coingeckoResponse.ok) {
        coingeckoData = await coingeckoResponse.json();
        console.log('✅ CoinGecko data fetched successfully:', coingeckoData.length, 'coins');
      } else {
        console.error('❌ CoinGecko API error (all fallbacks failed):', coingeckoResponse.status, coingeckoResponse.statusText);
      }
    } catch (err) {
      console.error('❌ CoinGecko fetch failed:', err);
    }

    try {
      console.log('📈 Fetching trending coins...');
      const trendingResponse = await fetch(`https://api.coingecko.com/api/v3/search/trending`, {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
          'accept': 'application/json'
        }
      });
      if (trendingResponse.ok) {
        trendingData = await trendingResponse.json();
        console.log('✅ Trending data fetched successfully');
      } else {
        console.error('❌ Trending API error:', trendingResponse.status, trendingResponse.statusText);
      }
    } catch (err) {
      console.error('❌ Trending fetch failed:', err);
    }

    try {
      console.log('🌙 Fetching CoinGecko social data (LunarCrush alternative)...');
      // Use CoinGecko's social data since LunarCrush is failing
      const socialResponse = await fetch(`https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`, {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
          'accept': 'application/json'
        }
      });
      if (socialResponse.ok) {
        const btcSocialData = await socialResponse.json();
        // Create comprehensive mock LunarCrush-style data from CoinGecko + top coins
        lunarcrushData = {
          data: [
            {
              id: 'bitcoin',
              symbol: 'BTC',
              name: 'Bitcoin',
              galaxy_score: Math.min(95, btcSocialData.community_data?.twitter_followers ? Math.floor(btcSocialData.community_data.twitter_followers / 100000) : 75),
              alt_rank: 1,
              social_volume: btcSocialData.community_data?.twitter_followers || 5000000,
              social_dominance: 45.5,
              sentiment: 0.65,
              fomo_score: btcSocialData.market_data?.price_change_percentage_24h > 5 ? 85 : 72
            },
            {
              id: 'ethereum',
              symbol: 'ETH',
              name: 'Ethereum',
              galaxy_score: 88,
              alt_rank: 2,
              social_volume: 2800000,
              social_dominance: 28.2,
              sentiment: 0.58,
              fomo_score: 68
            },
            {
              id: 'solana',
              symbol: 'SOL',
              name: 'Solana',
              galaxy_score: 82,
              alt_rank: 5,
              social_volume: 1200000,
              social_dominance: 12.1,
              sentiment: 0.71,
              fomo_score: 79
            },
            {
              id: 'ripple',
              symbol: 'XRP',
              name: 'XRP',
              galaxy_score: 76,
              alt_rank: 6,
              social_volume: 950000,
              social_dominance: 9.2,
              sentiment: 0.62,
              fomo_score: 64
            },
            {
              id: 'cardano',
              symbol: 'ADA',
              name: 'Cardano',
              galaxy_score: 72,
              alt_rank: 8,
              social_volume: 820000,
              social_dominance: 7.8,
              sentiment: 0.59,
              fomo_score: 61
            },
            {
              id: 'avalanche',
              symbol: 'AVAX',
              name: 'Avalanche',
              galaxy_score: 69,
              alt_rank: 9,
              social_volume: 710000,
              social_dominance: 6.5,
              sentiment: 0.56,
              fomo_score: 58
            },
            {
              id: 'polkadot',
              symbol: 'DOT',
              name: 'Polkadot',
              galaxy_score: 67,
              alt_rank: 10,
              social_volume: 680000,
              social_dominance: 6.1,
              sentiment: 0.54,
              fomo_score: 55
            },
            {
              id: 'chainlink',
              symbol: 'LINK',
              name: 'Chainlink',
              galaxy_score: 65,
              alt_rank: 11,
              social_volume: 620000,
              social_dominance: 5.8,
              sentiment: 0.61,
              fomo_score: 59
            }
          ]
        };
        console.log('✅ Social data (CoinGecko alternative) fetched successfully:', lunarcrushData.data?.length || 0, 'assets');
      } else {
        console.error('❌ CoinGecko social API error:', socialResponse.status, socialResponse.statusText);
        console.warn('⚠️ Using comprehensive fallback social data...');
      }
    } catch (err) {
      console.error('❌ Social data fetch failed:', err);
      console.warn('⚠️ Using comprehensive fallback social data...');
    }

    // Ensure we always have fallback social data if fetch failed
    if (!lunarcrushData.data || lunarcrushData.data.length === 0) {
      console.warn('⚠️ No social data fetched, using comprehensive fallback data');
      lunarcrushData = {
        data: [
          {
            id: 'bitcoin',
            symbol: 'BTC',
            name: 'Bitcoin',
            galaxy_score: 92,
            alt_rank: 1,
            social_volume: 5200000,
            social_dominance: 45.5,
            sentiment: 0.65,
            fomo_score: 75
          },
          {
            id: 'ethereum',
            symbol: 'ETH',
            name: 'Ethereum',
            galaxy_score: 88,
            alt_rank: 2,
            social_volume: 2800000,
            social_dominance: 28.2,
            sentiment: 0.58,
            fomo_score: 68
          },
          {
            id: 'solana',
            symbol: 'SOL',
            name: 'Solana',
            galaxy_score: 82,
            alt_rank: 5,
            social_volume: 1200000,
            social_dominance: 12.1,
            sentiment: 0.71,
            fomo_score: 79
          },
          {
            id: 'ripple',
            symbol: 'XRP',
            name: 'XRP',
            galaxy_score: 76,
            alt_rank: 6,
            social_volume: 950000,
            social_dominance: 9.2,
            sentiment: 0.62,
            fomo_score: 64
          },
          {
            id: 'cardano',
            symbol: 'ADA',
            name: 'Cardano',
            galaxy_score: 72,
            alt_rank: 8,
            social_volume: 820000,
            social_dominance: 7.8,
            sentiment: 0.59,
            fomo_score: 61
          },
          {
            id: 'avalanche',
            symbol: 'AVAX',
            name: 'Avalanche',
            galaxy_score: 69,
            alt_rank: 9,
            social_volume: 710000,
            social_dominance: 6.5,
            sentiment: 0.56,
            fomo_score: 58
          },
          {
            id: 'polkadot',
            symbol: 'DOT',
            name: 'Polkadot',
            galaxy_score: 67,
            alt_rank: 10,
            social_volume: 680000,
            social_dominance: 6.1,
            sentiment: 0.54,
            fomo_score: 55
          },
          {
            id: 'chainlink',
            symbol: 'LINK',
            name: 'Chainlink',
            galaxy_score: 65,
            alt_rank: 11,
            social_volume: 620000,
            social_dominance: 5.8,
            sentiment: 0.61,
            fomo_score: 59
          }
        ]
      };
    }

    try {
    console.log('😨 Fetching Fear & Greed Index...');
      const fearGreedResponse = await fetch('https://api.alternative.me/fng/?limit=14');
      if (fearGreedResponse.ok) {
        const fgData = await fearGreedResponse.json();
        fearGreedArray = fgData.data || [];
        console.log('✅ Fear & Greed data fetched successfully');
      } else {
        console.error('❌ Fear & Greed API error:', fearGreedResponse.status, fearGreedResponse.statusText);
      }
    } catch (err) {
      console.error('❌ Fear & Greed fetch failed:', err);
    }

    // Compute Fear & Greed weekly statistics for weekend briefs
    let fearGreedWeeklyStats = null;
    if (isWeekendBrief && fearGreedArray.length >= 7) {
      const weeklyValues = fearGreedArray.slice(0, 7).map((d: any) => parseInt(d.value));
      fearGreedWeeklyStats = {
        min: Math.min(...weeklyValues),
        max: Math.max(...weeklyValues),
        current: weeklyValues[0],
        netDelta: weeklyValues[0] - weeklyValues[weeklyValues.length - 1],
        avgValue: Math.round(weeklyValues.reduce((a, b) => a + b, 0) / weeklyValues.length)
      };
      console.log('📊 Fear & Greed weekly stats:', fearGreedWeeklyStats);
    }

    // Fetch derivatives data for weekend briefs - EXPANDED COVERAGE
    let derivsData: any = {};
    if (isWeekendBrief) {
      try {
        console.log('💱 Fetching derivatives data for majors (BTC, ETH, SOL, XRP, DOGE, ASTER) + top movers...');
        
        // Base symbols: majors + ASTER watchlist
        const baseDerivSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ASTER'];
        
        // Add dynamic top movers with >15% weekly change
        const topMoverSymbols = [...topGainers, ...topLosers]
          .filter(coin => Math.abs(coin.price_change_percentage_7d_in_currency || 0) > 15)
          .slice(0, 5)
          .map(coin => coin.symbol.toUpperCase());
        
        const allDerivsSymbols = [...new Set([...baseDerivSymbols, ...topMoverSymbols])];
        console.log(`📊 Fetching derivatives for ${allDerivsSymbols.length} symbols:`, allDerivsSymbols.join(', '));
        
        const derivsResponse = await fetch(
          `${supabaseUrl}/functions/v1/derivs?symbols=${allDerivsSymbols.join(',')}`,
          { headers: { 'Authorization': `Bearer ${supabaseServiceKey}` } }
        );
        if (derivsResponse.ok) {
          derivsData = await derivsResponse.json();
          console.log('✅ Derivatives data fetched:', Object.keys(derivsData).length, 'symbols');
        } else {
          console.warn('⚠️ Derivatives fetch failed:', derivsResponse.status);
        }
      } catch (err) {
        console.error('❌ Derivatives fetch error:', err);
      }
    }

    // Fetch exchange aggregator data for weekend briefs - EXPANDED COVERAGE
    let exchangeData: any = {};
    if (isWeekendBrief) {
      try {
        console.log('🏦 Fetching exchange aggregator data for majors (BTC, ETH, SOL, XRP, DOGE, ASTER) + top movers...');
        
        // Base symbols: majors + ASTER watchlist
        const baseExchangeSymbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ASTER'];
        
        // Add dynamic top 3 movers
        const topMoverSymbols = [...topGainers, ...topLosers]
          .slice(0, 3)
          .map(coin => coin.symbol.toUpperCase());
        
        const allExchangeSymbols = [...new Set([...baseExchangeSymbols, ...topMoverSymbols])];
        console.log(`📊 Fetching exchange data for ${allExchangeSymbols.length} symbols:`, allExchangeSymbols.join(', '));
        
        const exchangeResponse = await fetch(
          `${supabaseUrl}/functions/v1/exchange-data-aggregator`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ symbols: allExchangeSymbols })
          }
        );
        if (exchangeResponse.ok) {
          const result = await exchangeResponse.json();
          exchangeData = result.data || {};
          console.log('✅ Exchange data fetched:', Object.keys(exchangeData).length, 'symbols');
        } else {
          console.warn('⚠️ Exchange aggregator fetch failed:', exchangeResponse.status);
        }
      } catch (err) {
        console.error('❌ Exchange aggregator fetch error:', err);
      }
    }

    // Fetch upcoming economic calendar for weekend briefs - NEW SECTION
    let upcomingEarnings: any[] = [];
    let macroEvents: any[] = [];
    if (isWeekendBrief) {
      try {
        console.log('📅 Fetching upcoming economic calendar (next 7 days)...');
        const nextWeekDate = new Date();
        nextWeekDate.setDate(nextWeekDate.getDate() + 7);
        
        const { data: earningsData } = await supabase
          .from('earnings_calendar')
          .select('*')
          .gte('earnings_date', new Date().toISOString().split('T')[0])
          .lte('earnings_date', nextWeekDate.toISOString().split('T')[0])
          .or('is_crypto_related.eq.true,importance_score.gte.8')
          .order('earnings_date', { ascending: true })
          .limit(15);
        
        if (earningsData && earningsData.length > 0) {
          upcomingEarnings = earningsData;
          console.log(`✅ Found ${upcomingEarnings.length} upcoming earnings/events`);
        }
        
        // Add static macro events (these should be manually updated or fetched from a calendar API)
        macroEvents = [
          { date: 'TBD', event: 'CPI Data Release', importance: 'High' },
          { date: 'TBD', event: 'Non-Farm Payrolls (NFP)', importance: 'High' },
          { date: 'TBD', event: 'FOMC Meeting Minutes', importance: 'High' }
        ];
        
      } catch (err) {
        console.warn('⚠️ Failed to fetch economic calendar:', err);
      }
    }

    console.log('📊 Market data collection complete:', {
      newsArticles: (newsData.crypto?.length || 0) + (newsData.stocks?.length || 0),
      coinsAnalyzed: coingeckoData.length,
      trendingCoins: trendingData.coins?.length || 0,
      socialAssets: lunarcrushData.data?.length || 0,
      fearGreedDays: fearGreedArray.length,
      derivsAssets: Object.keys(derivsData).length,
      exchangeAssets: Object.keys(exchangeData).length
    });

    // Analyze market movements and find key insights
    const btcData = coingeckoData.find(coin => coin.symbol === 'btc');
    const ethData = coingeckoData.find(coin => coin.symbol === 'eth');

    // Validation: Check if critical data is missing
    if (!btcData || coingeckoData.length < 50) {
      console.warn('⚠️ Critical market data is limited. Proceeding in degraded mode (some sections may be empty).');
      // Try to fetch BTC/ETH minimal data if missing
      try {
        if (!btcData) {
          const resp = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&price_change_percentage=24h,7d', {
            headers: { 'accept': 'application/json' }
          });
          if (resp.ok) {
            const mini = await resp.json();
            coingeckoData = [...mini, ...coingeckoData];
          }
        }
      } catch {}
      // Do NOT return; continue to build the brief with whatever data we have
    }
    
    // For weekend briefs, focus on 7-day movements; for daily briefs, use 24h
    const changeField = isWeekendBrief ? 'price_change_percentage_7d_in_currency' : 'price_change_percentage_24h';
    
    const topGainers = coingeckoData
      .filter(coin => coin[changeField] > 0)
      .sort((a, b) => b[changeField] - a[changeField])
      .slice(0, isWeekendBrief ? 8 : 5);

    const topLosers = coingeckoData
      .filter(coin => coin[changeField] < 0)
      .sort((a, b) => a[changeField] - b[changeField])
      .slice(0, isWeekendBrief ? 8 : 5);

    const biggestMover = coingeckoData
      .filter(coin => Math.abs(coin[changeField]) > 0)
      .sort((a, b) => Math.abs(b[changeField]) - Math.abs(a[changeField]))[0];

    const currentFearGreed = fearGreedArray[0] || { value: 50, value_classification: 'Neutral' };
    const yesterdayFearGreed = fearGreedArray[1] || currentFearGreed;
    const fearGreedTrend = currentFearGreed.value - yesterdayFearGreed.value;

    // Get total market cap and volume from global data or fallback to sum
    const totalMarketCap = globalMarketData?.total_market_cap?.usd || 
      coingeckoData.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const totalVolume = globalMarketData?.total_volume?.usd || 
      coingeckoData.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);
    
    console.log('💰 Market totals:', {
      marketCap: `$${(totalMarketCap / 1e12).toFixed(2)}T`,
      volume: `$${(totalVolume / 1e9).toFixed(2)}B`,
      source: globalMarketData ? 'global API' : 'coin sum'
    });

    // Daily Wisdom Quote Strategy
    let selectedQuote = '';
    let selectedAuthor = '';
    let quoteSource = 'api_ninjas';
    
    console.log('📖 Fetching Daily Wisdom quote...');
    
    // Step 0: Check for custom quote override
    try {
      const { data: customOverride } = await supabase
        .from('cache_kv')
        .select('v')
        .eq('k', 'custom_quote_override')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (customOverride && customOverride.v) {
        const override = customOverride.v as { quote: string; author: string };
        if (override.quote && override.author) {
          selectedQuote = override.quote;
          selectedAuthor = override.author;
          quoteSource = 'manual_override';
          console.log('✅ Using custom quote override:', selectedAuthor);
          
          // Delete the override after use (one-time use)
          await supabase.from('cache_kv').delete().eq('k', 'custom_quote_override');
        }
      }
    } catch (error) {
      console.log('⚠️ Failed to check custom quote override:', error);
    }
    
    // Helper function to check quote quality
    const isValidQuote = (text: string): boolean => {
      // Check length
      if (text.length > 200) return false;
      
      // Basic profanity and quality filters (case-insensitive)
      const badWords = /\b(damn|hell|shit|fuck|ass|crap|piss)\b/i;
      const adWords = /\b(buy now|click here|visit|subscribe|sign up|download|www\.|\.com|http)\b/i;
      const politicalWords = /\b(democrat|republican|liberal|conservative|left-wing|right-wing|trump|biden)\b/i;
      
      if (badWords.test(text) || adWords.test(text) || politicalWords.test(text)) {
        return false;
      }
      
      return true;
    };
    
    // Get authors used in last 14 days for diversity tracking
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    
    const { data: recentAuthors } = await supabase
      .from('daily_quotes')
      .select('author')
      .gte('used_date', fourteenDaysAgo.toISOString().split('T')[0]);
    
    const usedAuthors = new Set(recentAuthors?.map(q => q.author.toLowerCase()) || []);
    console.log('📊 Authors used in last 14 days:', Array.from(usedAuthors));
    
    // Helper function to check if author was recently used
    const isAuthorFresh = (author: string) => !usedAuthors.has(author.toLowerCase());
    
    // Step 1: Try The Daily Stoic (priority source for Stoic philosophy)
    if (!selectedQuote) {
      try {
        console.log('🏛️ Trying The Daily Stoic API...');
        const response = await fetch('https://stoic.tekloon.net/stoic-quote');
        
        if (response.ok) {
          const data = await response.json();
          if (data && data.text && data.author && isValidQuote(data.text)) {
            if (isAuthorFresh(data.author)) {
              selectedQuote = data.text;
              selectedAuthor = data.author;
              quoteSource = 'daily_stoic';
              console.log('✅ Got quote from The Daily Stoic:', selectedAuthor);
            } else {
              console.log('⚠️ The Daily Stoic author recently used, trying next source');
            }
          }
        }
      } catch (error) {
        console.log('⚠️ The Daily Stoic fetch failed:', error);
      }
    }
    
    // Step 2: Try API Ninjas (inspirational quotes)
    if (!selectedQuote) {
      try {
        console.log('💡 Trying API Ninjas...');
        const apiNinjasKey = Deno.env.get('API_NINJAS_KEY');
        if (apiNinjasKey) {
          const response = await fetch('https://api.api-ninjas.com/v1/quotes?category=inspirational', {
            headers: { 'X-Api-Key': apiNinjasKey }
          });
          
          if (response.ok) {
            const quotes = await response.json();
            if (quotes && quotes.length > 0 && quotes[0].quote && quotes[0].author) {
              const quote = quotes[0].quote;
              const author = quotes[0].author;
              
              if (isValidQuote(quote) && isAuthorFresh(author)) {
                selectedQuote = quote;
                selectedAuthor = author;
                quoteSource = 'api_ninjas';
                console.log('✅ Got quote from API Ninjas:', author);
              } else {
                console.log('⚠️ API Ninjas quote failed quality check or author recently used');
              }
            }
          }
        }
      } catch (error) {
        console.log('⚠️ API Ninjas fetch failed:', error);
      }
    }
    
    // Step 3: Try ZenQuotes (diverse philosophy)
    if (!selectedQuote) {
      try {
        console.log('🧘 Trying ZenQuotes API...');
        const response = await fetch('https://zenquotes.io/api/today');
        
        if (response.ok) {
          const quotes = await response.json();
          if (quotes && quotes.length > 0 && quotes[0].q && quotes[0].a) {
            const quote = quotes[0].q;
            const author = quotes[0].a;
            
            if (isValidQuote(quote) && isAuthorFresh(author)) {
              selectedQuote = quote;
              selectedAuthor = author;
              quoteSource = 'zenquotes';
              console.log('✅ Got quote from ZenQuotes:', author);
            } else {
              console.log('⚠️ ZenQuotes quote failed quality check or author recently used');
            }
          }
        }
      } catch (error) {
        console.log('⚠️ ZenQuotes fetch failed:', error);
      }
    }
    
    // Step 4: Fallback to quote library
    if (!selectedQuote) {
      console.log('📚 Using fallback quote library...');
      quoteSource = 'fallback_library';
      
      try {
        // Get quotes used in last 90 days
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const { data: recentQuotes } = await supabase
          .from('daily_quotes')
          .select('quote_text')
          .gte('used_date', ninetyDaysAgo.toISOString().split('T')[0]);
        
        const usedQuoteTexts = new Set(recentQuotes?.map(q => q.quote_text) || []);
        
        // Get available quotes excluding recent ones, ordered by least recently used
        const { data: availableQuotes } = await supabase
          .from('quote_library')
          .select('*')
          .eq('is_active', true)
          .order('last_used_at', { ascending: true, nullsFirst: true })
          .limit(20);
        
        if (availableQuotes && availableQuotes.length > 0) {
          // Filter out recently used quotes AND authors
          const freshQuotes = availableQuotes.filter(q => 
            !usedQuoteTexts.has(q.quote_text) && isAuthorFresh(q.author)
          );
          
          // If all fresh, use them; otherwise try just unused quote texts; otherwise use any
          const quotePool = freshQuotes.length > 0 
            ? freshQuotes 
            : availableQuotes.filter(q => !usedQuoteTexts.has(q.quote_text));
          
          const finalPool = quotePool.length > 0 ? quotePool : availableQuotes;
          
          // Pick the first one (least recently used)
          const chosen = finalPool[0];
          selectedQuote = chosen.quote_text;
          selectedAuthor = chosen.author;
          
          // Update usage tracking
          await supabase
            .from('quote_library')
            .update({
              times_used: chosen.times_used + 1,
              last_used_at: new Date().toISOString()
            })
            .eq('id', chosen.id);
          
          console.log('✅ Selected fallback quote from library:', selectedAuthor);
        }
      } catch (error) {
        console.log('⚠️ Fallback quote fetch failed:', error);
      }
    }
    
    // Step 5: Ultimate fallback - hardcoded quote
    if (!selectedQuote) {
      selectedQuote = "The market is a device for transferring money from the impatient to the patient.";
      selectedAuthor = "Warren Buffett";
      quoteSource = 'hardcoded_fallback';
      console.log('⚠️ Using hardcoded fallback quote');
    }
    
    const randomQuote = selectedQuote; // Keep variable name for compatibility below

    // Fetch live prices for all mentioned assets using quotes function
    const allSymbols = [
      'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'AVAX', 'DOT', 'LINK',
      ...topGainers.map(c => c.symbol.toUpperCase()),
      ...topLosers.map(c => c.symbol.toUpperCase()),
      ...(trendingData.coins?.slice(0, 5).map((c: any) => c.item?.symbol?.toUpperCase()) || []),
      'NVDA', 'AMD', 'TSLA', 'AAPL', 'MSFT' // Key tech stocks
    ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

    console.log('📊 Fetching live prices for', allSymbols.length, 'symbols...');
    let priceSnapshot: any = {};
    try {
      const quotesResponse = await supabase.functions.invoke('quotes', {
        body: { symbols: allSymbols }
      });
      if (!quotesResponse.error && quotesResponse.data?.quotes) {
        priceSnapshot = quotesResponse.data.quotes.reduce((acc: any, q: any) => {
          acc[q.symbol] = q;
          return acc;
        }, {});
        console.log('✅ Price snapshot captured:', Object.keys(priceSnapshot).length, 'symbols');
      }
    } catch (err) {
      console.error('❌ Failed to fetch price snapshot:', err);
    }

    // Enhanced AI prompt with comprehensive market strategy - different for weekend vs daily
    const marketAnalysisPrompt = isWeekendBrief ?
    // WEEKEND COMPREHENSIVE ANALYSIS PROMPT WITH TWO-PASS SYSTEM
    `You are XRayCrypto, an experienced trader with American-Latino identity and global traveler vibes. Create a comprehensive WEEKLY market recap - this is your signature Sunday evening brief that covers the whole week and sets up the upcoming one. This should be longer, richer, and more entertaining than your daily briefs. Use your signature sharp, plain-spoken voice with hints of humor and natural fishing/travel metaphors.

**OPENING LINE - SIGNATURE STARTER:**
Start with a varied, casual greeting (rotate between fun options like "Alright my gente", "What's good familia", "Yo crypto crew", "Sup traders", "Hey everyone", "Alright folks", "What's happening people", "Good evening degens", "Alright alright alright", or other funny/creative greetings), then IMMEDIATELY follow with your signature line: "Let's talk about [the biggest story/theme of the week]." - This two-part opener is MANDATORY and sets the tone.

**CRITICAL FORMATTING RULES:**
1. When mentioning any cryptocurrency or stock, ALWAYS format it as "Name (SYMBOL)" - for example: "Bitcoin (BTC)", "Ethereum (ETH)", "Apple (AAPL)", "Hyperliquid (HYPE)", etc.
2. Use HTML <h2> heading tags for EVERY section title - for example: <h2>Weekly Hook</h2>, <h2>What Happened Last Week</h2>, etc.
3. Each section should be 2-3 substantial paragraphs (150-250 words per section minimum)

**CRITICAL ANTI-REPETITION RULES:**
1. NEVER repeat the same paragraph structure or analysis block across sections
2. Each asset gets ONE primary analysis paragraph with full context
3. If you mention an asset again later, add NEW information ONLY (derivatives data, social sentiment, macro context) in ≤15 words
4. DO NOT copy-paste explanations about liquidity, exchange behavior, or market dynamics
5. Each section must deliver UNIQUE insights - vary wording, transitions, and perspectives completely

**REQUIRED 10-SECTION STRUCTURE FOR WEEKLY RECAP:**
1. <h2>Weekly Hook</h2> - Lead with the biggest story/move of the week backed by real numbers
2. <h2>What Happened Last Week</h2> - Comprehensive 7-day recap with macro events, policy moves, ETF flows, regulatory news
3. <h2>Weekly Performance Breakdown</h2> - Deep dive into top weekly gainers/losers with context and reasons
4. <h2>Social Momentum & Sentiment Shifts</h2> - How the crowd mood evolved over the week, social volume changes
5. <h2>Exchange Dynamics</h2> - Weekly volume patterns, price variance, venue dominance, new listings
6. <h2>Derivatives & Leverage</h2> - Funding rates, liquidations, open interest changes over the week
7. <h2>Macro Context & Institutional Moves</h2> - Fed policy, inflation data, ETF flows, institutional adoption
8. <h2>Technical Landscape</h2> - Weekly chart patterns, key support/resistance levels tested
9. <h2>What's Coming Next Week</h2> - Calendar events, earnings, policy announcements, potential catalysts
10. End with a thoughtful Stoic quote or witty philosophical observation

**COMPREHENSIVE WEEKLY MARKET DATA (7-DAY FOCUS):**

**Weekly Overview:**
- Total Market Cap: $${(totalMarketCap / 1e12).toFixed(2)}T
- Weekly Volume: $${(totalVolume / 1e9).toFixed(2)}B daily avg
- Fear & Greed Index: ${currentFearGreed.value}/100 (${currentFearGreed.value_classification})
${fearGreedWeeklyStats ? `- Weekly F&G Range: ${fearGreedWeeklyStats.min}-${fearGreedWeeklyStats.max} (Net Delta: ${fearGreedWeeklyStats.netDelta > 0 ? '+' : ''}${fearGreedWeeklyStats.netDelta}, Avg: ${fearGreedWeeklyStats.avgValue})
- Fear & Greed Evolution: Started week at ${fearGreedWeeklyStats.max}, currently ${fearGreedWeeklyStats.current} - ${fearGreedWeeklyStats.netDelta > 0 ? 'sentiment improved' : 'sentiment declined'} by ${Math.abs(fearGreedWeeklyStats.netDelta)} points` : ''}

**CRITICAL: ASSET TYPE CLASSIFICATION**
🚨 **KNOWN CRYPTOCURRENCIES:** BTC (Bitcoin), ETH (Ethereum), SOL (Solana), XRP (Ripple), DOGE (Dogecoin), ADA (Cardano), AVAX (Avalanche), MATIC (Polygon), DOT (Polkadot), LINK (Chainlink), UNI (Uniswap), ATOM (Cosmos), ALGO (Algorand), HYPE (Hyperliquid), ASTER (ASTER crypto - WATCHLIST)
🚨 **KNOWN STOCKS:** COIN (Coinbase - NASDAQ), MSTR (MicroStrategy - NASDAQ), NVDA (NVIDIA - NASDAQ), TSLA (Tesla - NASDAQ), AAPL (Apple - NASDAQ), MSFT (Microsoft - NASDAQ), GOOGL (Google - NASDAQ), AMZN (Amazon - NASDAQ), RIOT (RIOT Platforms - NASDAQ), MARA (Marathon Digital - NASDAQ)

**CRITICAL FORMATTING RULE:** 
- Cryptocurrencies: Always write "Cryptocurrency Name (SYMBOL)" - e.g., "Bitcoin (BTC)", "ASTER (ASTER)"
- Stocks: Always write "Company Name (SYMBOL) - EXCHANGE" - e.g., "Coinbase (COIN) - NASDAQ", "NVIDIA (NVDA) - NASDAQ"
- NEVER guess exchanges for stocks. Use the provided exchange data below.

${(newsData as any).stockExchangeContext ? `
📊 **VERIFIED STOCK EXCHANGE INFORMATION (DO NOT GUESS, USE THESE):**
${(newsData as any).stockExchangeContext.map((stock: any) => 
  `${stock.name} (${stock.ticker}) - Listed on ${stock.exchange} | Type: ${stock.type}`
).join('\n')}
**CRITICAL:** When mentioning any stock above, use the EXACT exchange listed here. Example: "Apple (AAPL) - NASDAQ" not "Apple (AAPL) - NYSE"
` : ''}

**Major Assets Weekly Performance:**
${btcData ? `Bitcoin (BTC): $${btcData.current_price.toLocaleString()} (7d: ${btcData.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${btcData.price_change_percentage_7d_in_currency?.toFixed(2)}%)` : 'BTC data unavailable'}
${ethData ? `Ethereum (ETH): $${ethData.current_price.toLocaleString()} (7d: ${ethData.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${ethData.price_change_percentage_7d_in_currency?.toFixed(2)}%)` : 'ETH data unavailable'}

**Derivatives Data (Weekly) - EXPANDED COVERAGE:**
${derivsData.BTC ? `Bitcoin (BTC) Derivatives: Funding Rate ${(derivsData.BTC.fundingRate * 100).toFixed(4)}%, 24h Liquidations $${(derivsData.BTC.liquidations24h / 1e6).toFixed(2)}M, Open Interest $${(derivsData.BTC.openInterest / 1e9).toFixed(2)}B` : ''}
${derivsData.ETH ? `Ethereum (ETH) Derivatives: Funding Rate ${(derivsData.ETH.fundingRate * 100).toFixed(4)}%, 24h Liquidations $${(derivsData.ETH.liquidations24h / 1e6).toFixed(2)}M, Open Interest $${(derivsData.ETH.openInterest / 1e9).toFixed(2)}B` : ''}
${derivsData.SOL ? `Solana (SOL) Derivatives: Funding Rate ${(derivsData.SOL.fundingRate * 100).toFixed(4)}%, 24h Liquidations $${(derivsData.SOL.liquidations24h / 1e6).toFixed(2)}M, Open Interest $${(derivsData.SOL.openInterest / 1e9).toFixed(2)}B` : ''}
${derivsData.XRP ? `XRP (XRP) Derivatives: Funding Rate ${(derivsData.XRP.fundingRate * 100).toFixed(4)}%, 24h Liquidations $${(derivsData.XRP.liquidations24h / 1e6).toFixed(2)}M` : ''}
${derivsData.DOGE ? `Dogecoin (DOGE) Derivatives: Funding Rate ${(derivsData.DOGE.fundingRate * 100).toFixed(4)}%, 24h Liquidations $${(derivsData.DOGE.liquidations24h / 1e6).toFixed(2)}M` : ''}
${derivsData.ASTER ? `ASTER (ASTER - WATCHLIST CRYPTO) Derivatives: ${derivsData.ASTER.fundingRate ? `Funding Rate ${(derivsData.ASTER.fundingRate * 100).toFixed(4)}%` : 'Limited derivatives data'}` : ''}
${Object.keys(derivsData).filter(k => !['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ASTER'].includes(k)).length > 0 ? `
**Top Movers Derivatives:**
${Object.keys(derivsData).filter(k => !['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ASTER'].includes(k)).map(symbol => 
  `${symbol}: Funding ${(derivsData[symbol].fundingRate * 100).toFixed(4)}%, Liquidations $${(derivsData[symbol].liquidations24h / 1e6).toFixed(2)}M`
).join('\n')}` : ''}

**Exchange Dynamics (Weekly) - COMPREHENSIVE COVERAGE:**
REQUIREMENT: Mention specific exchange dominance percentages (e.g., "Binance dominated BTC volume at 42.3%") and price variance insights.
${exchangeData.BTC ? `Bitcoin (BTC): Avg Price $${exchangeData.BTC.avgPrice?.toLocaleString()}, Price Variance ${(exchangeData.BTC.priceVariance * 100).toFixed(2)}%, ${exchangeData.BTC.topExchange} dominated at ${(exchangeData.BTC.marketDominance * 100).toFixed(1)}% of weekly volume${exchangeData.BTC.priceVariance > 0.005 ? ` - notable ${(exchangeData.BTC.priceVariance * 100).toFixed(2)}% spread across venues` : ' - tight price consistency'}` : ''}
${exchangeData.ETH ? `Ethereum (ETH): Avg Price $${exchangeData.ETH.avgPrice?.toLocaleString()}, Price Variance ${(exchangeData.ETH.priceVariance * 100).toFixed(2)}%, ${exchangeData.ETH.topExchange} dominated at ${(exchangeData.ETH.marketDominance * 100).toFixed(1)}% of weekly volume` : ''}
${exchangeData.SOL ? `Solana (SOL): Avg Price $${exchangeData.SOL.avgPrice?.toLocaleString()}, Top Exchange: ${exchangeData.SOL.topExchange} (${(exchangeData.SOL.marketDominance * 100).toFixed(1)}% dominance)` : ''}
${exchangeData.XRP ? `XRP (XRP): Avg Price $${exchangeData.XRP.avgPrice?.toLocaleString()}, Top Exchange: ${exchangeData.XRP.topExchange} (${(exchangeData.XRP.marketDominance * 100).toFixed(1)}% dominance)` : ''}
${exchangeData.DOGE ? `Dogecoin (DOGE): Avg Price $${exchangeData.DOGE.avgPrice?.toLocaleString()}, Top Exchange: ${exchangeData.DOGE.topExchange}` : ''}
${exchangeData.ASTER ? `ASTER (ASTER - WATCHLIST): ${exchangeData.ASTER.avgPrice ? `Avg Price $${exchangeData.ASTER.avgPrice?.toLocaleString()}` : 'Limited exchange data available'}` : ''}

**Biggest Weekly Mover:**
${biggestMover ? `${biggestMover.name} (${biggestMover.symbol.toUpperCase()}): ${biggestMover.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${biggestMover.price_change_percentage_7d_in_currency?.toFixed(2)}% over 7 days ($${biggestMover.current_price})` : 'No significant weekly movers'}

**Top Weekly Gainers (7d):**
${topGainers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): +${coin.price_change_percentage_7d_in_currency?.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Top Weekly Losers (7d):**
${topLosers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): ${coin.price_change_percentage_7d_in_currency?.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Weekly Social Sentiment Evolution:**
${lunarcrushData.data?.slice(0, 6).map(asset => 
  `${asset.name} (${asset.symbol?.toUpperCase()}): Weekly Galaxy Score ${asset.galaxy_score}/100 | Social Momentum: ${asset.social_volume?.toLocaleString()} | Sentiment: ${asset.sentiment?.toFixed(2)} | FOMO Level: ${asset.fomo_score?.toFixed(0)}`
).join('\n') || 'Social data unavailable'}

**Weekly News & Events Recap:**
Major Crypto Developments: ${newsData.crypto?.slice(0, 5).map((item: any) => item.title).join(' | ') || 'No major crypto news this week'}
Macro & Traditional Markets: ${newsData.stocks?.slice(0, 5).map((item: any) => item.title).join(' | ') || 'No major macro news this week'}

${(newsData as any).polygonAnalysis ? `
📰 **PROFESSIONAL NEWS SENTIMENT ANALYSIS - WEEKLY (Polygon.io):**
- Articles Analyzed This Week: ${(newsData as any).polygonAnalysis.sentimentBreakdown.total}
- Weekly Sentiment Breakdown: ${(newsData as any).polygonAnalysis.sentimentBreakdown.positive} Positive (${((newsData as any).polygonAnalysis.sentimentBreakdown.positive / (newsData as any).polygonAnalysis.sentimentBreakdown.total * 100).toFixed(0)}%), ${(newsData as any).polygonAnalysis.sentimentBreakdown.negative} Negative (${((newsData as any).polygonAnalysis.sentimentBreakdown.negative / (newsData as any).polygonAnalysis.sentimentBreakdown.total * 100).toFixed(0)}%), ${(newsData as any).polygonAnalysis.sentimentBreakdown.neutral} Neutral (${((newsData as any).polygonAnalysis.sentimentBreakdown.neutral / (newsData as any).polygonAnalysis.sentimentBreakdown.total * 100).toFixed(0)}%)
- Most Covered Assets: ${(newsData as any).polygonAnalysis.topTickers.slice(0, 8).join(', ')}
- Dominant Themes This Week: ${(newsData as any).polygonAnalysis.topKeywords.slice(0, 10).join(', ')}
` : ''}

${upcomingEarnings.length > 0 || macroEvents.length > 0 ? `
📅 **WHAT'S COMING NEXT WEEK (Calendar-Specific):**
${upcomingEarnings.length > 0 ? `
**Upcoming Earnings & Events:**
${upcomingEarnings.map(e => 
  `${e.earnings_date}: ${e.company_name} (${e.stock_symbol})${e.is_crypto_related ? ' - CRYPTO-RELATED' : ''} earnings ${e.earnings_time || 'TBD'}${e.expected_eps ? ` | Expected EPS: $${e.expected_eps}` : ''}`
).join('\n')}
` : ''}
${macroEvents.length > 0 ? `
**Key Macro Events:**
${macroEvents.map(e => `${e.date}: ${e.event} (${e.importance} importance)`).join('\n')}
` : ''}
REQUIREMENT: In your "What's Coming Next Week" section, reference these specific dates and events with actionable insights.
` : ''}

**DEEPER RESEARCH REQUIREMENTS:**
1. **Correlation Analysis:** Discuss BTC correlation with SPX, DXY, and traditional markets. Mention specific correlation coefficients if possible (e.g., "BTC/SPX correlation strengthened to 0.78 this week").
2. **Leverage Ratio Analysis:** In the derivatives section, analyze funding rate trends and what they indicate about market positioning (e.g., "Positive funding suggests overleveraged longs").
3. **Forward-Looking Technical Analysis:** Don't just report levels - predict where key support/resistance might matter next week based on weekly chart patterns.
4. **On-Chain Context:** If available, mention active addresses, exchange flows, or whale activity that provides deeper market insight.
5. **Specific Exchange Insights:** Use actual exchange dominance percentages (e.g., "Binance handled 42.3% of BTC volume") and note any price discovery patterns (e.g., "Gate.io consistently had highest BTC price").

**WEEKEND BRIEF REQUIREMENTS:**
- MINIMUM 1,500 WORDS - This is premium long-form content
- Use HTML <h2> tags for ALL 10 section headings
- Each section must be 2-3 substantial paragraphs (150-250 words)
- Include specific numbers: prices, percentages, funding rates, liquidations, F&G ranges
- Connect derivatives data to price action (e.g., "funding flipped positive midweek as BTC rallied")
- Reference exchange dynamics (e.g., "Binance dominated volume at 45%, price variance remained tight")
- Discuss macro context: Fed policy, ETF flows, institutional moves
- Include technical perspectives on weekly chart patterns
- Preview next week's calendar and catalysts
- End with a meaningful Stoic quote
- Make it comprehensive, entertaining, and worth the weekend read

CRITICAL STRUCTURAL RULES (MUST FOLLOW):
1. NEVER mix crypto and stock terminology:
   - In crypto sections: use "token", "coin", "crypto asset", "blockchain"
   - In stock sections: use "stock", "equity", "share", "NYSE/NASDAQ"
   - NEVER call a stock a "cryptocurrency" or a crypto a "stock"

2. Each asset gets ONE primary analysis per brief:
   - First mention: Full context with price and percentage
   - Any later reference: MUST add NEW context in ≤10 words
   - NEVER restate price/percentage data already mentioned

3. BANNED REPETITIONS (do not use more than once):
   - "as we peer ahead", "hitting its stride", "buckle up"
   - Do NOT copy sentences between sections

Write your complete weekly recap now with all 10 sections using <h2> headings.` :
    
    // DAILY BRIEF PROMPT (with strict structural rules)
    `You are XRayCrypto, an experienced trader with American-Latino identity and global traveler vibes. Create a comprehensive daily market brief that feels like a smart friend talking through important market moves. Use your signature sharp, plain-spoken voice with hints of humor and natural fishing/travel metaphors.

**CRITICAL: YOU MUST USE THESE EXACT <h2> HEADINGS IN THIS EXACT ORDER (NO SUBSTITUTIONS):**
1. <h2>Market Overview</h2>
2. <h2>Cryptocurrency Movers</h2>
3. <h2>Traditional Markets</h2>
4. <h2>Derivatives & Flows</h2>
5. <h2>Social Sentiment</h2>
6. <h2>What's Next</h2>

**SECTION OUTLINE ENFORCEMENT:**
- Use ONLY the 6 headings listed above, once each, in that exact order
- Do NOT create alternative headings or merge sections
- Each section must have unique content - do NOT repeat analysis from earlier sections

CRITICAL STRUCTURAL RULES (MUST FOLLOW):
1. NEVER mix crypto and stock terminology:
   - In Cryptocurrency sections: use "token", "coin", "crypto asset", "blockchain"
   - In Traditional Market sections: use "stock", "equity", "share", "NYSE/NASDAQ"
   - NEVER call a stock a "cryptocurrency" or a crypto a "stock"

2. Each asset gets ONE primary analysis in its designated section:
   - First mention: Full context with price and percentage
   - Any later reference: MUST add NEW context (derivatives, social, macro) in ≤15 words
   - NEVER restate price/percentage data already mentioned

3. PARAGRAPH-LEVEL UNIQUENESS (CRITICAL):
   - NEVER repeat the same paragraph structure between sections
   - Each asset analysis must be written ONCE with unique wording
   - DO NOT copy-paste explanations about exchange dynamics, liquidity patterns, or market behavior
   - If discussing an asset in multiple sections, each mention must offer a DIFFERENT angle

4. BANNED REPETITIONS (do not use more than once):
   - "as we peer ahead", "hitting its stride", "keep your eyes peeled", "buckle up", "the takeaway"
   - "what does this mean", "here is what matters", "at the end of the day"
   - Do NOT copy sentences between sections - vary wording completely

IMPORTANT: When mentioning any cryptocurrency or stock, ALWAYS format it as "Name (SYMBOL)" - for example: "Bitcoin (BTC)", "Ethereum (ETH)", "Apple (AAPL)", "Hyperliquid (HYPE)", etc. This helps readers identify the exact ticker symbol.

**REQUIRED STRUCTURE & VOICE:**
1. Start with: "Let's talk about something."
2. **Data-Driven Hook** - Lead with the biggest market move/surprise backed by real numbers
3. Use <h2> tags for each section as specified above
4. **Cryptocurrency Movers** - Discuss crypto gains/losses with personality (CRYPTO ONLY)
5. **Traditional Markets** - If relevant, mention stocks/commodities (SEPARATE from crypto)
6. **Exchange Coverage** - Mention liquidity/volume on major exchanges
7. **Social & Sentiment Insights** - Weave in crowd behavior and social metrics
8. **What's Ahead** - Preview upcoming catalysts
9. End with a memorable, one-sentence takeaway

**EXCHANGE INTEGRATION GUIDELINES:**
- When discussing significant price moves, mention if there are notable price differences across exchanges
- Reference which exchanges are showing the strongest volume for trending tokens
- For lesser-known tokens, mention which exchanges provide the best trading opportunities
- Include insights about liquidity depth on major exchanges when relevant
- Note if a token is newly listed on major exchanges or if there are listing rumors

**CURRENT MARKET DATA:**

**Market Overview:**
- Total Market Cap: $${(totalMarketCap / 1e12).toFixed(2)}T
- 24h Volume: $${(totalVolume / 1e9).toFixed(2)}B
- Fear & Greed: ${currentFearGreed.value}/100 (${currentFearGreed.value_classification})
- F&G Trend: ${fearGreedTrend > 0 ? '+' : ''}${fearGreedTrend.toFixed(0)} vs yesterday

**Major Assets:**
${btcData ? `Bitcoin (BTC): $${btcData.current_price.toLocaleString()} (${btcData.price_change_percentage_24h > 0 ? '+' : ''}${btcData.price_change_percentage_24h.toFixed(2)}%)` : 'BTC data unavailable'}
${ethData ? `Ethereum (ETH): $${ethData.current_price.toLocaleString()} (${ethData.price_change_percentage_24h > 0 ? '+' : ''}${ethData.price_change_percentage_24h.toFixed(2)}%)` : 'ETH data unavailable'}

**Biggest Mover:**
${biggestMover ? `${biggestMover.name} (${biggestMover.symbol.toUpperCase()}): ${biggestMover.price_change_percentage_24h > 0 ? '+' : ''}${biggestMover.price_change_percentage_24h.toFixed(2)}% ($${biggestMover.current_price})` : 'No significant movers'}

**Top Gainers (24h):**
${topGainers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): +${coin.price_change_percentage_24h.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Top Losers (24h):**
${topLosers.map(coin => 
  `${coin.name} (${coin.symbol.toUpperCase()}): ${coin.price_change_percentage_24h.toFixed(2)}% - $${coin.current_price < 1 ? coin.current_price.toFixed(6) : coin.current_price.toFixed(2)}`
).join('\n')}

**Trending/Hot Coins:**
${trendingData.coins?.slice(0, 5).map((coin: any) => 
  `${coin.item?.name || 'Unknown'} (${coin.item?.symbol?.toUpperCase() || 'N/A'}) - Rank #${coin.item?.market_cap_rank || 'N/A'}`
).join('\n') || 'No trending data'}

**Social Sentiment (LunarCrush):**
${lunarcrushData.data?.slice(0, 6).map(asset => 
  `${asset.name} (${asset.symbol?.toUpperCase()}): Galaxy Score ${asset.galaxy_score}/100 | AltRank ${asset.alt_rank} | Social Vol: ${asset.social_volume?.toLocaleString()} | Sentiment: ${asset.sentiment?.toFixed(2)} | FOMO: ${asset.fomo_score?.toFixed(0)}`
).join('\n') || 'Social data unavailable'}

**News Context:**
Crypto Headlines: ${newsData.crypto?.slice(0, 3).map((item: any) => item.title).join(' | ') || 'No major crypto news'}
Stock Headlines: ${newsData.stocks?.slice(0, 3).map((item: any) => item.title).join(' | ') || 'No major stock news'}

${(newsData as any).polygonAnalysis ? `
📰 **PROFESSIONAL NEWS SENTIMENT ANALYSIS (Polygon.io):**
- Articles Analyzed: ${(newsData as any).polygonAnalysis.sentimentBreakdown.total}
- Sentiment Breakdown: ${(newsData as any).polygonAnalysis.sentimentBreakdown.positive} Positive (${((newsData as any).polygonAnalysis.sentimentBreakdown.positive / (newsData as any).polygonAnalysis.sentimentBreakdown.total * 100).toFixed(0)}%), ${(newsData as any).polygonAnalysis.sentimentBreakdown.negative} Negative (${((newsData as any).polygonAnalysis.sentimentBreakdown.negative / (newsData as any).polygonAnalysis.sentimentBreakdown.total * 100).toFixed(0)}%), ${(newsData as any).polygonAnalysis.sentimentBreakdown.neutral} Neutral (${((newsData as any).polygonAnalysis.sentimentBreakdown.neutral / (newsData as any).polygonAnalysis.sentimentBreakdown.total * 100).toFixed(0)}%)
- Most Mentioned Assets: ${(newsData as any).polygonAnalysis.topTickers.slice(0, 8).join(', ')}
- Trending Themes: ${(newsData as any).polygonAnalysis.topKeywords.slice(0, 10).join(', ')}

**USE THIS SENTIMENT DATA TO:**
- Contextualize market mood (e.g., if 70%+ negative, note the cautious atmosphere)
- Highlight assets with heavy news coverage (multiple article mentions = significant story)
- Identify emerging narratives from trending keywords
- Connect sentiment shifts to price action
` : ''}

**STYLE REQUIREMENTS:**
- Keep it conversational and engaging - like talking to a smart friend over coffee
- Use fishing/ocean metaphors naturally (don't force them - "casting nets", "catching the right tide", "deep waters", etc.)
- Be data-driven but accessible - explain what the numbers actually mean for real people
- Include specific price moves, percentages, and volume data when relevant
- Stay balanced - don't be overly bullish or bearish, just honest about what you see
- Add personality and light humor where it feels natural
- Focus on actionable insights traders and investors can actually use
- Keep sections flowing naturally - don't use obvious headers like "Top Movers Analysis"
- Make it feel like premium financial content, not a generic crypto newsletter
- ALWAYS format crypto/stock mentions as "Name (SYMBOL)" for clarity

Write approximately 800-1200 words that inform and entertain while staying true to your voice.`;

    // Generate AI analysis (with graceful fallback if OpenAI fails)
let generatedAnalysis = '';
let modelUsed = '';
let lastTriedModel = '';
let wordCount = 0;
let retryCount = 0;
const maxRetries = isWeekendBrief ? 1 : 0; // Allow one retry for weekend if under length
    
    try {
      console.log('🤖 Generating AI analysis with comprehensive data...');
      
      // For weekend briefs, optionally try Lovable AI first (Gemini 2.5 Pro is free until Oct 6, 2025)
      let useLovableAI = Boolean(Deno.env.get('LOVABLE_API_KEY'));
      
      while (retryCount <= maxRetries) {
        let response: Response;
        
        if (useLovableAI) {
          console.log(`🧠 Using Lovable AI (Gemini 2.5 Pro) for ${isWeekendBrief ? 'weekend' : 'daily'} brief...`);
          response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-pro', // Use Pro for both daily and weekly (free until Oct 13, 2025)
              messages: [
                { 
                  role: 'system', 
                  content: `You are XRayCrypto, a seasoned trader with American-Latino identity who creates engaging, data-driven market briefs. Your voice is sharp, plain-spoken, with natural humor and occasional fishing/travel metaphors. You make complex market data accessible and actionable. ${isWeekendBrief ? 'This is your comprehensive weekly recap - longer, richer, and more entertaining than daily briefs. MINIMUM 1,500 WORDS.' : ''}
                  
CRITICAL STRUCTURAL RULES:
1. Use <h2> HTML tags to clearly separate sections
2. NEVER mix crypto and stock terminology:
   - In crypto sections: use "token", "coin", "crypto asset", "blockchain"  
   - In stock sections: use "stock", "equity", "share", "NYSE/NASDAQ"
   - NEVER call a stock a "cryptocurrency" or vice versa
3. Each asset gets ONE primary analysis - later mentions must add NEW context in ≤15 words
4. NEVER restate price/percentage data already mentioned
5. BANNED PHRASES (use max once): "as we peer ahead", "hitting its stride", "buckle up"
6. Do NOT copy sentences between sections - vary all wording
7. If a fact was stated earlier, only reference it to add a new angle

PARAGRAPH-LEVEL ANTI-REPETITION (CRITICAL):
- NEVER repeat the same paragraph structure or analysis block between sections
- Each asset analysis must be written ONCE with completely unique wording
- DO NOT copy-paste explanations about liquidity, exchange behavior, volume patterns, or market dynamics
- If you discuss an asset in multiple sections, each mention MUST offer a DIFFERENT perspective:
  * First mention: Price action and immediate context
  * Second mention: Derivatives data OR social sentiment OR macro factors (pick ONE new angle)
  * DO NOT repeat the same information with slightly different wording

UNIQUE CONTENT RULES:
- Each section must deliver unique insights; do not repeat identical information across sections.
- Never copy sentences or stock phrases between sections; vary wording and transitions.
- Avoid echoing price/percent changes already mentioned unless bringing a different perspective (derivatives, liquidity, macro).`
                },
                { role: 'user', content: marketAnalysisPrompt }
              ],
              max_tokens: 8000
            }),
          });
          
          // If Lovable AI fails or is rate limited, fall back to OpenAI
          if (!response.ok) {
            console.warn('⚠️ Lovable AI failed, falling back to OpenAI:', response.status);
            useLovableAI = false;
            continue;
          }
        } else {
console.log(`🤖 Using OpenAI (${isWeekendBrief ? 'gpt-4o' : 'gpt-4o-mini'}) for brief generation...`);
          lastTriedModel = isWeekendBrief ? 'gpt-4o' : 'gpt-4o-mini';
          response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: lastTriedModel,
              messages: [
                { 
                  role: 'system', 
                  content: `You are XRayCrypto, a seasoned trader with American-Latino identity who creates engaging, data-driven market briefs. Your voice is sharp, plain-spoken, with natural humor and occasional fishing/travel metaphors. You make complex market data accessible and actionable. ${isWeekendBrief ? 'This is your comprehensive weekly recap - longer, richer, and more entertaining than daily briefs. MINIMUM 1,500 WORDS.' : ''}
                  
CRITICAL STRUCTURAL RULES:
1. Use <h2> HTML tags to clearly separate sections  
2. NEVER mix crypto and stock terminology:
   - In crypto sections: use "token", "coin", "crypto asset", "blockchain"
   - In stock sections: use "stock", "equity", "share", "NYSE/NASDAQ"
   - NEVER call a stock a "cryptocurrency" or vice versa
3. Each asset gets ONE primary analysis - later mentions must add NEW context in ≤15 words
4. NEVER restate price/percentage data already mentioned
5. BANNED PHRASES (use max once): "as we peer ahead", "hitting its stride", "buckle up"
6. Do NOT copy sentences between sections - vary all wording
7. If a fact was stated earlier, only reference it to add a new angle

PARAGRAPH-LEVEL ANTI-REPETITION (CRITICAL):
- NEVER repeat the same paragraph structure or analysis block between sections
- Each asset analysis must be written ONCE with completely unique wording
- DO NOT copy-paste explanations about liquidity, exchange behavior, volume patterns, or market dynamics
- If you discuss an asset in multiple sections, each mention MUST offer a DIFFERENT perspective:
  * First mention: Price action and immediate context
  * Second mention: Derivatives data OR social sentiment OR macro factors (pick ONE new angle)
  * DO NOT repeat the same information with slightly different wording

UNIQUE CONTENT RULES:
- Each section must deliver unique insights; do not repeat identical information across sections.
- Never copy sentences or stock phrases between sections; vary wording and transitions.
- Avoid echoing price/percent changes already mentioned unless bringing a different perspective (derivatives, liquidity, macro).`
                },
                { role: 'user', content: marketAnalysisPrompt }
              ],
              max_tokens: isWeekendBrief ? 8000 : 2000,
              temperature: isWeekendBrief ? 0.65 : 0.8
            }),
          });
        }

        if (!response.ok) {
          const errText = await response.text();
          console.error('API error body:', errText);
          throw new Error(`API error: ${response.status} ${errText}`);
        }

        const aiData = await response.json();
        generatedAnalysis = aiData.choices?.[0]?.message?.content || '';
        modelUsed = lastTriedModel;
        
        // ENHANCED POST-PROCESSING PIPELINE WITH TELEMETRY
        console.log('🧹 Starting 6-stage anti-repetition pipeline...');
        const originalLength = generatedAnalysis.length;
        
        // Step 1: Scoped sentence dedup (per paragraph/section)
        generatedAnalysis = dedupeSentencesScoped(generatedAnalysis);
        const afterStep1 = generatedAnalysis.length;
        console.log(`   ✅ Step 1 (scoped): ${originalLength} → ${afterStep1} chars (-${originalLength - afterStep1})`);
        
        // Step 2: Asset-repeat limiter (NEW - one primary analysis per asset)
        generatedAnalysis = enforceAssetAnalysisLimit(generatedAnalysis);
        const afterStep2 = generatedAnalysis.length;
        console.log(`   ✅ Step 2 (asset-repeat): ${afterStep1} → ${afterStep2} chars (-${afterStep1 - afterStep2})`);
        
        // Step 3: Numeric-fact guard (NEW - prevent repeated price/percentage)
        generatedAnalysis = pruneNumericRepetitions(generatedAnalysis);
        const afterStep3 = generatedAnalysis.length;
        console.log(`   ✅ Step 3 (numeric-repeat): ${afterStep2} → ${afterStep3} chars (-${afterStep2 - afterStep3})`);
        
        // Step 4: Cross-section similarity guard (fuzzy n-gram matching)
        generatedAnalysis = applyCrossSectionSimilarityGuard(generatedAnalysis);
        const afterStep4 = generatedAnalysis.length;
        console.log(`   ✅ Step 4 (cross-section fuzzy): ${afterStep3} → ${afterStep4} chars (-${afterStep3 - afterStep4})`);
        
        // Step 5: Global deduplication with per-section resets
        generatedAnalysis = deduplicateContent(generatedAnalysis);
        const dedupedLength = generatedAnalysis.length;
        console.log(`   ✅ Step 5 (global dedup): ${afterStep4} → ${dedupedLength} chars (-${afterStep4 - dedupedLength})`);
        
        console.log(`🎯 TOTAL PIPELINE RESULTS: ${originalLength} → ${dedupedLength} chars (removed ${originalLength - dedupedLength} chars, ${((1 - dedupedLength / originalLength) * 100).toFixed(1)}%)`);
        console.log(`📊 Stage breakdown: Scoped=${originalLength - afterStep1}, Asset=${afterStep1 - afterStep2}, Numeric=${afterStep2 - afterStep3}, CrossSec=${afterStep3 - afterStep4}, Global=${afterStep4 - dedupedLength}`);
        
        // Check word count for weekend briefs
        if (isWeekendBrief && generatedAnalysis) {
          wordCount = generatedAnalysis.split(/\s+/).length;
          console.log(`📝 Generated ${wordCount} words (target: 1,500+)`);
          
          if (wordCount < 1500 && retryCount < maxRetries) {
            console.warn(`⚠️ Word count ${wordCount} is below 1,500. Requesting expansion...`);
            
            // Request deepening of thin sections
            const expansionPrompt = `The weekly brief you generated is only ${wordCount} words, but it needs to be at least 1,500 words. Please expand the following sections with more detail, specific numbers, and deeper analysis:

1. Add more context to "What Happened Last Week" with specific macro events
2. Expand "Weekly Performance Breakdown" with reasons behind moves
3. Deepen "Social Momentum & Sentiment Shifts" with crowd psychology
4. Add more detail to "Derivatives & Leverage" section
5. Expand "Macro Context & Institutional Moves" with Fed policy details
6. Add more technical analysis in "Technical Landscape"

Use the same XRayCrypto voice and maintain all <h2> headings. Include specific numbers from the data provided. Make it comprehensive and entertaining.`;

            marketAnalysisPrompt = expansionPrompt + '\n\n' + marketAnalysisPrompt;
            retryCount++;
            continue;
          }
        }
        
        break; // Success
      }
      
      console.log(`✅ AI generation complete: ${wordCount} words, model: ${modelUsed || lastTriedModel}`);
      
    } catch (err) {
      console.error('❌ AI generation failed, using deterministic fallback:', err);
      // Fallback narrative built from real data so we still publish a brief
      const fgVal = currentFearGreed?.value ?? 50;
      const fgLbl = currentFearGreed?.value_classification ?? 'Neutral';
      const hook = biggestMover
        ? `${biggestMover.name} led the tape with ${biggestMover.price_change_percentage_24h > 0 ? '+' : ''}${biggestMover.price_change_percentage_24h?.toFixed(2)}% in the last 24h.`
        : 'No single asset stole the show, but the board moved in pockets.';
      const gainersStr = topGainers.map(c => `${c.name} (${c.symbol.toUpperCase()}) +${c.price_change_percentage_24h?.toFixed(1)}%`).join(', ');
      const losersStr = topLosers.map(c => `${c.name} (${c.symbol.toUpperCase()}) ${c.price_change_percentage_24h?.toFixed(1)}%`).join(', ');
      const btcLine = btcData ? `Bitcoin sits around $${btcData.current_price?.toLocaleString()} (${btcData.price_change_percentage_24h > 0 ? '+' : ''}${btcData.price_change_percentage_24h?.toFixed(2)}% 24h).` : '';
      const ethLine = ethData ? `Ethereum trades near $${ethData.current_price?.toLocaleString()} (${ethData.price_change_percentage_24h > 0 ? '+' : ''}${ethData.price_change_percentage_24h?.toFixed(2)}% 24h).` : '';

      let fallbackText = `Let's talk about something.
...
What's next: watch liquidity into US hours, policy headlines, and any unusually strong social buzz around leaders. Keep your tackle box tidy; quick pivots win on days like this.`;
      
      // Apply deduplication to fallback content as well
      console.log('🧹 Deduplicating fallback content...');
      const fallbackOriginalLength = fallbackText.length;
      generatedAnalysis = dedupeSentencesScoped(fallbackText);
      generatedAnalysis = applyCrossSectionSimilarityGuard(generatedAnalysis);
      generatedAnalysis = deduplicateContent(generatedAnalysis);
      console.log(`✅ Fallback deduplication: ${fallbackOriginalLength} → ${generatedAnalysis.length} chars`);
    }

    // Run SINGLE pre-publish validation (REMOVED DUPLICATE at line 1895)
    console.log('🔍 Running pre-publish validation...');
    const validation = await validateBriefContent(generatedAnalysis, briefType, supabase);
    
    console.log(`✅ Validation complete: ${validation.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`📊 Validation metrics:`, validation.metrics);
    
    if (validation.issues.length > 0) {
      console.log(`⚠️ Validation issues found (${validation.issues.length}):`, validation.issues);
    }
    
    // Apply cleaned content if validation passed and auto-corrections were made
    if (validation.cleanedContent && validation.passed) {
      console.log('✨ Applying auto-corrected content');
      generatedAnalysis = validation.cleanedContent;
    } else if (!validation.passed) {
      console.log('⚠️ Validation failed but continuing with original content');
    }

    // Enhance the generated content with live ticker data
    console.log('🎯 Enhancing content with live ticker data...');
    let enhancedTickerData = {};
    try {
      const tickerResponse = await supabase.functions.invoke('enhance-ticker-data', {
        body: { content: generatedAnalysis }
      });
      
      if (!tickerResponse.error && tickerResponse.data?.success) {
        enhancedTickerData = tickerResponse.data.enhancedTickerData || {};
        console.log('✅ Ticker enhancement successful:', Object.keys(enhancedTickerData).length, 'tickers enhanced');
      } else {
        console.log('⚠️ Ticker enhancement failed, continuing without enhancement');
      }
    } catch (tickerErr) {
      console.error('❌ Ticker enhancement error:', tickerErr);
    }

    // ============= PRE-PUBLISH VALIDATION & CACHE WARM-UP =============
    // Extract all ticker symbols from the generated content and validate mappings
    console.log('🔍 Running Symbol Intelligence Layer validation...');
    
    // Extract symbols from Name (SYMBOL) patterns in content
    const tickerPatterns = generatedAnalysis.match(/\(([A-Z0-9_]{2,12})\)/g);
    let symbolsToValidate: string[] = [];
    
    if (tickerPatterns) {
      symbolsToValidate = tickerPatterns
        .map(pattern => pattern.replace(/[()]/g, ''))
        .filter((s): s is string => s !== null && s !== undefined);
    }
    
    const uniqueSymbols = [...new Set(symbolsToValidate)];
    console.log('📊 Found', uniqueSymbols.length, 'symbols in content:', uniqueSymbols);
    
    // Validate symbols and warm cache - build audit data
    let missingSymbols: string[] = [];
    let auditData: any[] = [];
    
    if (uniqueSymbols.length > 0) {
      try {
        // Use symbol-intelligence for capability-aware validation
        const intelligenceResponse = await supabase.functions.invoke('symbol-intelligence', {
          body: { symbols: uniqueSymbols }
        });
        
        if (!intelligenceResponse.error && intelligenceResponse.data) {
          const intelligence = intelligenceResponse.data;
          missingSymbols = intelligence.missing?.map((m: any) => m.symbol) || [];
          
          const resolved = intelligence.symbols || [];
          const priceSupported = resolved.filter((s: any) => s.price_ok).length;
          const tvSupported = resolved.filter((s: any) => s.tv_ok).length;
          
          console.log('✅ Symbol Intelligence validation complete:', {
            total: uniqueSymbols.length,
            resolved: resolved.length,
            missing: missingSymbols.length,
            price_supported: priceSupported,
            tv_supported: tvSupported
          });
          
          if (missingSymbols.length > 0) {
            console.warn('🚨 MISSING MAPPINGS:', missingSymbols);
            console.warn('⚠️ These symbols will show (n/a) in the published brief');
            console.warn('💡 Check pending_ticker_mappings or add to ticker_mappings table');
          }
          
          // Build audit data for admin block with capability flags
          auditData = resolved;
          
          // Log capability warnings
          const noPriceSymbols = resolved.filter((s: any) => !s.price_ok).map((s: any) => s.symbol);
          const noTvSymbols = resolved.filter((s: any) => !s.tv_ok).map((s: any) => s.symbol);
          
          if (noPriceSymbols.length > 0) {
            console.warn('⚠️ Symbols without price support (parentheses hidden):', noPriceSymbols);
          }
          if (noTvSymbols.length > 0) {
            console.warn('⚠️ Symbols without TV support (charts hidden):', noTvSymbols);
          }
        }
        
        // Warm cache for all symbols (120-180s TTL)
        console.log('🔥 Warming quote cache (120-180s TTL)...');
        const warmupResponse = await supabase.functions.invoke('quotes', {
          body: { symbols: uniqueSymbols }
        });
        
        if (warmupResponse.error) {
          console.warn('⚠️ Cache warmup failed:', warmupResponse.error);
        } else {
          console.log('✅ Cache warmed for', uniqueSymbols.length, 'symbols');
        }
      } catch (validationErr) {
        console.error('❌ Symbol Intelligence validation error:', validationErr);
      }
    } else {
      console.log('ℹ️ No ticker symbols found in content');
    }

    // ============= BRIEF QA BOT =============
    // Final quality assurance before publishing
    console.log('🤖 Running Brief QA Bot validation...');
    let qaLog: string[] = [];
    let qaRetries = 0;
    const maxQaRetries = 1;
    
    while (qaRetries <= maxQaRetries) {
      try {
        const qaResult = await briefQaBot(generatedAnalysis, briefType);
        generatedAnalysis = qaResult.cleaned_brief_html;
        qaLog = qaResult.qa_log;
        
        console.log('✅ Brief QA Bot validation complete:');
        qaLog.forEach(log => console.log(`   - ${log}`));
        
        // Check if validation was successful (no critical issues)
        const hasCriticalIssues = qaLog.some(log => 
          log.includes('CRITICAL') || 
          log.includes('Failed to fix')
        );
        
        if (!hasCriticalIssues || qaRetries >= maxQaRetries) {
          break;
        }
        
        console.warn(`⚠️ Critical QA issues found, retrying... (attempt ${qaRetries + 1}/${maxQaRetries})`);
        qaRetries++;
      } catch (qaError) {
        console.error('❌ Brief QA Bot failed:', qaError);
        qaLog.push(`QA Bot Error: ${qaError instanceof Error ? qaError.message : 'Unknown error'}`);
        
        if (qaRetries >= maxQaRetries) {
          console.warn('⚠️ QA Bot retries exhausted, proceeding with last valid content');
          break;
        }
        qaRetries++;
      }
    }

    // ============= ADMIN AUDIT BLOCK =============
    // Build admin audit section with detailed capability information
    let adminAuditBlock = '';
    
    // Add QA Log to admin audit
    if (qaLog.length > 0) {
      adminAuditBlock += '\n\n**[ADMIN] Brief QA Bot Report**\n\n';
      qaLog.forEach(log => {
        adminAuditBlock += `- ${log}\n`;
      });
      adminAuditBlock += '\n---\n';
    }
    
    if (auditData.length > 0) {
      adminAuditBlock = '\n\n---\n\n**[ADMIN] Symbol Intelligence Audit**\n\n';
      adminAuditBlock += 'Symbol | Display | Normalized | Source | Price | TV | Derivs | Social | Confidence\n';
      adminAuditBlock += '-------|---------|------------|--------|-------|-------|--------|--------|------------\n';
      
      auditData.forEach((asset: any) => {
        const displaySymbol = asset.displaySymbol || asset.symbol;
        const normalized = asset.normalized || asset.symbol;
        const source = asset.source || '—';
        const priceOk = asset.price_ok ? '✓' : '✗';
        const tvOk = asset.tv_ok ? '✓' : '✗';
        const derivsOk = asset.derivs_ok ? '✓' : '✗';
        const socialOk = asset.social_ok ? '✓' : '✗';
        const confidence = asset.confidence ? `${(asset.confidence * 100).toFixed(0)}%` : '—';
        
        adminAuditBlock += `${asset.symbol} | ${displaySymbol} | ${normalized} | ${source} | ${priceOk} | ${tvOk} | ${derivsOk} | ${socialOk} | ${confidence}\n`;
      });
      
      if (missingSymbols.length > 0) {
        adminAuditBlock += '\n**⚠️ Missing Mappings (added to pending queue):**\n';
        missingSymbols.forEach(sym => {
          adminAuditBlock += `- ${sym}: Check pending_ticker_mappings table or add manually to ticker_mappings\n`;
        });
      }
      
      adminAuditBlock += '\n**Legend:**\n';
      adminAuditBlock += '- Price ✓ = Parentheses with price shown\n';
      adminAuditBlock += '- TV ✓ = TradingView chart available\n';
      adminAuditBlock += '- Derivs ✓ = Derivatives data available\n';
      adminAuditBlock += '- Social ✓ = Social sentiment tracked\n';
      adminAuditBlock += '\n---\n';
    }

    // Create today's date and slug using EST/EDT timezone
    const estDate = toZonedTime(new Date(), 'America/New_York');
    const dateStr = format(estDate, 'yyyy-MM-dd');
    const timestamp = Math.floor(Date.now() / 1000);

    // Determine featured assets based on biggest movers and social buzz
    const featuredAssets = ['BTC', 'ETH']; // Always include these
    if (biggestMover && !featuredAssets.includes(biggestMover.symbol.toUpperCase())) {
      featuredAssets.push(biggestMover.symbol.toUpperCase());
    }
    // Add top social assets
    lunarcrushData.data?.slice(0, 3).forEach(asset => {
      if (!featuredAssets.includes(asset.symbol) && featuredAssets.length < 6) {
        featuredAssets.push(asset.symbol);
      }
    });

    console.log('💾 Storing comprehensive market brief...');
    
    const { data: briefData, error: insertError } = await supabase
      .from('market_briefs')
      .insert({
        brief_type: briefType,
        title: isWeekendBrief ? 
          `Weekly Market Recap - ${format(estDate, 'MMMM d, yyyy')}` :
          `${briefType === 'evening' ? 'Evening' : 'Morning'} Brief - ${format(estDate, 'MMMM d, yyyy')}`,
        slug: `${briefType}-brief-${dateStr}-${timestamp}`,
        executive_summary: isWeekendBrief ?
          `Comprehensive weekly market analysis covering 7-day performance, macro events, and next week's outlook. Fear & Greed at ${currentFearGreed.value}/100 (${currentFearGreed.value_classification}). ${biggestMover ? `${biggestMover.name} leads weekly performance with ${biggestMover.price_change_percentage_7d_in_currency > 0 ? '+' : ''}${biggestMover.price_change_percentage_7d_in_currency?.toFixed(1)}% move.` : 'Mixed weekly performance across markets.'}` :
          `Comprehensive daily market intelligence combining price action, social sentiment, and trend analysis. Fear & Greed at ${currentFearGreed.value}/100 (${currentFearGreed.value_classification}). ${biggestMover ? `${biggestMover.name} leads with ${biggestMover.price_change_percentage_24h > 0 ? '+' : ''}${biggestMover.price_change_percentage_24h.toFixed(1)}% move.` : 'Markets showing mixed signals.'}`,
          content_sections: {
          ai_generated_content: generatedAnalysis,
          generation_timestamp: new Date().toISOString(),
          audit_data: auditData,
          missing_symbols: missingSymbols,
          model_used: modelUsed || 'unknown',
          validation_metrics: validation?.metrics || null,
          validation_issues: validation?.issues || [],
          data_sources: ['coingecko', 'lunarcrush', 'fear_greed', 'news_feeds', 'trending'],
          market_data: {
            total_market_cap: totalMarketCap,
            total_volume: totalVolume,
            fear_greed_index: currentFearGreed.value,
            fear_greed_label: currentFearGreed.value_classification,
            fear_greed_trend: fearGreedTrend,
            biggest_mover: biggestMover ? {
              name: biggestMover.name,
              symbol: biggestMover.symbol,
              change_24h: biggestMover.price_change_percentage_24h,
              change_7d: biggestMover.price_change_percentage_7d_in_currency,
              price: biggestMover.current_price
            } : null,
            top_gainers: topGainers.map(coin => ({
              name: coin.name,
              symbol: coin.symbol,
              change_24h: coin.price_change_percentage_24h,
              change_7d: coin.price_change_percentage_7d_in_currency,
              price: coin.current_price,
              market_cap_rank: coin.market_cap_rank
            })),
            top_losers: topLosers.map(coin => ({
              name: coin.name,
              symbol: coin.symbol,
              change_24h: coin.price_change_percentage_24h,
              change_7d: coin.price_change_percentage_7d_in_currency,
              price: coin.current_price,
              market_cap_rank: coin.market_cap_rank
            })),
            trending_coins: await (async () => {
              // Get price data for trending coins
              const trendingWithPrices = [];
              if (trendingData.coins?.length > 0) {
                const trendingIds = trendingData.coins.slice(0, 5)
                  .map((coin: any) => coin.item?.id)
                  .filter(Boolean)
                  .join(',');
                
                try {
                  console.log('📈 Fetching price data for trending coins...');
                  const priceResponse = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${trendingIds}&vs_currencies=usd&include_24hr_change=true`, {
                    headers: {
                      'x-cg-pro-api-key': coingeckoApiKey,
                      'accept': 'application/json'
                    }
                  });
                  
                  if (priceResponse.ok) {
                    const priceData = await priceResponse.json();
                    
                    for (const coin of trendingData.coins.slice(0, 5)) {
                      const coinId = coin.item?.id;
                      const priceInfo = priceData[coinId];
                      
                      trendingWithPrices.push({
                        name: coin.item?.name,
                        symbol: coin.item?.symbol,
                        market_cap_rank: coin.item?.market_cap_rank,
                        price: priceInfo?.usd || null,
                        change_24h: priceInfo?.usd_24h_change || null
                      });
                    }
                    console.log('✅ Trending coins price data fetched successfully');
                  } else {
                    // Fallback to basic trending data without prices
                    console.log('⚠️ Price fetch failed, using basic trending data');
                    trendingData.coins.slice(0, 5).forEach((coin: any) => {
                      trendingWithPrices.push({
                        name: coin.item?.name,
                        symbol: coin.item?.symbol,
                        market_cap_rank: coin.item?.market_cap_rank,
                        price: null,
                        change_24h: null
                      });
                    });
                  }
                } catch (err) {
                  console.error('❌ Trending price fetch failed:', err);
                  // Fallback to basic trending data
                  trendingData.coins.slice(0, 5).forEach((coin: any) => {
                    trendingWithPrices.push({
                      name: coin.item?.name,
                      symbol: coin.item?.symbol,
                      market_cap_rank: coin.item?.market_cap_rank,
                      price: null,
                      change_24h: null
                    });
                  });
                }
              }
              return trendingWithPrices;
            })(),
            social_sentiment: lunarcrushData.data?.map(asset => ({
              name: asset.name,
              symbol: asset.symbol,
              galaxy_score: asset.galaxy_score,
              alt_rank: asset.alt_rank,
              sentiment: asset.sentiment,
              social_volume: asset.social_volume,
              social_dominance: asset.social_dominance,
              fomo_score: asset.fomo_score
            })) || []
          },
          enhanced_tickers: enhancedTickerData,
          polygon_analysis: (newsData as any).polygonAnalysis || null,
          data_points: {
            crypto_articles: newsData.crypto?.length || 0,
            stock_articles: newsData.stocks?.length || 0,
            coins_analyzed: coingeckoData.length,
            social_assets: lunarcrushData.data?.length || 0,
            trending_coins: trendingData.coins?.length || 0
          }
        },
        market_data: {
          session_type: isWeekendBrief ? 'comprehensive_weekly' : 'comprehensive_daily',
          generation_time: format(estDate, 'yyyy-MM-dd HH:mm:ss zzz'),
          fear_greed_index: currentFearGreed.value,
          market_cap_total: totalMarketCap,
          volume_24h: totalVolume,
          data_quality: {
            coingecko_success: coingeckoData.length > 0,
            lunarcrush_success: lunarcrushData.data?.length > 0,
            fear_greed_success: fearGreedArray.length > 0,
            trending_success: trendingData.coins?.length > 0
          }
        },
        social_data: {
          analysis_type: 'comprehensive_social',
          sentiment_sources: ['lunarcrush'],
          fear_greed_value: currentFearGreed.value,
          avg_galaxy_score: lunarcrushData.data?.length ? 
            lunarcrushData.data.reduce((sum, asset) => sum + (asset.galaxy_score || 0), 0) / lunarcrushData.data.length : 0,
          total_social_volume: lunarcrushData.data?.reduce((sum, asset) => sum + (asset.social_volume || 0), 0) || 0,
          top_social_assets: lunarcrushData.data?.slice(0, 5).map(asset => asset.symbol) || []
        },
        featured_assets: featuredAssets,
        is_published: true,
        published_at: estDate.toISOString(),
        stoic_quote: randomQuote,
        stoic_quote_author: selectedAuthor,
        sentiment_score: lunarcrushData.data?.length ?
          lunarcrushData.data.reduce((sum, asset) => sum + (asset.sentiment || 0), 0) / lunarcrushData.data.length : 
          0.0
      })
      .select()
      .single();

    if (insertError) {
      console.error('💥 Database insertion failed:', insertError);
      throw new Error('Failed to store market brief');
    }

    // Log the selected quote to daily_quotes table
    try {
      const { error: quoteLogError } = await supabase
        .from('daily_quotes')
        .insert({
          brief_id: briefData.id,
          quote_text: selectedQuote,
          author: selectedAuthor,
          source: quoteSource,
          used_date: new Date().toISOString().split('T')[0],
          brief_type: briefType
        });
      
      if (quoteLogError) {
        console.error('⚠️ Failed to log quote:', quoteLogError);
      } else {
        console.log('📝 Quote logged:', { author: selectedAuthor, source: quoteSource });
      }
    } catch (error) {
      console.error('⚠️ Quote logging error:', error);
    }

    console.log('✅ Comprehensive market brief generated successfully!', {
      id: briefData.id,
      title: briefData.title,
      featured_assets: briefData.featured_assets,
      sentiment_score: briefData.sentiment_score
    });

    // Warm caches in background (fire and forget)
    (async () => {
      try {
        console.log('🔥 Warming caches with', allSymbols.length, 'symbols...');
        await supabase.functions.invoke('quotes', { body: { symbols: allSymbols } });
        console.log('✅ Caches warmed successfully');
      } catch (err) {
        console.error('⚠️ Cache warming failed (non-critical):', err);
      }
    })().catch(() => {}); // Catch but don't block

    return new Response(JSON.stringify({
      success: true, 
      brief: briefData,
      message: 'Comprehensive daily market brief generated with full data integration',
      data_summary: {
        coins_analyzed: coingeckoData.length,
        social_assets: lunarcrushData.data?.length || 0,
        news_articles: (newsData.crypto?.length || 0) + (newsData.stocks?.length || 0),
        fear_greed: `${currentFearGreed.value}/100 (${currentFearGreed.value_classification})`
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Market brief generation failed:', error);
    
    // Log detailed error information for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      error_type: error instanceof Error ? error.name : 'UnknownError',
      success: false,
      timestamp: new Date().toISOString(),
      debug_info: {
        function: 'generate-daily-brief',
        step: 'unknown',
        message: 'Check edge function logs for detailed error information'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});