import os
from dotenv import load_dotenv

# Try to load from .env file
print("Loading environment variables from .env file")
load_dotenv()

# Print all environment variables
print("\n===== ALL ENVIRONMENT VARIABLES =====")
for key, value in sorted(os.environ.items()):
    # Mask sensitive values
    if 'key' in key.lower() or 'secret' in key.lower() or 'password' in key.lower() or 'token' in key.lower():
        masked_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "[masked]"
        print(f"{key}={masked_value} (length: {len(value)})")
    else:
        print(f"{key}={value}")
print("===== END ENVIRONMENT VARIABLES =====\n")

# Check specifically for OpenAI API key
openai_key = os.getenv('OPENAI_API_KEY')
if openai_key:
    masked_key = openai_key[:8] + "..." + openai_key[-4:] if len(openai_key) > 12 else "[masked]"
    print(f"OPENAI_API_KEY found: {masked_key} (length: {len(openai_key)})")
else:
    print("OPENAI_API_KEY not found!")

# Check for any keys that might be used as fallbacks
print("\nChecking for possible API key environment variables:")
for key in os.environ:
    if 'api' in key.lower() and 'key' in key.lower():
        value = os.environ[key]
        masked_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "[masked]"
        print(f"Possible API key found: {key}={masked_value} (length: {len(value)})")
