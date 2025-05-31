# Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
# Wren Terminal - AI-powered conversation interface
# This code is proprietary and confidential.
# Unauthorized copying, modification, distribution, or use is strictly prohibited.

from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import asyncio
import datetime
import httpx
import json
import logging
import os
import re
import time
import traceback
from datetime import datetime
from typing import Dict, Optional, Any

# Configure logging with more visible format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration constants
CACHE_TTL = 3600  # Cache time-to-live in seconds (1 hour)
DEBUG = os.getenv("DEBUG", "False").lower() in ["true", "1", "t", "yes", "y"]

# Enable streaming responses
STREAMING_ENABLED = os.getenv("STREAMING_ENABLED", "True").lower() in ["true", "1", "t", "yes", "y"]

# In-memory cache for API responses with TTL (1 hour)
response_cache = {}  # For API response caching
conversation_histories = {}  # For conversation context management

# Setup SQLite database for persistent conversation storage
import sqlite3

def init_db():
    """Initialize the SQLite database for persistent storage including Shadowrun multiplayer tables"""
    conn = sqlite3.connect('wren.db')
    cursor = conn.cursor()
    
    # Original conversation table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS conversations (
        user_id TEXT,
        message_id INTEGER,
        role TEXT,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, message_id)
    )
    ''')
    
    # Table for RPG sessions
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS rpg_sessions (
        session_id TEXT PRIMARY KEY,
        name TEXT,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME,
        is_active BOOLEAN DEFAULT 1,
        theme TEXT DEFAULT 'shadowrunBarren',
        meta_info TEXT
    )
    ''')
    
    # Table for user session roles
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS session_users (
        session_id TEXT,
        user_id TEXT,
        role TEXT CHECK(role IN ('player', 'gm', 'observer')),
        character_name TEXT,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, user_id),
        FOREIGN KEY (session_id) REFERENCES rpg_sessions(session_id)
    )
    ''')
    
    # Table for shared scene logs
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS scene_logs (
        session_id TEXT,
        log_id INTEGER,
        user_id TEXT,
        speaker TEXT,
        content TEXT,
        command_type TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_gm_override BOOLEAN DEFAULT 0,
        PRIMARY KEY (session_id, log_id),
        FOREIGN KEY (session_id) REFERENCES rpg_sessions(session_id)
    )
    ''')
    
    # Table for active entities in a scene
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS entities (
        session_id TEXT,
        entity_id TEXT,
        name TEXT,
        type TEXT,
        status TEXT,
        description TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_updated DATETIME,
        meta_data TEXT,
        PRIMARY KEY (session_id, entity_id),
        FOREIGN KEY (session_id) REFERENCES rpg_sessions(session_id)
    )
    ''')
    
    # Table for scene information
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS scene_info (
        session_id TEXT PRIMARY KEY,
        location TEXT,
        goal TEXT,
        opposition TEXT,
        magical_conditions TEXT,
        current_scene_number INTEGER DEFAULT 1,
        last_updated DATETIME,
        FOREIGN KEY (session_id) REFERENCES rpg_sessions(session_id)
    )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized for persistent conversation and Shadowrun RPG storage")

# Initialize the database on startup
try:
    init_db()
    logger.info("Database initialization successful")
except Exception as e:
    logger.error(f"Database initialization failed: {str(e)}")

# Helper functions for API, caching and conversation management
def get_cached_response(prompt, model, max_tokens, temperature):
    """Get a cached response if it exists and is not expired."""
    cache_key = f"{prompt}:{model}:{max_tokens}:{temperature}"
    cached_item = response_cache.get(cache_key)
    if cached_item and time.time() - cached_item["timestamp"] < CACHE_TTL:
        logger.info("Using cached response for prompt")
        return cached_item["response"]
    return None

def cache_response(prompt, model, max_tokens, temperature, response):
    """Cache an API response for future use."""
    cache_key = f"{prompt}:{model}:{max_tokens}:{temperature}"
    response_cache[cache_key] = {
        "response": response,
        "timestamp": time.time()
    }
    logger.info("Cached response for future use")

def validate_openai_key(key):
    """Validate if the key looks like a valid OpenAI API key."""
    # OpenAI keys now start with "sk-" (or potentially "sk-proj-" for newer keys)
    is_valid = bool(key) and (key.startswith("sk-") or key.startswith("sk-proj-")) and len(key) > 20
    if DEBUG:
        logger.debug(f"API Key starts with: {key[:8] if key else ''}... (length: {len(key) if key else 0})")
        logger.debug(f"Validation result: {is_valid}")
    return is_valid

def get_next_api_key():
    """Rotate through available API keys for load balancing and rate limit handling."""
    # Support multiple API keys separated by commas
    api_keys_str = os.getenv("OPENAI_API_KEYS", "")
    if api_keys_str:
        # Split by comma and remove whitespace
        api_keys = [k.strip() for k in api_keys_str.split(",") if k.strip()]
        if not api_keys:
            # Fall back to single API key if the list is empty
            return os.getenv("OPENAI_API_KEY")
            
        # Simple round-robin rotation using timestamp modulo
        key_index = int(time.time()) % len(api_keys)
        selected_key = api_keys[key_index]
        logger.debug(f"Using API key {key_index + 1} of {len(api_keys)}")
        return selected_key
    else:
        # Fall back to single API key
        return os.getenv("OPENAI_API_KEY")

def user_friendly_error(error):
    """Convert API errors to user-friendly messages without exposing sensitive details."""
    if isinstance(error, httpx.HTTPStatusError):
        if error.response.status_code == 401:
            return "Authentication error with AI service. Please check your API key."
        elif error.response.status_code == 429:
            return "AI service rate limit reached. Please try again later."
        elif error.response.status_code >= 500:
            return "AI service is experiencing issues. Please try again later."
    return "An error occurred while processing your request. Please try again."

def track_api_usage(model, tokens_used, status_code, response_time):
    """Track API usage metrics for monitoring and cost analysis."""
    logger.info(f"API METRICS: model={model}, tokens={tokens_used}, status={status_code}, time={response_time:.2f}ms")
    # In a production system, you would send these metrics to a monitoring system

# Conversation context management
def get_conversation_history(user_id, max_history=10):
    """Get the conversation history for a user, up to max_history messages.
    First tries to get from database, falls back to in-memory if database fails.
    """
    try:
        # Try to get from database first
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        cursor.execute(
            "SELECT role, content FROM conversations WHERE user_id = ? ORDER BY message_id DESC LIMIT ?",
            (user_id, max_history)
        )
        results = cursor.fetchall()
        conn.close()
        
        if results:
            # Convert to the format expected by the API and reverse to get chronological order
            logger.info(f"Retrieved {len(results)} messages from database for user {user_id}")
            return [{"role": role, "content": content} for role, content in reversed(results)]
        
        # If no results from database, fall back to in-memory
        logger.debug(f"No conversation history found in database for user {user_id}, using in-memory")
    except Exception as e:
        logger.error(f"Failed to get conversation history from database: {str(e)}")
        logger.debug("Falling back to in-memory conversation history")
    
    # In-memory fallback
    if user_id not in conversation_histories:
        conversation_histories[user_id] = []
    return conversation_histories[user_id][-max_history:] if conversation_histories[user_id] else []

def add_to_conversation(user_id, role, content):
    """Add a message to the conversation history for a user."""
    if user_id not in conversation_histories:
        conversation_histories[user_id] = []
    conversation_histories[user_id].append({"role": role, "content": content})
    logger.debug(f"Added {role} message to conversation history for user {user_id}")
    
    # Also save to database if available
    try:
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        # Get the next message_id for this user
        cursor.execute(
            "SELECT COALESCE(MAX(message_id), 0) + 1 FROM conversations WHERE user_id = ?", 
            (user_id,)
        )
        message_id = cursor.fetchone()[0]
        
        cursor.execute(
            "INSERT INTO conversations (user_id, message_id, role, content) VALUES (?, ?, ?, ?)",
            (user_id, message_id, role, content)
        )
        conn.commit()
        conn.close()
        logger.debug(f"Saved message to database for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to save message to database: {str(e)}")
        # Continue with in-memory storage even if database fails

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Print loaded environment variables for debugging (without revealing the full API key)
print(f"\n===== ENVIRONMENT DEBUG =====")
api_key = os.getenv("OPENAI_API_KEY")
if api_key:
    masked_key = api_key[:6] + "*" * (len(api_key) - 10) + api_key[-4:] if len(api_key) > 10 else "*" * len(api_key)
    print(f"OpenAI API Key loaded: {masked_key} (length: {len(api_key)})")
else:
    print("OpenAI API Key: Not found")

print(f"LLM Model: {os.getenv('LLM_MODEL', 'Not set')}")
print(f"Max Tokens: {os.getenv('MAX_TOKENS', 'Not set')}")
print(f"Temperature: {os.getenv('TEMPERATURE', 'Not set')}")
print(f"Allowed Origins: {os.getenv('ALLOWED_ORIGINS', 'Not set')}")

# Print all environment variables that might contain 'key' or 'api'
print("\n----- CHECKING ALL ENVIRONMENT VARIABLES FOR API KEYS -----")
for key, value in os.environ.items():
    if 'key' in key.lower() or 'api' in key.lower():
        masked_value = value[:6] + "*" * (len(value) - 10) + value[-4:] if len(value) > 10 else "*" * len(value)
        print(f"{key}: {masked_value} (length: {len(value)})")
print("----- END ENV CHECK -----")

print(f"===== END DEBUG =====")

# Also check if .env file exists and can be read
try:
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            print(f"\n.env file exists and can be read")
            # Check for OPENAI_API_KEY in the file (without showing the key)
            for line in f.readlines():
                if line.startswith('OPENAI_API_KEY='):
                    key_value = line.split('=', 1)[1].strip()
                    masked_key = key_value[:6] + "*" * (len(key_value) - 10) + key_value[-4:] if len(key_value) > 10 else "*" * len(key_value)
                    print(f".env file contains OPENAI_API_KEY: {masked_key} (length: {len(key_value)})")
                    break
    else:
        print(f"\n.env file not found at {env_path}")
except Exception as e:
    print(f"Error checking .env file: {str(e)}")

app = Flask(__name__)

# Configure CORS with support for streaming responses
CORS(app, resources={r"/*": {
    "origins": os.getenv("ALLOWED_ORIGINS", "*").split(","),
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "Cache-Control", "X-Requested-With"],
    "expose_headers": ["Content-Type", "X-SSE-Event"]
}})

@app.route("/", methods=["GET"])
def read_root():
    return jsonify({"status": "ok", "message": "Wren API is running"})

@app.route('/execute', methods=['POST'])
def execute_command():
    data = request.get_json()
    command = data.get('command', '').strip()
    user_id = data.get('user_id', None)
    streaming = data.get('streaming', STREAMING_ENABLED)
    
    if not command:
        return jsonify({'status': 'error', 'output': 'No command provided', 'timestamp': datetime.now().isoformat()})
    try:
        if command.startswith("ask"):
            output = process_ask_command(command, user_id, streaming=streaming)
        elif command.startswith("help"):
            output = "Available commands:\n- ask [question]: Ask a question to the AI\n- help: Show this help message\n- clear: Clear conversation history"
        elif command.startswith("clear") and user_id:
            # Clear conversation history for the user
            conversation_histories[user_id] = []
            # Also clear from database
            try:
                conn = sqlite3.connect('wren.db')
                cursor = conn.cursor()
                cursor.execute("DELETE FROM conversations WHERE user_id = ?", (user_id,))
                conn.commit()
                conn.close()
                logger.info(f"Cleared conversation history from database for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to clear conversation history from database: {str(e)}")
            output = "Conversation history cleared."
        else:
            output = f"Unknown command: {command}"
        return jsonify({'status': 'success', 'output': output, 'timestamp': datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'status': 'error', 'output': f"Error: {str(e)}", 'timestamp': datetime.now().isoformat()})

@app.route('/stream', methods=['GET'])
def stream_response():
    """Endpoint for streaming responses from OpenAI API"""
    prompt = request.args.get('prompt', '')
    user_id = request.args.get('user_id', None)
    
    logger.info(f"Stream request received - prompt: '{prompt}', user_id: '{user_id}'")
    
    if not prompt:
        logger.error("Stream request missing prompt parameter")
        return jsonify({'error': 'No prompt provided'}), 400
        
    def generate():
        # Ensure all SSE data is returned as strings, not bytes
        yield "data: {\"status\": \"start\", \"content\": \"\"}\n\n"
        
        try:
            for content in call_openai_api_streaming(prompt, user_id=user_id):
                # Ensure content is a string
                if isinstance(content, bytes):
                    content = content.decode('utf-8')
                    
                # Escape any double quotes and newlines for proper JSON
                content_escaped = content.replace('"', '\\"').replace('\n', '\\n')
                message = f"data: {{\"status\": \"streaming\", \"content\": \"{content_escaped}\"}}\n\n"
                logger.info(f"Yielding stream chunk: {message[:50]}...") 
                yield message
                time.sleep(0.01)  # Small delay to avoid overwhelming the client
                
            yield "data: {\"status\": \"complete\", \"content\": \"\"}\n\n"
            
        except Exception as e:
            logger.error(f"Error in stream generation: {str(e)}")
            error_msg = f"data: {{\"status\": \"error\", \"message\": \"{str(e).replace('"', '\\"')}\"}}\n\n"
            yield error_msg
    
    response = Response(generate(), mimetype='text/event-stream')
    # Add CORS headers for EventSource compatibility
    response.headers['Cache-Control'] = 'no-cache'
    response.headers['Connection'] = 'keep-alive'
    response.headers['X-Accel-Buffering'] = 'no'
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response

def process_ask_command(command_text, user_id=None, streaming=False):
    # Extract the actual question by removing the 'ask' command
    prompt = command_text[len("ask"):].strip()
    if not prompt:
        return "Please provide a question after 'ask'."
    try:
        # Get conversation context if user_id is provided
        conversation_context = ""
        if user_id:
            history = get_conversation_history(user_id, max_history=5)
            if history:
                conversation_context = "Based on our previous conversation: " + " ".join([f"{msg['role']}: {msg['content']}" for msg in history])
                logger.info(f"Including conversation context from {len(history)} previous messages")
        
        # Include conversation context in prompt if available
        full_prompt = f"{conversation_context}\n\n{prompt}" if conversation_context else prompt
        
        if streaming:
            # For streaming, we'll just return a message indicating streaming is active
            # The actual streaming happens through the /stream endpoint
            return "[Streaming mode active. Please use the streaming client for real-time responses.]"
        else:
            # Call OpenAI API with the prompt (non-streaming)
            response_text, usage, _ = call_openai_api(full_prompt, user_id=user_id)
            
            # Append to conversation history
            if user_id:
                add_to_conversation(user_id, "user", prompt)
                add_to_conversation(user_id, "assistant", response_text)
                
            return response_text
    except Exception as e:
        logger.error(f"Error in process_ask_command: {str(e)}")
        friendly_error = user_friendly_error(e)
        return f"Error: {friendly_error}"

def call_openai_api_streaming(prompt, max_tokens=150, temperature=0.7, model="gpt-3.5-turbo", user_id=None):
    """Stream OpenAI API responses in real-time for better UX"""
    start_time = time.time()
    logger.info(f"===== STREAMING API CALL =====")
    logger.info(f"Processing LLM prompt: {prompt[:50]}..." if len(prompt) > 50 else f"Processing LLM prompt: {prompt}")
    
    # Get API key (with rotation support)
    api_key = get_next_api_key()
    
    # Validate API key
    if not api_key or api_key == "your_openai_api_key_here" or not validate_openai_key(api_key):
        logger.info("Using simulation mode due to missing or invalid API key")
        yield "[SIMULATION MODE] "
        for word in simulate_ai_response(prompt, max_tokens).split():
            yield word + " "
            time.sleep(0.05)
        return
    
    # Get conversation history for context if user_id provided
    messages = []
    if user_id:
        history = get_conversation_history(user_id, max_history=5)
        if history:
            messages.extend(history)
    
    # Add current prompt as user message
    messages.append({"role": "user", "content": prompt})
    
    # Prepare payload
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": True  # Enable streaming
    }
    
    # Prepare headers with API key
    masked_key = f"{api_key[:8]}..." if len(api_key) > 12 else "[masked]"
    logger.info(f"Using API key: {masked_key}")
    logger.info(f"Using API key starting with {api_key[:6]}... (length: {len(api_key)})")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    logger.info(f"Auth header starts with: Bearer {api_key[:8]}...")
    
    logger.info(f"Sending streaming request to OpenAI API with model: {model}, max_tokens: {max_tokens}, temperature: {temperature}")
    
    full_response = ""
    usage = {"total_tokens": 0}
    error = None
    
    try:
        # Make the API request with streaming
        with httpx.Client(timeout=60.0) as client:
            with client.stream(
                "POST",
                "https://api.openai.com/v1/chat/completions",
                json=payload,
                headers=headers
            ) as response:
                response.raise_for_status()
                
                # Process the streaming response
                for chunk in response.iter_lines():
                    # Decode bytes to string if needed
                    if isinstance(chunk, bytes):
                        chunk_str = chunk.decode('utf-8')
                    else:
                        chunk_str = chunk
                        
                    if chunk_str.startswith("data: "):
                        data_json = chunk_str[6:]  # Remove "data: " prefix
                        if data_json == "[DONE]":
                            break
                        try:
                            chunk_data = json.loads(data_json)
                            if "choices" in chunk_data and len(chunk_data["choices"]) > 0:
                                delta = chunk_data["choices"][0].get("delta", {})
                                if "content" in delta and delta["content"]:
                                    content = delta["content"]
                                    full_response += content
                                    yield content
                                    
                                # Extract usage information if available
                                if "usage" in chunk_data:
                                    usage = chunk_data["usage"]
                        except json.JSONDecodeError:
                            pass
        
        # Append conversation history after successful streaming
        if user_id and full_response:
            add_to_conversation(user_id, "user", prompt)
            add_to_conversation(user_id, "assistant", full_response)
        
        elapsed_time = (time.time() - start_time) * 1000
        logger.info(f"Streaming completed in {elapsed_time:.2f}ms")
        track_api_usage(model, usage.get("total_tokens", 0), 200, elapsed_time)
        
    except httpx.HTTPStatusError as e:
        error = e
        status_code = e.response.status_code
        error_detail = e.response.text
        logger.error(f"HTTP error during streaming: {status_code}")
        logger.error(f"Error details: {error_detail}")
        
        # Generate a user-friendly error message
        error_message = user_friendly_error(e)
        yield f"Error: {error_message}"
        
    except Exception as e:
        error = e
        logger.error(f"Exception during streaming: {str(e)}")
        yield f"Error: {str(e)}"
    
    logger.info(f"===== END STREAMING API CALL =====\n")

def call_openai_api(prompt, max_tokens=150, temperature=0.7, model="gpt-3.5-turbo", user_id=None, stream=False):
    """Call OpenAI API and return the response text, usage stats, and finish reason"""
    # Check cache first
    cached_response = get_cached_response(prompt, model, max_tokens, temperature)
    if cached_response:
        return cached_response
        
    # Get API key (with rotation support)
    api_key = get_next_api_key()
    
    # Validate API key
    if not api_key or api_key == "your_openai_api_key_here" or not validate_openai_key(api_key):
        logger.info("Using simulation mode due to missing or invalid API key")
        return simulate_ai_response(prompt, max_tokens)
    
    # Log that we're using the valid API key
    logger.info(f"Using API key: {api_key[:8]}...")

    # Add diagnostic logging for API key format (without showing the actual key)
    if api_key:
        masked_key = api_key[:6] + "*" * (len(api_key) - 10) + api_key[-4:] if len(api_key) > 10 else "*" * len(api_key)
        logger.info(f"Using API key starting with {api_key[:6]}... (length: {len(api_key)})")

    try:
        logger.info(f"Sending request to OpenAI API with model: {model}, max_tokens: {max_tokens}, temperature: {temperature}")
        
        # Prepare the chat message with system message for better context
        system_message = "You are Wren, an AI assistant that provides helpful, accurate, and concise responses to user queries through a terminal interface. Keep your responses brief and focused on answering the user's question directly."
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
        
        # Create authorization header explicitly
        auth_header = f"Bearer {api_key}"
        logger.info(f"Auth header starts with: Bearer {api_key[:8]}...")
        
        print("\n===== ATTEMPTING OPENAI API CALL =====")
        print(f"URL: https://api.openai.com/v1/chat/completions")
        print(f"Model: {model}")
        print(f"Authorization header: Bearer {api_key[:8]}... (length: {len(auth_header)})")
        
        # Make the API request with retry logic
        max_retries = 3
        retry_count = 0
        response_data = None
        retryable_status_codes = [429, 500, 502, 503, 504]  # Rate limit and server errors
        
        with httpx.Client(timeout=30.0) as client:
            # Remove any existing Authorization header from the client's defaults
            if hasattr(client, '_headers') and 'Authorization' in client._headers:
                del client._headers['Authorization']
            
            while retry_count <= max_retries:
                try:
                    # If this is a retry, log it
                    if retry_count > 0:
                        logger.info(f"Retry attempt {retry_count}/{max_retries} for OpenAI API call")
                    
                    start_time = time.time()
                    response = client.post(
                        "https://api.openai.com/v1/chat/completions",
                        json=payload,
                        headers={
                            "Authorization": auth_header,
                            "Content-Type": "application/json"
                        }
                    )
                    response_time = (time.time() - start_time) * 1000  # Convert to ms
                    
                    logger.info(f"Response status: {response.status_code}, time: {response_time:.2f}ms")
                    
                    # Try to get response text for debugging
                    try:
                        response_text = response.text
                        logger.debug(f"Response text: {response_text[:200]}{'...' if len(response_text) > 200 else ''}")
                    except Exception as text_err:
                        logger.warning(f"Could not get response text: {text_err}")
                    
                    # Check if we need to retry based on status code
                    if response.status_code in retryable_status_codes and retry_count < max_retries:
                        retry_count += 1
                        wait_time = 2 ** retry_count  # Exponential backoff: 2, 4, 8 seconds
                        logger.warning(f"Received status {response.status_code}, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                        continue
                    
                    # For non-retryable errors or if we're out of retries, raise the exception
                    response.raise_for_status()
                    
                    # Parse response JSON
                    response_data = response.json()
                    logger.info("Successfully parsed JSON response")
                    
                    # Success, break out of retry loop
                    break
                    
                except httpx.HTTPStatusError as e:
                    # If it's a retryable error and we haven't exhausted retries
                    if e.response.status_code in retryable_status_codes and retry_count < max_retries:
                        retry_count += 1
                        wait_time = 2 ** retry_count
                        logger.warning(f"HTTP error {e.response.status_code}, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"HTTP error during API call: {e.response.status_code} - {e.response.text}")
                        # Fall back to simulation after exhausting retries or for non-retryable errors
                        return simulate_ai_response(prompt, max_tokens)
                        
                except Exception as req_err:
                    logger.error(f"Error during request: {type(req_err).__name__}: {str(req_err)}")
                    # Fall back to simulation on other errors
                    return simulate_ai_response(prompt, max_tokens)
            
            print("===== END API CALL =====\n")
            
            # Extract the message content, token usage, and finish reason
            if response_data and "choices" in response_data and len(response_data["choices"]) > 0:
                text = response_data["choices"][0]["message"]["content"]
                usage = response_data.get("usage", {})
                finish_reason = response_data["choices"][0].get("finish_reason", "unknown")
                
                # Track API usage metrics
                total_tokens = usage.get("total_tokens", 0)
                track_api_usage(model, total_tokens, 200, response_time)
                
                # Store in conversation history if user_id is provided
                if user_id:
                    add_to_conversation(user_id, "user", prompt)
                    add_to_conversation(user_id, "assistant", text)
                
                # Cache successful response
                cache_response(prompt, model, max_tokens, temperature, (text, usage, finish_reason))
                
                logger.info("===== END API CALL =====\n")
                return text, usage, finish_reason
            else:
                logger.warning("No valid response data found, falling back to simulation")
                return simulate_ai_response(prompt, max_tokens)
    
    except httpx.HTTPStatusError as e:
        logger.error(f"OpenAI API HTTP Error: {e.response.status_code} - {e.response.text}")
        # Fall back to simulation if API call fails
        return simulate_ai_response(prompt, max_tokens)
    except Exception as e:
        logger.error(f"Error calling OpenAI API: {str(e)} (type: {type(e).__name__})")
        # Fall back to simulation if API call fails
        return simulate_ai_response(prompt, max_tokens)

def simulate_ai_response(prompt: str, max_tokens: int = 150) -> tuple[str, Dict[str, int], str]:
    """Simulate an AI response for testing when no API key is available"""
    logger.info(f"Simulating AI response for prompt: {prompt[:50]}{'...' if len(prompt) > 50 else ''}")
    
    # Simple responses for common questions
    responses = {
        "what is artificial intelligence": "Artificial Intelligence (AI) refers to computer systems designed to perform tasks that typically require human intelligence. These include learning, reasoning, problem-solving, perception, and language understanding. AI can be categorized into narrow AI (designed for specific tasks) and general AI (with broader human-like capabilities).",
        "tell me a joke": "Why don't scientists trust atoms? Because they make up everything!",
        "what time is it": f"I'm a simulated AI, but the current server time is {datetime.now().strftime('%H:%M:%S')}.",
        "who are you": "I'm Wren, a simulated AI assistant. In a real implementation, I would be powered by OpenAI's GPT models to provide helpful responses to your questions.",
        "hello": "Hello there! I'm Wren, your terminal assistant. How can I help you today?",
        "help": "I can answer questions and provide information on various topics. Try asking me something!"
    }
    
    # Process the prompt to match against our simple responses
    processed_prompt = prompt.lower().strip().rstrip('?').strip()
    
    # Try to find a matching response
    for key, response in responses.items():
        if processed_prompt in key or key in processed_prompt:
            sim_response = response
            break
    else:
        # Default response if no matches
        sim_response = f"[Simulated AI] I processed your input: '{prompt}'\n\nThis is a simulated response because no valid OpenAI API key was provided. Please add a valid API key to the .env file to get real AI responses."
    
    # Simulate token usage
    prompt_tokens = len(prompt.split())
    completion_tokens = len(sim_response.split())
    
    usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens
    }
    
    return sim_response, usage, "stop"

@app.route("/test_openai", methods=["GET"])
def test_openai():
    """Test endpoint for OpenAI API"""
    try:
        # Get API key directly from environment
        api_key = os.getenv("OPENAI_API_KEY")
        
        if not api_key:
            return jsonify({"error": "No API key found in environment"}), 400
            
        print(f"\n===== DIRECT OPENAI TEST =====")
        print(f"API Key from environment: {api_key[:8]}... (length: {len(api_key)})")
        
        # Prepare the authorization header
        auth_header = f"Bearer {api_key}"
        print(f"Authorization header being sent: Bearer {auth_header[7:15]}... (length: {len(auth_header)})")
        
        # Print all environment variables that contain 'openai' or 'api' or 'key'
        print("\nChecking environment variables at the time of the API call:")
        for env_key, env_value in os.environ.items():
            if any(term in env_key.lower() for term in ['openai', 'api', 'key']):
                masked_value = env_value[:8] + "..." + env_value[-4:] if len(env_value) > 12 else "[masked]"
                print(f"  {env_key}: {masked_value} (length: {len(env_value)})")
        
        # Make a simple API call with a very short prompt
        with httpx.Client(timeout=30.0) as client:
            # We'll force the API key here to make sure we're using the right one
            headers = {
                "Authorization": auth_header,
                "Content-Type": "application/json"
            }
            
            response = client.post(
                "https://api.openai.com/v1/chat/completions",
                json={
                    "model": "gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": "Say hi"}],
                    "max_tokens": 10
                },
                headers=headers
            )
            
            print(f"Response status: {response.status_code}")
            print(f"Response text: {response.text[:200]}{'...' if len(response.text) > 200 else ''}")
            
            if response.status_code == 200:
                data = response.json()
                message = data["choices"][0]["message"]["content"]
                return jsonify({
                    "success": True,
                    "message": message,
                    "response": data,
                    "api_key_used": api_key[:8] + "..." + api_key[-4:]
                })
            else:
                return jsonify({
                    "success": False,
                    "status": response.status_code,
                    "response": response.text,
                    "api_key_used": api_key[:8] + "..." + api_key[-4:]
                })
    
    except Exception as e:
        print(f"Error in test endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ===== Shadowrun RPG Multiplayer Extensions =====

# Session Management functions
def generate_session_id():
    """Generate a unique session ID for a new RPG session"""
    import uuid
    return f"sr-{str(uuid.uuid4())[:8]}"

def create_rpg_session(name, created_by, theme="shadowrunBarren", meta_info=None):
    """Create a new Shadowrun RPG session and return the session ID"""
    try:
        session_id = generate_session_id()
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        # Create session record
        cursor.execute(
            "INSERT INTO rpg_sessions (session_id, name, created_by, created_at, last_active, theme, meta_info) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, name, created_by, datetime.now(), datetime.now(), theme, json.dumps(meta_info or {}))
        )
        
        # Initialize scene info
        cursor.execute(
            "INSERT INTO scene_info (session_id, location, goal, opposition, magical_conditions, last_updated) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (session_id, "Unknown location", "Awaiting mission briefing", "Unknown", "Normal", datetime.now())
        )
        
        # Add creator as GM
        cursor.execute(
            "INSERT INTO session_users (session_id, user_id, role, character_name) VALUES (?, ?, ?, ?)",
            (session_id, created_by, "gm", "Game Master")
        )
        
        conn.commit()
        logger.info(f"Created new RPG session: {session_id} by {created_by}")
        return session_id
    except Exception as e:
        logger.error(f"Error creating RPG session: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

def join_rpg_session(session_id, user_id, role="player", character_name=None):
    """Add a user to an existing RPG session"""
    try:
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        # Check if session exists
        cursor.execute("SELECT * FROM rpg_sessions WHERE session_id = ? AND is_active = 1", (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return {"error": "Session not found or inactive"}, 404
        
        # Check if user is already in session
        cursor.execute("SELECT * FROM session_users WHERE session_id = ? AND user_id = ?", (session_id, user_id))
        existing_user = cursor.fetchone()
        
        if existing_user:
            return {"error": "User already in session", "role": existing_user[2]}, 400
        
        # Add user to session
        cursor.execute(
            "INSERT INTO session_users (session_id, user_id, role, character_name) VALUES (?, ?, ?, ?)",
            (session_id, user_id, role, character_name or f"Runner-{user_id[-4:]}")
        )
        
        # Update session last active time
        cursor.execute(
            "UPDATE rpg_sessions SET last_active = ? WHERE session_id = ?",
            (datetime.now(), session_id)
        )
        
        conn.commit()
        logger.info(f"User {user_id} joined session {session_id} as {role}")
        return {"success": True, "session_id": session_id, "role": role}, 200
    except Exception as e:
        logger.error(f"Error joining RPG session: {str(e)}")
        if conn:
            conn.rollback()
        return {"error": f"Failed to join session: {str(e)}"}, 500
    finally:
        if conn:
            conn.close()

def get_session_info(session_id):
    """Get information about an RPG session including users and scene info"""
    try:
        conn = sqlite3.connect('wren.db')
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        cursor = conn.cursor()
        
        # Get session details
        cursor.execute("SELECT * FROM rpg_sessions WHERE session_id = ?", (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return {"error": "Session not found"}, 404
        
        # Get users in session
        cursor.execute("SELECT * FROM session_users WHERE session_id = ?", (session_id,))
        users = [dict(row) for row in cursor.fetchall()]
        
        # Get scene information
        cursor.execute("SELECT * FROM scene_info WHERE session_id = ?", (session_id,))
        scene = cursor.fetchone()
        
        # Get entities in session
        cursor.execute("SELECT * FROM entities WHERE session_id = ? AND is_active = 1", (session_id,))
        entities = [dict(row) for row in cursor.fetchall()]
        
        # Get recent scene logs
        cursor.execute(
            "SELECT * FROM scene_logs WHERE session_id = ? ORDER BY log_id DESC LIMIT 20", 
            (session_id,)
        )
        logs = [dict(row) for row in cursor.fetchall()]
        logs.reverse()  # Show oldest first
        
        return {
            "session": dict(session),
            "users": users,
            "scene": dict(scene) if scene else None,
            "entities": entities,
            "logs": logs
        }, 200
    except Exception as e:
        logger.error(f"Error getting session info: {str(e)}")
        return {"error": f"Failed to get session info: {str(e)}"}, 500
    finally:
        if conn:
            conn.close()

def add_to_scene_log(session_id, user_id, content, speaker=None, command_type=None, is_gm_override=False):
    """Add an entry to the scene log for an RPG session"""
    try:
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        # Get the next log ID for this session
        cursor.execute("SELECT MAX(log_id) FROM scene_logs WHERE session_id = ?", (session_id,))
        max_id = cursor.fetchone()[0]
        log_id = 1 if max_id is None else max_id + 1
        
        # Get speaker name if not provided
        if not speaker:
            cursor.execute(
                "SELECT character_name FROM session_users WHERE session_id = ? AND user_id = ?", 
                (session_id, user_id)
            )
            result = cursor.fetchone()
            speaker = result[0] if result else f"User-{user_id[-4:]}"
        
        # Add log entry
        cursor.execute(
            "INSERT INTO scene_logs (session_id, log_id, user_id, speaker, content, command_type, is_gm_override) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, log_id, user_id, speaker, content, command_type, is_gm_override)
        )
        
        # Update session last active time
        cursor.execute(
            "UPDATE rpg_sessions SET last_active = ? WHERE session_id = ?",
            (datetime.now(), session_id)
        )
        
        conn.commit()
        return {
            "session_id": session_id,
            "log_id": log_id,
            "speaker": speaker,
            "content": content,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error adding to scene log: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

# Command processing functions for Shadowrun RPG
def process_scene_command(session_id, user_id, args):
    """Process a /scene command to set or describe the current scene"""
    try:
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        # Check if user is GM
        cursor.execute(
            "SELECT role FROM session_users WHERE session_id = ? AND user_id = ?", 
            (session_id, user_id)
        )
        user_role = cursor.fetchone()
        
        if not user_role or user_role[0] != "gm":
            return {
                "status": "error",
                "message": "Only the GM can use the /scene command"
            }
        
        scene_text = " ".join(args) if args else ""
        if not scene_text:
            # Just return current scene info
            cursor.execute("SELECT * FROM scene_info WHERE session_id = ?", (session_id,))
            scene = cursor.fetchone()
            if not scene:
                return {"status": "error", "message": "No scene information found"}
            
            return {
                "status": "success",
                "scene": {
                    "location": scene[1],
                    "goal": scene[2],
                    "opposition": scene[3],
                    "magical_conditions": scene[4],
                    "current_scene_number": scene[5]
                }
            }
        
        # Get current scene number
        cursor.execute("SELECT current_scene_number FROM scene_info WHERE session_id = ?", (session_id,))
        scene_number = cursor.fetchone()
        scene_number = scene_number[0] if scene_number else 1
        
        # Format scene text for the log
        formatted_scene = f"**SCENE {scene_number}**\n{scene_text}"
        
        # Add to scene log
        log_entry = add_to_scene_log(
            session_id, 
            user_id, 
            formatted_scene, 
            speaker="SCENE", 
            command_type="scene", 
            is_gm_override=True
        )
        
        # Update scene info with basic extraction
        # In a real implementation, you might want to use AI to extract these details
        # For now we'll just use simple heuristics
        location_match = re.search(r"location:([^\n,;.]+)", scene_text, re.IGNORECASE)
        goal_match = re.search(r"goal:([^\n,;.]+)", scene_text, re.IGNORECASE)
        opposition_match = re.search(r"opposition:([^\n,;.]+)", scene_text, re.IGNORECASE)
        magical_match = re.search(r"magical[^:]*:([^\n,;.]+)", scene_text, re.IGNORECASE)
        
        # Update what we can extract
        update_fields = []
        update_values = []
        
        if location_match:
            update_fields.append("location = ?")
            update_values.append(location_match.group(1).strip())
        
        if goal_match:
            update_fields.append("goal = ?")
            update_values.append(goal_match.group(1).strip())
            
        if opposition_match:
            update_fields.append("opposition = ?")
            update_values.append(opposition_match.group(1).strip())
            
        if magical_match:
            update_fields.append("magical_conditions = ?")
            update_values.append(magical_match.group(1).strip())
        
        # Always update scene number and timestamp
        update_fields.append("current_scene_number = ?")
        update_values.append(scene_number + 1)
        update_fields.append("last_updated = ?")
        update_values.append(datetime.now())
        
        # Execute the update
        if update_fields:
            query = f"UPDATE scene_info SET {', '.join(update_fields)} WHERE session_id = ?"
            update_values.append(session_id)
            cursor.execute(query, update_values)
        
        conn.commit()
        return {
            "status": "success",
            "message": "Scene updated",
            "log_entry": log_entry
        }
    except Exception as e:
        logger.error(f"Error processing scene command: {str(e)}")
        if conn:
            conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        if conn:
            conn.close()

def process_roll_command(session_id, user_id, args):
    """Process a /roll command for dice rolling in Shadowrun"""
    try:
        # Parse dice notation (for now just simple NdM format)
        dice_spec = args[0] if args else "1d6"
        comment = " ".join(args[1:]) if len(args) > 1 else ""
        
        # Parse dice notation like 5d6 (5 six-sided dice)
        import random
        num_dice = 1
        dice_size = 6
        
        # Handle more complex formats later, for now just extract N from NdM
        if 'd' in dice_spec:
            parts = dice_spec.lower().split('d')
            if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                num_dice = int(parts[0])
                dice_size = int(parts[1])
        elif dice_spec.isdigit():
            # If just a number, assume that many d6 (Shadowrun standard)
            num_dice = int(dice_spec)
            dice_size = 6
            
        # Limit to reasonable numbers to prevent abuse
        num_dice = min(num_dice, 100)
        
        # Roll the dice
        results = [random.randint(1, dice_size) for _ in range(num_dice)]
        
        # Count successes (5-6 on d6 for Shadowrun)
        successes = sum(1 for r in results if r >= 5)
        
        # Count glitches (1s on more than half the dice)
        ones = sum(1 for r in results if r == 1)
        glitch = ones >= num_dice / 2
        
        # Format result for display
        result_text = f"🎲 Rolled {num_dice}d{dice_size}: {results}\n"
        result_text += f"Successes: {successes}\n"
        if glitch:
            if successes == 0:
                result_text += "**CRITICAL GLITCH!**\n"
            else:
                result_text += "**GLITCH!**\n"
                
        if comment:
            result_text += f"Comment: {comment}"
        
        # Get character name
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        cursor.execute(
            "SELECT character_name FROM session_users WHERE session_id = ? AND user_id = ?", 
            (session_id, user_id)
        )
        character_name = cursor.fetchone()
        character_name = character_name[0] if character_name else f"Runner-{user_id[-4:]}"
        
        # Add to scene log
        log_entry = add_to_scene_log(
            session_id, 
            user_id, 
            result_text, 
            speaker=character_name, 
            command_type="roll"
        )
        
        return {
            "status": "success",
            "roll": {
                "dice": f"{num_dice}d{dice_size}",
                "results": results,
                "successes": successes,
                "glitch": glitch,
                "critical_glitch": glitch and successes == 0
            },
            "log_entry": log_entry
        }
    except Exception as e:
        logger.error(f"Error processing roll command: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def process_summon_command(session_id, user_id, args):
    """Process a /summon command to add an entity to the scene"""
    try:
        if not args:
            return {"status": "error", "message": "Entity name required"}
            
        entity_name = args[0]
        entity_type = args[1] if len(args) > 1 else "npc"
        description = " ".join(args[2:]) if len(args) > 2 else ""
        
        # Check if user has permission (GM or player with special abilities)
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT role FROM session_users WHERE session_id = ? AND user_id = ?", 
            (session_id, user_id)
        )
        user_role = cursor.fetchone()
        
        if not user_role:
            return {"status": "error", "message": "User not found in session"}
            
        # Only GM can summon certain entity types
        if user_role[0] != "gm" and entity_type in ["boss", "security", "threat"]:
            return {"status": "error", "message": f"Only GM can summon {entity_type} entities"}
        
        # Generate entity ID
        import uuid
        entity_id = str(uuid.uuid4())[:8]
        
        # Get character name for the log
        cursor.execute(
            "SELECT character_name FROM session_users WHERE session_id = ? AND user_id = ?", 
            (session_id, user_id)
        )
        character_name = cursor.fetchone()
        character_name = character_name[0] if character_name else f"Runner-{user_id[-4:]}"
        
        # Add the entity to the database
        cursor.execute(
            "INSERT INTO entities (session_id, entity_id, name, type, status, description, created_by, last_updated) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (session_id, entity_id, entity_name, entity_type, "active", description, user_id, datetime.now())
        )
        
        # Create log message
        if entity_type in ["spirit", "drone", "vehicle"]:
            action_text = "summoned"
        elif entity_type in ["npc", "contact"]:
            action_text = "called"
        else:
            action_text = "added"
            
        log_message = f"**{character_name}** {action_text} {entity_type} '{entity_name}' to the scene"
        if description:
            log_message += f"\n{description}"
            
        # Add to scene log
        log_entry = add_to_scene_log(
            session_id, 
            user_id, 
            log_message, 
            speaker=character_name, 
            command_type="summon"
        )
        
        conn.commit()
        return {
            "status": "success",
            "entity": {
                "id": entity_id,
                "name": entity_name,
                "type": entity_type,
                "description": description
            },
            "log_entry": log_entry
        }
    except Exception as e:
        logger.error(f"Error processing summon command: {str(e)}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return {"status": "error", "message": str(e)}
    finally:
        if 'conn' in locals() and conn:
            conn.close()

def process_echo_command(session_id, user_id, args):
    """Process an /echo command to send in-character text to the scene log"""
    try:
        if not args:
            return {"status": "error", "message": "Message text required"}
            
        message = " ".join(args)
        
        # Get character name
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        cursor.execute(
            "SELECT character_name, role FROM session_users WHERE session_id = ? AND user_id = ?", 
            (session_id, user_id)
        )
        user_info = cursor.fetchone()
        
        if not user_info:
            return {"status": "error", "message": "User not found in session"}
            
        character_name, role = user_info
        
        # Add to scene log
        log_entry = add_to_scene_log(
            session_id, 
            user_id, 
            message, 
            speaker=character_name, 
            command_type="echo"
        )
        
        return {
            "status": "success",
            "message": "Echo added to scene log",
            "log_entry": log_entry
        }
    except Exception as e:
        logger.error(f"Error processing echo command: {str(e)}")
        return {"status": "error", "message": str(e)}
    finally:
        if 'conn' in locals() and conn:
            conn.close()

# More command processing functions to be implemented for /mark, /meta, /recall, /pulse
# These will follow a similar pattern to the ones above

# ===== Shadowrun Command Routing Endpoints =====
@app.route("/api/rpg/command", methods=["POST"])
def rpg_command():
    """Process a Shadowrun RPG command and stream the response"""
    try:
        data = request.json
        session_id = data.get("session_id")
        user_id = data.get("user_id")
        command = data.get("command", "").strip()
        
        if not session_id or not user_id or not command:
            return jsonify({
                "status": "error", 
                "message": "Missing required parameters: session_id, user_id, command"
            }), 400
            
        # Check if session exists
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM rpg_sessions WHERE session_id = ? AND is_active = 1", (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return jsonify({"status": "error", "message": "Session not found or inactive"}), 404
            
        # Check if user is in session
        cursor.execute("SELECT * FROM session_users WHERE session_id = ? AND user_id = ?", (session_id, user_id))
        user_in_session = cursor.fetchone()
        
        if not user_in_session:
            return jsonify({"status": "error", "message": "User not in session"}), 403
        
        conn.close()
        
        # Parse command
        if command.startswith("/"):
            # Split command and args
            parts = command.split()
            cmd = parts[0][1:].lower()  # Remove the / and lowercase
            args = parts[1:] if len(parts) > 1 else []
            
            # Route to appropriate command handler
            if cmd == "scene":
                result = process_scene_command(session_id, user_id, args)
            elif cmd == "roll":
                result = process_roll_command(session_id, user_id, args)
            elif cmd == "summon":
                result = process_summon_command(session_id, user_id, args)
            elif cmd == "echo":
                result = process_echo_command(session_id, user_id, args)
            elif cmd in ["mark", "meta", "recall", "pulse"]:
                # For now, these are placeholders
                result = {
                    "status": "error",
                    "message": f"The /{cmd} command is not yet implemented"
                }
            else:
                result = {
                    "status": "error",
                    "message": f"Unknown command: /{cmd}"
                }
                
            return jsonify(result)
        else:
            # If not a slash command, treat as ask command
            # This will integrate with the existing AI functionality
            streaming = data.get("streaming", True)
            
            # For AI responses, we'll add a special processing tag
            if streaming:
                return Response(
                    call_openai_api_streaming(
                        prompt=command,
                        max_tokens=500,
                        user_id=user_id,
                        context={"session_id": session_id, "is_rpg": True}
                    ),
                    mimetype="text/event-stream"
                )
            else:
                response, usage, finish_reason = call_openai_api(
                    prompt=command,
                    max_tokens=500,
                    user_id=user_id,
                    context={"session_id": session_id, "is_rpg": True}
                )
                
                # Add AI response to scene log
                log_entry = add_to_scene_log(
                    session_id,
                    user_id,
                    response,
                    speaker="WREN",
                    command_type="ai"
                )
                
                return jsonify({
                    "status": "success",
                    "output": response,
                    "usage": usage,
                    "log_entry": log_entry
                })
                
    except Exception as e:
        logger.error(f"Error in rpg_command endpoint: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# Stream Shadowrun RPG events
@app.route("/api/rpg/stream/<session_id>", methods=["GET"])
def rpg_stream(session_id):
    """Stream RPG session events as they happen"""
    user_id = request.args.get("user_id")
    
    if not user_id:
        return jsonify({"status": "error", "message": "user_id parameter required"}), 400
        
    # Check if session exists and user is in session
    try:
        conn = sqlite3.connect('wren.db')
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM rpg_sessions WHERE session_id = ? AND is_active = 1", (session_id,))
        session = cursor.fetchone()
        
        if not session:
            return jsonify({"status": "error", "message": "Session not found or inactive"}), 404
            
        cursor.execute("SELECT * FROM session_users WHERE session_id = ? AND user_id = ?", (session_id, user_id))
        user_in_session = cursor.fetchone()
        
        if not user_in_session:
            return jsonify({"status": "error", "message": "User not in session"}), 403
            
        # Get last log ID for this session
        cursor.execute("SELECT MAX(log_id) FROM scene_logs WHERE session_id = ?", (session_id,))
        last_log_id = cursor.fetchone()[0] or 0
        
        conn.close()
        
        def event_stream():
            nonlocal last_log_id
            # Keep connection alive with heartbeats
            yield f"data: {json.dumps({'status': 'connected', 'session_id': session_id})}\n\n"
            
            while True:
                try:
                    # Check for new log entries
                    conn = sqlite3.connect('wren.db')
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    
                    cursor.execute(
                        "SELECT * FROM scene_logs WHERE session_id = ? AND log_id > ? ORDER BY log_id",
                        (session_id, last_log_id)
                    )
                    new_logs = [dict(row) for row in cursor.fetchall()]
                    
                    if new_logs:
                        # Update last seen log ID
                        last_log_id = max(log['log_id'] for log in new_logs)
                        
                        # Send each new log as an event
                        for log in new_logs:
                            # Convert timestamp to ISO format
                            if isinstance(log['timestamp'], str):
                                log['timestamp'] = log['timestamp']
                            else:
                                log['timestamp'] = log['timestamp'].isoformat() if hasattr(log['timestamp'], 'isoformat') else str(log['timestamp'])
                                
                            yield f"data: {json.dumps({'status': 'log', 'entry': log})}\n\n"
                    
                    # Also check for entity updates
                    cursor.execute(
                        "SELECT * FROM entities WHERE session_id = ? AND last_updated > ? ORDER BY last_updated",
                        (session_id, datetime.now() - datetime.timedelta(seconds=5))
                    )
                    new_entities = [dict(row) for row in cursor.fetchall()]
                    
                    for entity in new_entities:
                        # Convert timestamp to ISO format
                        if isinstance(entity['last_updated'], str):
                            entity['last_updated'] = entity['last_updated']
                        else:
                            entity['last_updated'] = entity['last_updated'].isoformat() if hasattr(entity['last_updated'], 'isoformat') else str(entity['last_updated'])
                            
                        yield f"data: {json.dumps({'status': 'entity_update', 'entity': entity})}\n\n"
                    
                    # Check for scene updates
                    cursor.execute(
                        "SELECT * FROM scene_info WHERE session_id = ? AND last_updated > ?",
                        (session_id, datetime.now() - datetime.timedelta(seconds=5))
                    )
                    scene_update = cursor.fetchone()
                    
                    if scene_update:
                        scene_dict = dict(scene_update)
                        # Convert timestamp
                        if isinstance(scene_dict['last_updated'], str):
                            scene_dict['last_updated'] = scene_dict['last_updated']
                        else:
                            scene_dict['last_updated'] = scene_dict['last_updated'].isoformat() if hasattr(scene_dict['last_updated'], 'isoformat') else str(scene_dict['last_updated'])
                            
                        yield f"data: {json.dumps({'status': 'scene_update', 'scene': scene_dict})}\n\n"
                    
                    # Heartbeat every 30 seconds to keep connection alive
                    yield f"data: {json.dumps({'status': 'heartbeat', 'timestamp': datetime.now().isoformat()})}\n\n"
                    
                    conn.close()  # Close connection after each check
                    
                    # Wait before checking again
                    time.sleep(2)
                    
                except Exception as e:
                    logger.error(f"Error in event stream: {str(e)}")
                    yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
                    if 'conn' in locals() and conn:
                        conn.close()
                    time.sleep(5)  # Wait longer after an error
        
        return Response(event_stream(), mimetype="text/event-stream")
        
    except Exception as e:
        logger.error(f"Error in rpg_stream endpoint: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# RPG Session API Endpoints
@app.route("/api/sessions", methods=["POST"])
def create_session():
    """Create a new Shadowrun RPG session"""
    try:
        data = request.json
        name = data.get("name", "Unnamed Shadowrun Mission")
        created_by = data.get("user_id", "anonymous")
        theme = data.get("theme", "shadowrunBarren")
        meta_info = data.get("meta_info", {})
        
        session_id = create_rpg_session(name, created_by, theme, meta_info)
        
        return jsonify({
            "success": True,
            "session_id": session_id,
            "name": name,
            "message": "Shadowrun RPG session created successfully"
        })
    except Exception as e:
        logger.error(f"Error in create_session endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/<session_id>/join", methods=["POST"])
def join_session(session_id):
    """Join an existing Shadowrun RPG session"""
    try:
        data = request.json
        user_id = data.get("user_id", "anonymous")
        role = data.get("role", "player")
        character_name = data.get("character_name")
        
        result, status_code = join_rpg_session(session_id, user_id, role, character_name)
        
        return jsonify(result), status_code
    except Exception as e:
        logger.error(f"Error in join_session endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id):
    """Get information about an RPG session"""
    try:
        result, status_code = get_session_info(session_id)
        return jsonify(result), status_code
    except Exception as e:
        logger.error(f"Error in get_session endpoint: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
