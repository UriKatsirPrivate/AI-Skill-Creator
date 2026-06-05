import React, { useState, useMemo } from 'react';
import { SkillArtifacts } from '../types';
import { Folder, File, Code, Terminal, FileText, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import JSZip from 'jszip';

interface ArtifactsPanelProps {
  artifacts: SkillArtifacts | null;
}

type TreeNode = {
  name: string;
  type: 'folder' | 'file';
  path: string;
  children: Record<string, TreeNode>;
};

function buildTree(items: { path: string; type: string }[]): TreeNode {
  const root: TreeNode = { name: 'root', type: 'folder', path: '', children: {} };

  items.forEach(item => {
    const normalizedPath = item.path.replace(/^\/|\/$/g, '');
    if (!normalizedPath) return;
    
    const parts = normalizedPath.split('/');
    let current = root;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          type: i === parts.length - 1 ? (item.type as 'folder' | 'file') : 'folder',
          path: parts.slice(0, i + 1).join('/'),
          children: {}
        };
      } else if (i === parts.length - 1 && item.type === 'file') {
        current.children[part].type = 'file';
      }
      current = current.children[part];
    }
  });

  return root;
}

function TreeView({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const children = Object.values(node.children).sort((a, b) => {
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });

  if (children.length === 0) return null;

  return (
    <div className={cn("flex flex-col", level > 0 && "ml-4 border-l border-zinc-800 pl-3 mt-1")}>
      {children.map((child) => (
        <div key={child.path} className="flex flex-col">
          <div className="flex items-center space-x-2 py-1.5 group">
            {child.type === 'folder' ? (
              <Folder size={16} className="text-blue-400 shrink-0" />
            ) : (
              <File size={16} className="text-zinc-400 shrink-0" />
            )}
            <span className={cn(
              "truncate transition-colors",
              child.type === 'folder' ? 'text-blue-400 font-medium' : 'text-zinc-300 group-hover:text-zinc-100'
            )}>
              {child.name}
            </span>
          </div>
          {child.type === 'folder' && (
            <TreeView node={child} level={level + 1} />
          )}
        </div>
      ))}
    </div>
  );
}

export function ArtifactsPanel({ artifacts }: ArtifactsPanelProps) {
  const [activeTab, setActiveTab] = useState<'folder' | 'skill' | 'optional' | 'python'>('folder');

  const treeData = useMemo(() => {
    if (!artifacts) return null;
    return buildTree(artifacts.folderStructure);
  }, [artifacts]);

  if (!artifacts) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <Code className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Submit a use case to generate an AI Skill.</p>
        </div>
      </div>
    );
  }

  const pythonCode = `# Test script for Gemini Skill: ${artifacts.skillName}
# Make sure to install the Google GenAI SDK: pip install google-genai

import os
from google import genai
from google.genai import types

# Initialize the Gemini client (reads GEMINI_API_KEY from environment)
client = genai.Client()

# Load the generated skill's custom instruction set
try:
    with open("skill.md", "r") as f:
        skill_instructions = f.read()
except FileNotFoundError:
    skill_instructions = """${artifacts.skillMdContent.replace(/"""/g, '\\"\\"\\""')}"""

prompt = """${artifacts.samplePromptText}"""

print("Executing prompt using Gemini custom skill rules...\\n")

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt,
    config=types.GenerateContentConfig(
        system_instruction=skill_instructions,
        temperature=0.2,
    ),
)

print("Response from Gemini:")
print(response.text)`;

  const handleDownloadZip = async () => {
    if (!artifacts) return;
    
    const zip = new JSZip();
    
    // Add skill.md
    zip.file('skill.md', artifacts.skillMdContent);
    
    // Add optional artifacts
    artifacts.optionalArtifacts.forEach(artifact => {
      // Ensure we don't have leading slashes that might confuse jszip
      const path = artifact.filePath.replace(/^\//, '');
      zip.file(path, artifact.content);
    });
    
    // Add python test
    zip.file('test_skill.py', pythonCode);
    
    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifacts.skillName.replace(/\s+/g, '_').toLowerCase()}_skill.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 border-l border-zinc-800 h-full overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center space-x-1">
          <TabButton active={activeTab === 'folder'} onClick={() => setActiveTab('folder')} icon={<Folder size={16} />}>
            Structure
          </TabButton>
          <TabButton active={activeTab === 'skill'} onClick={() => setActiveTab('skill')} icon={<FileText size={16} />}>
            SKILL.md
          </TabButton>
          <TabButton active={activeTab === 'optional'} onClick={() => setActiveTab('optional')} icon={<File size={16} />}>
            Optional Artifacts
          </TabButton>
          <TabButton active={activeTab === 'python'} onClick={() => setActiveTab('python')} icon={<Terminal size={16} />}>
            Python Test
          </TabButton>
        </div>
        <button 
          onClick={handleDownloadZip}
          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
          title="Download all files as ZIP"
        >
          <Download size={16} />
          <span>Download ZIP</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'folder' && (
          <div className="font-mono text-sm">
            <h3 className="text-zinc-400 mb-4 uppercase tracking-wider text-xs font-semibold">Folder Structure</h3>
            <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 overflow-x-auto">
              {treeData && <TreeView node={treeData} />}
            </div>
          </div>
        )}
        
        {activeTab === 'skill' && (
          <div className="h-full flex flex-col">
            <h3 className="text-zinc-400 mb-4 uppercase tracking-wider text-xs font-semibold">SKILL.md</h3>
            <pre className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 overflow-auto flex-1 text-sm font-mono text-zinc-300 whitespace-pre-wrap">
              {artifacts.skillMdContent}
            </pre>
          </div>
        )}
        
        {activeTab === 'optional' && (
          <div className="h-full flex flex-col">
            <h3 className="text-zinc-400 mb-4 uppercase tracking-wider text-xs font-semibold">Optional Artifacts</h3>
            {artifacts.optionalArtifacts.length === 0 ? (
              <p className="text-zinc-500 italic">No optional artifacts generated.</p>
            ) : (
              <div className="space-y-6">
                {artifacts.optionalArtifacts.map((artifact, i) => (
                  <div key={i}>
                    <div className="bg-zinc-800 text-zinc-300 px-3 py-1.5 text-xs font-mono rounded-t-lg border border-zinc-700 border-b-0 inline-block">
                      {artifact.filePath}
                    </div>
                    <pre className="bg-zinc-900 p-4 rounded-b-lg rounded-tr-lg border border-zinc-800 overflow-auto text-sm font-mono text-zinc-300 whitespace-pre-wrap">
                      {artifact.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'python' && (
          <div className="h-full flex flex-col">
            <h3 className="text-zinc-400 mb-4 uppercase tracking-wider text-xs font-semibold">Python Execution Sample</h3>
            <pre className="bg-zinc-900 p-4 rounded-lg border border-zinc-800 overflow-auto flex-1 text-sm font-mono text-zinc-300 whitespace-pre-wrap">
              {pythonCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, icon }: { active: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
        active ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
      )}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}
