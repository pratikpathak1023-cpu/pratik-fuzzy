
import { RowData, MatchResult } from '../types';
import { GoogleGenAI } from "@google/genai";

// Standard Levenshtein Distance for basic matching
const getLevenshteinDistance = (s1: string, s2: string): number => {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[len1][len2];
};

const calculateSimilarity = (s1: string, s2: string): number => {
  const distance = getLevenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 1.0;
  return 1.0 - distance / maxLength;
};

export const performFuzzyLookup = async (
  data: RowData[],
  customerCol: string,
  rplCol: string,
  onProgress: (p: number) => void
): Promise<MatchResult[]> => {
  const results: MatchResult[] = [];
  const rplValues = data.map(row => String(row[rplCol] || '').trim()).filter(v => v !== '');
  const uniqueRplValues = Array.from(new Set(rplValues));

  for (let i = 0; i < data.length; i++) {
    const customer = String(data[i][customerCol] || '').trim();
    const originalRpl = String(data[i][rplCol] || '').trim();

    if (!customer) {
      results.push({
        customer: '',
        originalRpl,
        matchedRpl: 'N/A',
        similarity: 0,
        status: 'No Match',
        index: i
      });
      continue;
    }

    let bestMatch = '';
    let maxSimilarity = -1;

    for (const rpl of uniqueRplValues) {
      const sim = calculateSimilarity(customer, rpl);
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
        bestMatch = rpl;
      }
    }

    let status: MatchResult['status'] = 'No Match';
    if (maxSimilarity > 0.85) status = 'High';
    else if (maxSimilarity > 0.6) status = 'Medium';
    else if (maxSimilarity > 0.3) status = 'Low';

    results.push({
      customer,
      originalRpl,
      matchedRpl: bestMatch,
      similarity: parseFloat((maxSimilarity * 100).toFixed(2)),
      status,
      index: i
    });

    onProgress(Math.round(((i + 1) / data.length) * 100));
    
    // Slight delay to allow UI to breathe on large sets
    if (i % 100 === 0) await new Promise(r => setTimeout(r, 0));
  }

  return results;
};

export const getGeminiInsights = async (matches: MatchResult[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const lowMatches = matches.filter(m => m.status === 'Low' || m.status === 'Medium').slice(0, 5);
    
    const prompt = `
      Analyze these fuzzy match results between Customer names and Restricted Party List (RPL) entries.
      Focus on patterns of potential risk or data entry errors.
      
      Examples:
      ${lowMatches.map(m => `- Customer: ${m.customer}, Match: ${m.matchedRpl} (${m.similarity}% similarity)`).join('\n')}
      
      Provide a brief summary (2-3 sentences) of the overall data quality and highlight if any "Low" matches look suspicious enough to warrant manual review.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional data compliance analyst."
      }
    });

    return response.text || "Analysis complete. No significant patterns detected.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "AI insights currently unavailable.";
  }
};
