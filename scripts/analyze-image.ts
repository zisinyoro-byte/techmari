import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';

async function analyzeImage() {
  const zai = await ZAI.create();

  const imagePath = '/home/z/my-project/upload/pasted_image_1775506098736.png';
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const prompt = `Analyze this sports betting results image very carefully. 

The color coding is:
- Grey = Both teams scored in both halves
- Green = BTTS (Both Teams To Score) 
- Orange = Over 1.5 FT (Full Time)
- Red = Under 1.5 FT

Extract ALL the data including:
1. Match number
2. Home team and Away team names
3. Final score
4. BTTS probability shown
5. O2.5 probability shown  
6. Confidence level (Strong/Medium/Weak)
7. The color of each result row

Create a comprehensive table of all matches with their outcomes. Then analyze patterns like:
- Which probability ranges had the most success?
- Which confidence levels performed best?
- Any correlations between BTTS prob, O2.5 prob and outcomes?
- What patterns can help with future betting decisions?`;

  const response = await zai.chat.completions.createVision({
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
        ]
      }
    ],
    thinking: { type: 'disabled' }
  });

  console.log(response.choices[0]?.message?.content);
}

analyzeImage().catch(console.error);
