from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import json
import logging
from typing import List, Optional, Dict, Any, Union
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

app = FastAPI(title="Wren API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://wren-console.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API request/response models
class CommandRequest(BaseModel):
    command: str
    user_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class CommandResponse(BaseModel):
    output: str
    status: str = "success"
    timestamp: Optional[str] = None
    
class LLMRequest(BaseModel):
    prompt: str
    max_tokens: int = 100
    temperature: float = 0.7
    user_id: Optional[str] = None

class LLMResponse(BaseModel):
    text: str
    usage: Dict[str, int] = Field(default_factory=dict)
    model: str = Field(default="gpt-3.5-turbo")
    finish_reason: Optional[str] = None

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "Wren API is running"}

@app.post("/execute", response_model=CommandResponse)
async def execute_command(request: CommandRequest):
    cmd = request.command.lower()
    logger.info(f"Received command: {cmd}")
    
    if not cmd:
        raise HTTPException(status_code=400, detail="No command provided")
    
    # Simple command processing logic
    if cmd == "help":
        return CommandResponse(
            output="""Available API commands:
  help        - Show this help message
  status      - Show API status
  version     - Show API version
  ask [query] - Ask the AI a question""",
            timestamp=datetime.now().isoformat()
        )
    elif cmd == "status":
        return CommandResponse(
            output="All systems operational",
            timestamp=datetime.now().isoformat()
        )
    elif cmd == "version":
        return CommandResponse(
            output="Wren API v0.1.0",
            timestamp=datetime.now().isoformat()
        )
    elif cmd.startswith("ask "):
        # Extract the question
        question = cmd[4:].strip()
        if not question:
            return CommandResponse(
                output="Please provide a question after 'ask'",
                status="error",
                timestamp=datetime.now().isoformat()
            )
        
        # Process with LLM
        llm_response = await process_with_llm(question, request.user_id)
        return CommandResponse(
            output=llm_response,
            timestamp=datetime.now().isoformat()
        )
    else:
        return CommandResponse(
            output=f"Unknown command: {cmd}. Try 'help' for available commands.",
            status="error",
            timestamp=datetime.now().isoformat()
        )

@app.post("/llm/generate", response_model=LLMResponse)
async def generate_text(request: LLMRequest):
    """Direct endpoint for LLM text generation"""
    try:
        # Get configuration from environment variables
        api_key = os.getenv("OPENAI_API_KEY")
        model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
        
        if not api_key or api_key == "your_openai_api_key_here":
            logger.warning("No valid OpenAI API key found in environment variables")
            raise HTTPException(
                status_code=500, 
                detail="OpenAI API key not configured. Please set a valid API key in the backend .env file."
            )
        
        import httpx
        
        # Prepare system message for better context
        system_message = "You are Wren, an AI assistant that provides helpful, accurate, and concise responses to user queries through a terminal interface. Keep your responses brief and focused on answering the user's question directly."
        
        # Create messages array with system and user messages
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": request.prompt}
        ]
        
        # Prepare request payload
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": request.max_tokens,
            "temperature": request.temperature,
            "user": request.user_id if request.user_id else "anonymous-user"
        }
        
        # Call OpenAI API directly using httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )
            
            # Raise exception for non-200 responses
            response.raise_for_status()
            
            # Parse response JSON
            response_data = response.json()
            
            # Extract response data
            if response_data.get("choices") and len(response_data["choices"]) > 0:
                response_text = response_data["choices"][0]["message"]["content"]
                finish_reason = response_data["choices"][0].get("finish_reason", "unknown")
                usage = response_data.get("usage", {})
                
                # Return the formatted response
                return LLMResponse(
                    text=response_text,
                    usage={
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0),
                        "total_tokens": usage.get("total_tokens", 0)
                    },
                    model=model,
                    finish_reason=finish_reason
                )
            else:
                logger.error(f"Unexpected response format from OpenAI API: {response_data}")
                raise HTTPException(status_code=500, detail="Received unexpected response format from AI service")
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from OpenAI API: {e.response.status_code} - {e.response.text}")
        error_msg = f"API Error {e.response.status_code}"
        try:
            error_data = e.response.json()
            if "error" in error_data and "message" in error_data["error"]:
                error_msg += f": {error_data['error']['message']}"
        except:
            pass
        raise HTTPException(status_code=e.response.status_code, detail=error_msg)
    
    except Exception as e:
        logger.error(f"Error generating LLM response: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_with_llm(prompt: str, user_id: Optional[str] = None) -> str:
    """Process a prompt with an LLM using OpenAI API via direct httpx calls"""
    logger.info(f"Processing LLM prompt: {prompt[:50]}{'...' if len(prompt) > 50 else ''}")
    
    # Get configuration from environment variables
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("LLM_MODEL", "gpt-3.5-turbo")
    max_tokens = int(os.getenv("MAX_TOKENS", "150"))
    temperature = float(os.getenv("TEMPERATURE", "0.7"))
    
    if not api_key or api_key == "your_openai_api_key_here":
        logger.warning("No valid OpenAI API key found in environment variables")
        return "Error: OpenAI API key not configured. Please set a valid API key in the backend .env file."
    
    try:
        import httpx
        
        # Prepare system message for better context
        system_message = "You are Wren, an AI assistant that provides helpful, accurate, and concise responses to user queries through a terminal interface. Keep your responses brief and focused on answering the user's question directly."
        
        # Create messages array with system and user messages
        messages = [
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ]
        
        # Prepare request payload
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "user": user_id if user_id else "anonymous-user"
        }
        
        # Call OpenAI API directly using httpx
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                json=payload,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )
            
            # Raise exception for non-200 responses
            response.raise_for_status()
            
            # Parse response JSON
            response_data = response.json()
            
            # Extract and return the response text
            if response_data.get("choices") and len(response_data["choices"]) > 0:
                if "message" in response_data["choices"][0] and "content" in response_data["choices"][0]["message"]:
                    return response_data["choices"][0]["message"]["content"]
                
            # If we can't find the expected response format
            logger.error(f"Unexpected response format from OpenAI API: {response_data}")
            return "Error: Received unexpected response format from AI service."
    
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error from OpenAI API: {e.response.status_code} - {e.response.text}")
        error_msg = f"API Error {e.response.status_code}"
        try:
            error_data = e.response.json()
            if "error" in error_data and "message" in error_data["error"]:
                error_msg += f": {error_data['error']['message']}"
        except:
            pass
        return f"Error: {error_msg}"
        
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)}")
        return f"Error processing your request: {str(e)}"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
