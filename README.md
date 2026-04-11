# AI Skill Creator

AI Skill Creator is a powerful tool designed to help developers and AI engineers dynamically generate, manage, and test **AI Skills**. It provides a streamlined workflow for taking a natural language use case and turning it into a structured set of artifacts compatible with modern AI agent frameworks.

## Features

- **Dynamic Skill Generation**: Uses Gemini 3.1 Pro and Gemini 3 Flash to generate comprehensive skill artifacts.
- **Hierarchical Visualization**: View your skill's folder structure in a clear, nested tree view.
- **Firebase Integration**:
  - **Secure Authentication**: Google Sign-in via Firebase Auth.
  - **Data Persistence**: Save, load, and manage your skills using Cloud Firestore.
- **Artifact Management**:
  - **SKILL.md Generation**: Automatically creates the core instruction file with YAML frontmatter.
  - **Optional Artifacts**: Generates supporting scripts, references, and assets.
  - **Python Test Scripts**: Provides ready-to-use Python code to test your skill.
- **Export Capabilities**: Download your entire skill structure as a ZIP archive for local development or deployment.
- **Model Selection**: Toggle between high-reasoning (Pro) and high-speed (Flash) models.

## Getting Started

### Prerequisites

- A Google Cloud Project with the Gemini API enabled.
- A Firebase Project for authentication and database features.

### Setup

1. **API Key**: Ensure you have a valid Gemini API key. In the AI Studio environment, use the built-in key selection dialog.
2. **Firebase Configuration**:
   - The app expects a `firebase-applet-config.json` file in the root directory.
   - Ensure your domain (e.g., `skill.genaitools.cloud`) is added to the **Authorized Domains** list in the Firebase Console.

### Development

```bash
# Install dependencies
npm install

# Start the development server (Express + Vite)
npm run dev
```

## Project Structure

- `src/components/`: React components for the Chat and Artifacts panels.
- `src/services/`: Integration logic for the Gemini API.
- `src/firebase.ts`: Firebase initialization and configuration.
- `server.ts`: Express server for handling runtime environment variables and serving the app.
- `firestore.rules`: Security rules for protecting user data in Firestore.

## Security

- **Least Privilege**: Firestore rules ensure users can only access their own data.
- **Environment Variables**: Sensitive keys are managed server-side and injected at runtime.

## License

Apache-2.0
