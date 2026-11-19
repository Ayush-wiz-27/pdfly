import pdf from 'pdf-parse';

export async function parsePdf(buffer) {
  try {
    const data = await pdf(buffer);
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF content:', error);
    throw new Error('Failed to parse PDF file. Ensure it is a valid PDF and contains indexable text.');
  }
}

// Split text into overlapping chunks, ending at sentence boundaries when possible
export function chunkText(text, chunkSize = 500, chunkOverlap = 100) {
  if (!text || typeof text !== 'string') return [];
  
  // Clean up whitespace and newlines
  const cleanText = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!cleanText) return [];

  const chunks = [];
  let start = 0;
  const minStep = Math.max(100, chunkSize - chunkOverlap);

  while (start < cleanText.length) {
    let end = Math.min(start + chunkSize, cleanText.length);
    
    // Try to end chunk on a clean sentence boundary
    if (end < cleanText.length) {
      const searchBuffer = cleanText.substring(Math.max(start + minStep, end - 150), end);
      const sentenceEnd = Math.max(
        searchBuffer.lastIndexOf('\n'),
        searchBuffer.lastIndexOf('. '),
        searchBuffer.lastIndexOf('? '),
        searchBuffer.lastIndexOf('! ')
      );
      if (sentenceEnd !== -1) {
        end = Math.max(start + minStep, end - 150) + sentenceEnd + 1;
      }
    }
    
    const chunkStr = cleanText.substring(start, end).trim();
    if (chunkStr.length >= 50) { // Skip tiny text fragments
      chunks.push(chunkStr);
    }
    
    // Make sure we always step forward to prevent getting stuck
    const nextStart = Math.max(start + minStep, end - chunkOverlap);
    if (nextStart <= start) {
      start = start + minStep;
    } else {
      start = nextStart;
    }
  }
  
  // Remove exact or near-identical chunks
  const uniqueChunks = [];
  for (const chunk of chunks) {
    const isDuplicate = uniqueChunks.some(existing => {
      if (existing === chunk) return true;
      const shorterLen = Math.min(existing.length, chunk.length);
      if (shorterLen > 0 && (existing.includes(chunk) || chunk.includes(existing))) {
        return Math.abs(existing.length - chunk.length) / shorterLen < 0.2;
      }
      return false;
    });
    if (!isDuplicate) {
      uniqueChunks.push(chunk);
    }
  }
  
  return uniqueChunks;
}
