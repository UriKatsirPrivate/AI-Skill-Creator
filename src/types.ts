export interface SkillArtifacts {
  skillName: string;
  folderStructure: { path: string; type: string }[];
  skillMdContent: string;
  optionalArtifacts: { filePath: string; content: string }[];
  samplePromptText: string;
  messageToUser: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  artifacts?: SkillArtifacts;
  validationWarnings?: string[];
}
