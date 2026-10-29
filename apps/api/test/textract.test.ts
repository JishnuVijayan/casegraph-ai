import { parseTextractBlocks } from '../src/extraction/textract';

test('maps Textract WORD blocks into OBSERVED-compatible regions with amounts', () => {
  const result = parseTextractBlocks([
    { BlockType: 'WORD', Text: 'INR', Confidence: 99, Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.08, Height: 0.05 } } },
    { BlockType: 'WORD', Text: '2500', Confidence: 98, Geometry: { BoundingBox: { Left: 0.2, Top: 0.2, Width: 0.1, Height: 0.05 } } },
    { BlockType: 'LINE', Text: 'ignore lines', Confidence: 90, Geometry: { BoundingBox: { Left: 0, Top: 0, Width: 1, Height: 1 } } },
  ]);
  expect(result.outputText).toBe('INR 2500');
  expect(result.regions.some((r) => r.kind === 'AMOUNT' && r.text.includes('2500'))).toBe(true);
  expect(result.version).toBe('detect-document-text');
});
