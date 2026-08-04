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

export function chunkText(text, chunkSize = 1000, chunkOverlap = 200) {
  if (!text || typeof text !== 'string') return [];
  
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  const chunks = [];
  let index = 0;
  
  while (index < cleanText.length) {
    let end = Math.min(index + chunkSize, cleanText.length);
    
    if (end < cleanText.length) {
      const searchRange = cleanText.substring(Math.max(index, end - 100), end);
      const lastSeparator = Math.max(
        searchRange.lastIndexOf('\n'),
        searchRange.lastIndexOf('.'),
        searchRange.lastIndexOf(';'),
        searchRange.lastIndexOf(':'),
        searchRange.lastIndexOf('!'),
        searchRange.lastIndexOf(" ")
      );
      
      if (lastSeparator !== -1) {
        end = Math.max(index, end - 100) + lastSeparator + 1;
      }
    }
    
    const chunk = cleanText.substring(index, end).trim();
    if (chunk.length > 5) {
      chunks.push(chunk);
    }
    
    index = Math.max(index + 1, end - chunkOverlap);
  }
  
  return chunks;
}
