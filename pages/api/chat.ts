import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';

// Define response type
type ChatResponse = {
  output: string;
  status: string;
  timestamp: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse | { error: string }>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get auth session (optional: remove if you don't want to require authentication)
  const { userId } = getAuth(req);
  
  // Uncomment to require authentication
  // if (!userId) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'No command provided' });
    }

    // For commands that can be handled locally
    if (command.toLowerCase() === 'help') {
      return res.status(200).json({
        output: `
Available commands:
  help       - Show this help message
  clear      - Clear the console
  login      - Sign in with Clerk
  logout     - Sign out
  dashboard  - Go to dashboard
  about      - About this project
  date       - Show current date and time
  ask [question] - Ask the AI a question
        `,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    }

    // For AI-powered commands
    if (command.toLowerCase().startsWith('ask ')) {
      const question = command.substring(4).trim();
      
      // In a production app, you would call your actual backend API here
      // This is just a placeholder that mimics an API call
      const apiResponse = await fetchFromBackend(question);
      
      return res.status(200).json({
        output: apiResponse,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
    }

    // Default response for unknown commands
    return res.status(200).json({
      output: `Command processed: ${command}. For AI assistance, try 'ask [your question]'.`,
      status: 'success',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error processing command:', error);
    return res.status(500).json({
      error: 'An error occurred while processing your command',
    });
  }
}

// Function to call the Python backend API
async function fetchFromBackend(question: string): Promise<string> {
  try {
    // Get the backend URL from environment or use default localhost
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    
    // Call the execute endpoint with the ask command
    const response = await fetch(`${backendUrl}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        command: `ask ${question}`,
        user_id: 'anonymous' // You could pass the Clerk userId here if needed
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to get response from AI backend');
    }
    
    const data = await response.json();
    return data.output;
  } catch (error) {
    console.error('Error calling backend:', error);
    return `Error connecting to AI backend: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the backend server is running.`;
  }
}
