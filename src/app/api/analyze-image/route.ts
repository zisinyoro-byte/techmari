import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const zai = await ZAI.create();

    const imagePath = '/home/z/my-project/upload/pasted_image_1775506098736.png';
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analyze this sports betting results image very carefully and extract ALL data.

The color coding is:
- Grey = Both teams scored in both halves
- Green = BTTS (Both Teams To Score) 
- Orange = Over 1.5 FT (Full Time)
- Red = Under 1.5 FT

For each match, extract:
1. Match number/row
2. Home team vs Away team names
3. Final score (e.g., 2-1)
4. BTTS probability percentage shown
5. O2.5 probability percentage shown
6. Confidence level (Strong/Medium/Weak)
7. The color of the row (grey/green/orange/red)

Create a detailed JSON table with all matches, then provide pattern analysis:
- Success rates by probability ranges
- Performance by confidence level
- Correlations between BTTS prob, O2.5 prob and outcomes
- Key insights for future betting`;

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ] as any
        }
      ]
    });

    return NextResponse.json({
      success: true,
      analysis: response.choices[0]?.message?.content
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
