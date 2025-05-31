import os
import httpx
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get API key from environment
api_key = os.getenv("OPENAI_API_KEY")

print(f"\n===== OPENAI API KEY TEST =====")
print(f"API Key loaded: {'Yes' if api_key else 'No'}")
if api_key:
    masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "[too short]"
    print(f"API Key format: {masked_key} (length: {len(api_key)})")

# Try making a simple API call
print("\n===== ATTEMPTING API CALL =====")
try:
    with httpx.Client(timeout=30.0) as client:
        print("Sending request to OpenAI API...")
        response = client.post(
            "https://api.openai.com/v1/chat/completions",
            json={
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "user", "content": "Say hello"}],
                "max_tokens": 10
            },
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        
        # Print response text
        try:
            response_text = response.text
            print(f"Raw response: {response_text}")
            
            # Try to parse JSON
            try:
                json_data = response.json()
                print("\n===== PARSED JSON RESPONSE =====")
                print(json.dumps(json_data, indent=2))
                
                # Check if we got a valid response with choices
                if "choices" in json_data and len(json_data["choices"]) > 0:
                    message_content = json_data["choices"][0]["message"]["content"]
                    print(f"\nAI Response: {message_content}")
                    print("✅ API CALL SUCCESSFUL!")
                else:
                    print("❌ No valid choices in response")
            except json.JSONDecodeError:
                print("❌ Could not parse response as JSON")
        except Exception as e:
            print(f"❌ Error reading response: {e}")
        
except Exception as e:
    print(f"❌ Error making API call: {type(e).__name__}: {str(e)}")

print("\n===== TEST COMPLETE =====")
