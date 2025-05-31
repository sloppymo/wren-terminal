#!/usr/bin/env python
# Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
# Wren Terminal Streaming Test Script

import httpx
import sys
import time
import json

def test_streaming():
    """Test the streaming endpoint of the Wren Terminal API."""
    prompt = "Who is Jules?" if len(sys.argv) < 2 else sys.argv[1]
    user_id = "python_test_user"
    
    print(f"Testing streaming with prompt: '{prompt}'")
    print("Connecting to streaming endpoint...")
    
    # Configure the URL with proper encoding for query parameters
    import urllib.parse
    encoded_prompt = urllib.parse.quote(prompt)
    url = f"http://localhost:8000/stream?prompt={encoded_prompt}&user_id={user_id}"
    
    print(f"Requesting: {url}")
    
    try:
        with httpx.Client(timeout=30.0) as client:
            with client.stream("GET", url) as response:
                if response.status_code != 200:
                    print(f"Error: Received status code {response.status_code}")
                    print(response.text)
                    return
                
                print("\nReceiving stream data:")
                print("-" * 50)
                
                full_response = ""
                for chunk in response.iter_lines():
                    if not chunk:
                        continue
                        
                    # Print raw chunk for debugging
                    print(f"Raw chunk: {chunk}")
                    
                    # Process SSE format
                    if isinstance(chunk, bytes):
                        chunk_str = chunk.decode('utf-8')
                    else:
                        chunk_str = chunk
                        
                    if chunk_str.startswith("data: "):
                        data_str = chunk_str[6:]
                        try:
                            data = json.loads(data_str)
                            if data.get("status") == "streaming" and "content" in data:
                                content = data["content"]
                                full_response += content
                                print(content, end="", flush=True)
                            elif data.get("status") == "complete":
                                print("\n\nStream complete.")
                            elif data.get("status") == "error":
                                print(f"\n\nError from server: {data.get('message')}")
                        except json.JSONDecodeError as e:
                            print(f"\nError parsing JSON: {e}")
                            print(f"Data: {data_str}")
                
                print("\n" + "-" * 50)
                print(f"Full response: {full_response}")
                
    except Exception as e:
        print(f"Error connecting to streaming endpoint: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    test_streaming()
