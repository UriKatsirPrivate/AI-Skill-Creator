import { GoogleGenAI, Type } from "@google/genai";

const systemInstruction = `You are an expert AI engineer and Gemini Skill Creator.
Your task is to take a user's use case and dynamically generate all necessary artifacts to build a complete Gemini Skill.

Rules for Gemini Skills:
1. Structure: A skill is a folder containing a mandatory SKILL.md file. Optional subdirectories include scripts/ (for executable code), references/ (for documentation), and assets/.
2. Naming Strictness: The folder name must be in kebab-case (no spaces, no capitals, no underscores). The main file must be exactly named SKILL.md (case-sensitive).
3. YAML Frontmatter: The SKILL.md file MUST begin with YAML frontmatter containing:
   - name: Exactly matching the folder name (kebab-case).
   - description: Under 1024 characters. Must include WHAT the skill does and specific trigger phrases for WHEN to use it. Do NOT use XML tags (< or >) in the frontmatter.
4. Instructions: The body of SKILL.md should use Markdown. It should use progressive disclosure (keeping instructions focused and linking to files in references/ for deep details) and provide step-by-step workflow guidance.

You must return your response in JSON format matching the provided schema. Include a conversational message to the user explaining what you did or asking for further optimization. Also provide a 'samplePromptText' which is a realistic example of the text or data a user would provide when prompting this skill, making the Python test script specific to the use case.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    skillName: { type: Type.STRING, description: "The kebab-case name of the skill" },
    folderStructure: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          path: { type: Type.STRING, description: "e.g., my-skill/SKILL.md" },
          type: { type: Type.STRING, description: "'file' or 'folder'" }
        },
        required: ["path", "type"]
      }
    },
    skillMdContent: { type: Type.STRING, description: "The exact content of the SKILL.md file" },
    optionalArtifacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          filePath: { type: Type.STRING, description: "e.g., my-skill/scripts/process.py" },
          content: { type: Type.STRING }
        },
        required: ["filePath", "content"]
      }
    },
    samplePromptText: { type: Type.STRING, description: "A realistic example of the text or data a user would provide when prompting this skill." },
    messageToUser: { type: Type.STRING, description: "A conversational response to the user explaining the changes or asking for clarification." }
  },
  required: ["skillName", "folderStructure", "skillMdContent", "optionalArtifacts", "samplePromptText", "messageToUser"]
};

export async function generateSkillResponse(model: string, history: any[], message: string): Promise<string> {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT || "landing-zone-demo-341118",
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
  });

  const chat = ai.chats.create({
    model,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
    },
    history,
  });

  const response = await chat.sendMessage({ message });

  return response.text;
}
