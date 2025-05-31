# Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.
# Wren Terminal - Database Utility
# This code is proprietary and confidential.

import sqlite3

# Connect to the database
conn = sqlite3.connect('wren.db')
cursor = conn.cursor()

# Check tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables in database:", tables)

# Check conversation data
try:
    cursor.execute("SELECT user_id, role, content FROM conversations")
    print("\nConversation data:")
    for row in cursor.fetchall():
        print(f"User: {row[0]}, Role: {row[1]}, Content: {row[2][:50]}..." if len(row[2]) > 50 else f"User: {row[0]}, Role: {row[1]}, Content: {row[2]}")
except Exception as e:
    print(f"Error querying conversations: {e}")

# Close connection
conn.close()
