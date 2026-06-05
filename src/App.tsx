/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ChatPanel } from './components/ChatPanel';
import { ArtifactsPanel } from './components/ArtifactsPanel';
import { ChatMessage, SkillArtifacts } from './types';
import { createSkillChat } from './services/geminiService';
import { validateSkillMd } from './lib/validator';
import { Key, LogIn, LogOut, X, Bookmark, Trash2, AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentArtifacts, setCurrentArtifacts] = useState<SkillArtifacts | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [savedSkills, setSavedSkills] = useState<any[]>([]);
  const [showSavedSkills, setShowSavedSkills] = useState(false);
  const [currentSkillId, setCurrentSkillId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("gemini-3.5-flash");
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Keep chat instance in a ref so it persists across renders
  const chatRef = useRef<any>(null);

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      const q = query(
        collection(db, 'skills'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const skills = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSavedSkills(skills);
      }, (error) => {
        console.error("Firestore Error: ", error);
      });

      return () => unsubscribe();
    } else {
      setSavedSkills([]);
    }
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    try {
      setAuthError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error confirmed:", error);
      setAuthError({
        code: error.code || 'unknown',
        message: error.message || 'An unknown authentication error occurred.'
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setMessages([]);
      setCurrentArtifacts(null);
      setCurrentSkillId(null);
      chatRef.current = null;
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const saveSkillToFirestore = async (newArtifacts: SkillArtifacts) => {
    if (!user) return;
    try {
      const skillData = {
        skillName: newArtifacts.skillName,
        folderStructure: JSON.stringify(newArtifacts.folderStructure),
        skillMdContent: newArtifacts.skillMdContent,
        optionalArtifacts: JSON.stringify(newArtifacts.optionalArtifacts),
        samplePromptText: newArtifacts.samplePromptText,
        messageToUser: newArtifacts.messageToUser,
      };

      if (currentSkillId) {
        await updateDoc(doc(db, 'skills', currentSkillId), skillData);
      } else {
        const docRef = await addDoc(collection(db, 'skills'), {
          ...skillData,
          uid: user.uid,
          createdAt: serverTimestamp()
        });
        setCurrentSkillId(docRef.id);
      }
    } catch (error) {
      console.error("Error saving skill to Firestore:", error);
    }
  };

  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback if not running in AI Studio iframe
        setHasKey(true);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success immediately to mitigate race condition
      setHasKey(true);
    }
  };

  const handleSendMessage = async (text: string) => {
    // Instantiate chat right before making the call to ensure it uses the latest key
    if (!chatRef.current) {
      let history = undefined;
      if (currentArtifacts) {
        history = [
          { role: 'user', parts: [{ text: `Load the skill "${currentArtifacts.skillName}" and use it as context for further modifications.` }] },
          { role: 'model', parts: [{ text: JSON.stringify(currentArtifacts) }] }
        ];
      }
      chatRef.current = await createSkillChat(selectedModel, history);
    }
    
    setMessages(prev => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: text });
      const jsonText = response.text;
      
      if (jsonText) {
        try {
          const parsed = JSON.parse(jsonText);
          
          const artifacts: SkillArtifacts = {
            skillName: parsed.skillName,
            folderStructure: parsed.folderStructure,
            skillMdContent: parsed.skillMdContent,
            optionalArtifacts: parsed.optionalArtifacts || [],
            samplePromptText: parsed.samplePromptText || "Please process the following data...",
            messageToUser: parsed.messageToUser
          };

          const warnings = validateSkillMd(artifacts.skillMdContent, artifacts.skillName);

          setCurrentArtifacts(artifacts);
          
          if (user) {
            await saveSkillToFirestore(artifacts);
          }

          setMessages(prev => [...prev, { 
            role: 'model', 
            text: artifacts.messageToUser,
            artifacts,
            validationWarnings: warnings.length > 0 ? warnings : undefined
          }]);
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError, jsonText);
          setMessages(prev => [...prev, { 
            role: 'model', 
            text: "I encountered an error generating the structured artifacts. Please try again or rephrase your request." 
          }]);
        }
      }
    } catch (error: any) {
      console.error("API Error:", error);
      
      let errorMessage = `Sorry, there was an error communicating with the AI: ${error?.message || 'Unknown error'}. Please try again.`;
      
      if (error?.message?.includes("Requested entity was not found.")) {
        setHasKey(false);
        chatRef.current = null; // Reset chat so it recreates with the new key next time
        errorMessage = "API key not found or invalid. Please select your API key again.";
      } else if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        errorMessage = "You have exceeded your Gemini API quota or rate limit. Please check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits.";
      } else if (error?.message?.includes("API key not valid")) {
        errorMessage = "The provided API key is invalid. If you are running on Cloud Run, ensure the GEMINI_API_KEY environment variable is set correctly.";
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: errorMessage 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setCurrentArtifacts(null);
    setCurrentSkillId(null);
    chatRef.current = null;
  };

  const handleDeleteSkill = async (skillId: string) => {
    try {
      await deleteDoc(doc(db, 'skills', skillId));
      if (currentSkillId === skillId) {
        setCurrentSkillId(null);
      }
    } catch (error) {
      console.error("Error deleting skill:", error);
    }
  };

  const handleLoadSkill = (skill: any) => {
    try {
      const loadedArtifacts: SkillArtifacts = {
        skillName: skill.skillName,
        folderStructure: JSON.parse(skill.folderStructure),
        skillMdContent: skill.skillMdContent,
        optionalArtifacts: JSON.parse(skill.optionalArtifacts),
        samplePromptText: skill.samplePromptText,
        messageToUser: skill.messageToUser
      };
      setCurrentArtifacts(loadedArtifacts);
      setCurrentSkillId(skill.id);
      setMessages([{
        role: 'model',
        text: `Loaded saved skill: **${skill.skillName}**\n\n${skill.messageToUser}`,
        artifacts: loadedArtifacts
      }]);
      chatRef.current = null;
      setShowSavedSkills(false);
    } catch (error) {
      console.error("Error loading skill:", error);
    }
  };

  if (hasKey === null) {
    return <div className="flex h-screen w-full bg-zinc-950 items-center justify-center text-zinc-500">Loading...</div>;
  }

  if (hasKey === false) {
    return (
      <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 items-center justify-center font-sans">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-xl max-w-md w-full text-center shadow-2xl">
          <Key className="w-12 h-12 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">API Key Required</h2>
          <p className="text-zinc-400 mb-6 text-sm">
            This application requires a paid Google Cloud project API key to function. 
            Please select your key to continue. 
            <br/><br/>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              Learn more about billing
            </a>
          </p>
          <button 
            onClick={handleSelectKey}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <header className="flex items-center justify-between px-6 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">AI Skill Creator</h1>
          {user && (
            <button 
              onClick={() => setShowSavedSkills(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors ml-2"
            >
              <Bookmark size={14} />
              {savedSkills.length} saved
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 uppercase font-semibold tracking-wider">Model:</span>
            <select 
              value={selectedModel}
              onChange={(e) => {
                setSelectedModel(e.target.value);
                chatRef.current = null; // Reset chat session when model changes
              }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            >
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
              <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
            </select>
          </div>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-400">{user.email}</span>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
            >
              <LogIn size={16} />
              Sign In with Google
            </button>
          )}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <ChatPanel 
          messages={messages} 
          isLoading={isLoading} 
          onSendMessage={handleSendMessage} 
          onReset={handleReset}
        />
        <ArtifactsPanel artifacts={currentArtifacts} />
      </div>

      {showSavedSkills && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Bookmark size={18} className="text-blue-400" />
                Saved Skills
              </h2>
              <button onClick={() => setShowSavedSkills(false)} className="text-zinc-400 hover:text-white transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {savedSkills.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No saved skills found.</p>
              ) : (
                savedSkills.map(skill => (
                  <div key={skill.id} className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/80 rounded-lg hover:border-zinc-700 transition-colors">
                    <div>
                      <h3 className="font-medium text-zinc-200">{skill.skillName}</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        {skill.createdAt?.toDate ? new Date(skill.createdAt.toDate()).toLocaleString() : 'Recently saved'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLoadSkill(skill)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
                      >
                        Load Skill
                      </button>
                      <button
                        onClick={() => handleDeleteSkill(skill.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                        title="Delete Skill"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {authError && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl flex flex-col shadow-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-red-950/20">
              <div className="flex items-center gap-2.5 text-red-400">
                <AlertTriangle size={20} />
                <h2 className="text-lg font-semibold">Firebase Authentication Help</h2>
              </div>
              <button 
                onClick={() => setAuthError(null)} 
                className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-800"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              <div>
                <p className="text-sm text-zinc-300">
                  Firebase returned an error during the Google Sign-In flow. Under the Spark/Enterprise plans, referrers and OAuth domains must be explicitly authorized. Here is how to resolve this:
                </p>
                <div className="mt-3 p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono text-zinc-400 break-all">
                  <span className="text-red-400 font-semibold uppercase">Error Details:</span> {authError.message}
                </div>
              </div>

              {/* Step 1: GCP API Key Referrer Restrictions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold">1</span>
                  <h3 className="text-sm font-semibold text-zinc-200">Verify Website Referrer Restrictions in GCP</h3>
                </div>
                <div className="pl-8 space-y-2 text-sm text-zinc-400">
                  <p>
                    If the error mentions <code className="text-zinc-300 font-mono bg-zinc-800 px-1 py-0.5 rounded">requests-from-referer</code>, your Google Cloud API key has website security restrictions enabled. Add this site to the allowlist:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60">
                    <li>
                      Go to the {" "}
                      <a 
                        href="https://console.cloud.google.com/apis/credentials?project=landing-zone-demo-341118" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        GCP Credentials Console <ExternalLink size={12} />
                      </a>
                    </li>
                    <li>Locate and edit your browser API key.</li>
                    <li>Under <strong>Website restrictions</strong>, add these HTTP Referrers:</li>
                  </ol>
                  
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded border border-zinc-800 text-xs font-mono">
                      <span>https://ais-dev-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app/*</span>
                      <button 
                        onClick={() => handleCopy("https://ais-dev-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app/*", "dev_ref")}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {copiedKey === "dev_ref" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copiedKey === "dev_ref" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded border border-zinc-800 text-xs font-mono">
                      <span>https://ais-pre-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app/*</span>
                      <button 
                        onClick={() => handleCopy("https://ais-pre-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app/*", "pre_ref")}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {copiedKey === "pre_ref" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copiedKey === "pre_ref" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Firebase Auth Authorized Domains */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-bold">2</span>
                  <h3 className="text-sm font-semibold text-zinc-200">Add Domains to Firebase Auth</h3>
                </div>
                <div className="pl-8 space-y-2 text-sm text-zinc-400">
                  <p>
                    Ensure both development and production domains are registerd inside Firebase Authentication:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60">
                    <li>
                      Go to the {" "}
                      <a 
                        href="https://console.firebase.google.com/project/landing-zone-demo-341118/authentication/settings" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        Firebase Authentication Settings <ExternalLink size={12} />
                      </a>
                    </li>
                    <li>Click on <strong>Authorized Domains</strong> &rarr; <strong>Add domain</strong>.</li>
                    <li>Add the domains listed below:</li>
                  </ol>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded border border-zinc-800 text-xs font-mono">
                      <span>ais-dev-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app</span>
                      <button 
                        onClick={() => handleCopy("ais-dev-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app", "dev_domain")}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {copiedKey === "dev_domain" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copiedKey === "dev_domain" ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-zinc-950 rounded border border-zinc-800 text-xs font-mono">
                      <span>ais-pre-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app</span>
                      <button 
                        onClick={() => handleCopy("ais-pre-lmqt3usnnb5hdlu5zvnc33-96902608111.europe-west2.run.app", "pre_domain")}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        {copiedKey === "pre_domain" ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {copiedKey === "pre_domain" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
              <button 
                onClick={() => setAuthError(null)}
                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
