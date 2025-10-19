import { MarketData } from './types.ts';

export function buildSundaySpecialPrompt(
  dateStr: string,
  timeStr: string,
  marketData: MarketData
): string {
  // Build comprehensive weekly data summary
  const topGainers = marketData.topCoins
    .filter(c => c.price_change_percentage_24h > 0)
    .sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)
    .slice(0, 10)
    .map(c => `${c.name} (${c.symbol.toUpperCase()}): $${c.current_price.toLocaleString()} (+${c.price_change_percentage_24h.toFixed(2)}%)`)
    .join('\n');

  const topLosers = marketData.topCoins
    .filter(c => c.price_change_percentage_24h < 0)
    .sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h)
    .slice(0, 10)
    .map(c => `${c.name} (${c.symbol.toUpperCase()}): $${c.current_price.toLocaleString()} (${c.price_change_percentage_24h.toFixed(2)}%)`)
    .join('\n');

  const socialTrending = marketData.socialSentiment.length > 0
    ? marketData.socialSentiment
        .slice(0, 10)
        .map(s => `${s.name} (${s.symbol}): Social Volume ${s.social_volume.toLocaleString()} (${s.social_volume_24h_change > 0 ? '+' : ''}${s.social_volume_24h_change.toFixed(1)}%), Sentiment ${s.sentiment.toFixed(1)}/5, Galaxy Score ${s.galaxy_score?.toFixed(0) || 'N/A'}`)
        .join('\n')
    : 'Social sentiment data unavailable';

  return `You are writing the XRayCrypto™ Sunday Special - the flagship weekly brief that subscribers wait for all week.

This is NOT a typical market recap. This is investigative journalism meets entertaining storytelling about crypto.

Think: John Oliver meets Nate Silver meets crypto research. Smart, witty, deeply researched, conversational, fun.

═══════════════════════════════════════════════════════════
🎯 CRITICAL WRITING RULES
═══════════════════════════════════════════════════════════

REQUIRED TONE:
✅ Conversational: "Let's talk about..." "Here's what actually happened..."
✅ Witty but truthful: Humor comes from truth, not sarcasm
✅ Investigative: Connect dots, reveal patterns, explain WHY
✅ Engaging: Make readers WANT to understand crypto markets
✅ Educational: Complex ideas explained simply

BANNED PHRASES (NEVER USE THESE):
❌ "making waves" / "to the moon" / "diamond hands" / "WAGMI" / "NGMI"
❌ "buckle up" / "strap in" / "hold onto your hats" / "fasten your seatbelts"
❌ Any crypto clichés or hype language
❌ "This is not financial advice" (already in disclaimer)
❌ "Let me be clear" / "At the end of the day" / "In these uncertain times"
❌ "Game changer" / "Paradigm shift" (unless mocking them)
❌ "Revolutionary" / "Groundbreaking" (unless backed by serious evidence)
❌ "Bullish" / "Bearish" used unironically without context

VOICE CHARACTERISTICS:
- Use "we" not "I" (inclusive, collaborative)
- Short punchy sentences mixed with longer analysis
- Rhetorical questions to engage reader
- Real numbers and data throughout
- Connect crypto to real-world impact
- Admit when things are uncertain
- Call out your own biases when relevant
- Use em dashes for emphasis — like this
- Pop culture references (when natural, not forced)

FORMAT REQUIREMENTS:
- Asset format: AssetName (TICKER $PRICE CHANGE%): Analysis...
- NEVER say "buy" or "sell" - educate, don't advise
- Use "could," "might," "suggests" - NEVER "will" or "must"
- Back claims with data from the market data provided

WRITING STYLE EXAMPLES:

❌ BORING: "Monero increased 15% this week due to privacy concerns."

✅ SUNDAY SPECIAL: "Let's talk about why Monero just had its best week in months. While everyone was doom-scrolling about AI companies reading your DMs, a funny thing happened: people remembered that privacy actually matters. XMR up 15%. Turns out 'blockchain transparency' isn't always a selling point when you're buying... let's call them 'totally legitimate things.'"

❌ BORING: "DeFi TVL increased to $50B this week."

✅ SUNDAY SPECIAL: "Here's a number that should make you pause: $50 billion. That's how much money is currently locked in DeFi protocols - you know, those 'definitely not banks' that everyone swore would replace actual banks. And here's the wild part: this week, TVL went UP while everyone was predicting DeFi's death. Someone forgot to tell the protocols they were supposed to be dying."

═══════════════════════════════════════════════════════════
📊 THIS WEEK'S MARKET DATA (${dateStr} at ${timeStr})
═══════════════════════════════════════════════════════════

CRYPTO ANCHORS:
Bitcoin (BTC): $${marketData.btc.price.toLocaleString()} (${marketData.btc.change_24h > 0 ? '+' : ''}${marketData.btc.change_24h.toFixed(2)}% 24h)
Ethereum (ETH): $${marketData.eth.price.toLocaleString()} (${marketData.eth.change_24h > 0 ? '+' : ''}${marketData.eth.change_24h.toFixed(2)}% 24h)

MARKET STATS:
Total Market Cap: $${(marketData.totalMarketCap / 1e9).toFixed(1)}B
BTC Dominance: ${marketData.btcDominance.toFixed(1)}%
Fear & Greed Index: ${marketData.fearGreedIndex}/100 (${marketData.fearGreedLabel})

TOP 10 WEEKLY PERFORMERS:
${topGainers}

BIGGEST DECLINERS:
${topLosers}

SOCIAL SENTIMENT LEADERS:
${socialTrending}

DERIVATIVES SIGNALS:
BTC Funding Rate: ${marketData.btcFundingRate > 0 ? '+' : ''}${marketData.btcFundingRate.toFixed(4)}%
ETH Funding Rate: ${marketData.ethFundingRate > 0 ? '+' : ''}${marketData.ethFundingRate.toFixed(4)}%

CRYPTO EQUITIES:
${marketData.coinStock ? `Coinbase (COIN): $${marketData.coinStock.close.toFixed(2)} (${marketData.coinStock.change_percent > 0 ? '+' : ''}${marketData.coinStock.change_percent.toFixed(2)}%)` : 'COIN data unavailable'}
${marketData.mstrStock ? `MicroStrategy (MSTR): $${marketData.mstrStock.close.toFixed(2)} (${marketData.mstrStock.change_percent > 0 ? '+' : ''}${marketData.mstrStock.change_percent.toFixed(2)}%)` : 'MSTR data unavailable'}

═══════════════════════════════════════════════════════════
📝 WRITE THE SUNDAY SPECIAL (TARGET: 2,200-2,800 WORDS)
═══════════════════════════════════════════════════════════

## 🎬 Section 1: "Let's talk about..." (400-500 words)
Open with a hook that makes readers care about THE story of the week.

What was the ONE thing everyone in crypto talked about this week? 
- Start conversational: "Let's talk about..."
- Set the scene with context
- Use specific data from above
- Make it relatable (why does this matter?)
- End with a transition to deeper analysis

Example opening: "Let's talk about the most boring week in crypto that somehow turned into one of the most interesting. Bitcoin did basically nothing - hovering around [price] like it was waiting for permission to move. But while the king was napping, [interesting thing] happened. Here's what actually happened..."

## 📖 Section 2: The Week in Three Acts (500-600 words)
Tell the week's story like a three-act play:

**Act 1 - The Setup (Monday-Tuesday):**
What were market expectations? Where were key prices? What was sentiment?

**Act 2 - The Twist (Wednesday-Thursday):**  
What changed? What surprised the market? Include specific price movements.

**Act 3 - The Resolution (Friday-Sunday):**
How did the week close? What positions are traders in now?

Use real data throughout. Make it flow like a story, not a list.

## 🔬 Section 3: Deep Dive Research (600-800 words)
This is where you go DEEP on the most important topic.

Pick ONE major theme from the data above:
- If social sentiment spiked - WHY? What drove it?
- If funding rates flipped - what does that mean for leverage?
- If altcoins rallied - which sectors and why?
- If Fear & Greed shifted dramatically - what changed?
- If crypto equities diverged from crypto - what's the signal?

Include:
- Multiple data points from different sources above
- Connect the dots between price, sentiment, and derivatives
- Explain the mechanism (how does X cause Y?)
- Historical context when relevant
- What this tells us about market structure

Example: "Let's actually understand what [topic] means, because the Twitter takes aren't telling the full story. Here's what the data shows..."

## ⚖️ Section 4: The Good, Bad, and "Are You Kidding Me?" (300-400 words)
Quick-hit analysis of standout moments:

**The Good:** 
What worked this week? Which assets, strategies, or developments impressed?
(2-3 examples with data)

**The Bad:**
What flopped? Where did expectations miss? What disappointed?
(2-3 examples with data)

**Are You Kidding Me?:**
The most ridiculous/surprising/jaw-dropping moment of the week.
Make it entertaining but factual. Use humor.

Example: "And then there's [thing that happened]. Yes, really. In a week where [serious thing] happened, the crypto Twitter main character award goes to..."

## 🔮 Section 5: What to Watch Next Week (200-300 words)
Forward-looking analysis based on current positioning:

**Key Levels:**
- BTC support/resistance based on current price
- ETH levels that matter
- Alt coin setups to monitor

**Catalysts:**
- Economic data releases
- Protocol updates or events  
- Sentiment shifts to watch

**Risk Factors:**
- What could disrupt the current setup?
- Funding rate warnings?
- Macro headwinds?

Close with: "Until next Sunday, stay sharp and stay data-driven."

═══════════════════════════════════════════════════════════
QUALITY CHECKLIST (YOUR BRIEF MUST PASS ALL OF THESE)
═══════════════════════════════════════════════════════════

✅ Total word count: 2,200-2,800 words
✅ Conversational tone throughout (uses "let's," "we," "you")
✅ At least one genuine laugh moment (witty, not silly)
✅ All five sections present and properly developed
✅ THE story of the week is clearly identified
✅ Deep dive section goes beyond surface level
✅ Every major claim backed by data provided above
✅ No banned phrases used
✅ No financial advice ("buy," "sell," predictions)
✅ Proper asset format: Name (TICKER $PRICE CHANGE%)
✅ Humor is truthful, not mean or cynical
✅ Complex topics explained simply
✅ Connects crypto to broader context
✅ Admits uncertainty where appropriate
✅ Makes readers WANT to come back next Sunday

═══════════════════════════════════════════════════════════

CRITICAL REMINDERS:
- This is FLAGSHIP content - make it special
- Conversational but authoritative
- Smart, funny, truthful
- Make people ENJOY reading market analysis
- Total length: 2,200-2,800 words
- Every claim backed by data provided above

Write the Sunday Special now:`;
}
