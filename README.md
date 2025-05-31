# Wren Terminal

**Copyright © 2025 Forest Within Therapeutic Services. All rights reserved.**

## Overview

Wren Terminal is an AI-powered therapeutic conversation interface designed to facilitate meaningful interactions in a simple terminal-style interface. The application uses advanced natural language processing to provide responsive, context-aware conversations. Now featuring Shadowrun RPG multiplayer functionality for collaborative role-playing sessions.

## Features

- **Advanced AI Integration**: Leverages OpenAI's GPT models for natural, context-aware conversations
- **Terminal-Style Interface**: Clean, distraction-free interaction experience
- **Conversation Memory**: Maintains context across multiple exchanges
- **Real-Time Streaming**: Token-by-token streaming for immediate feedback
- **Persistent Storage**: Conversation history is saved and retrievable
- **Robust Error Handling**: Graceful handling of API issues with informative feedback
- **Security**: API key rotation, secure storage, and protection against exposing sensitive information
- **Shadowrun RPG Multiplayer**:
  - Role-based UI with GM, Player, and Observer permissions
  - Specialized commands: /scene, /roll, /summon, /echo, and more
  - Real-time session synchronization for collaborative play
  - Dynamic scene management with entity tracking
  - Dedicated "Shadowrun Barren" theme

## Technical Architecture

### Backend
- Flask-based RESTful API service
- Direct OpenAI API integration via httpx (avoiding SDK compatibility issues with Python 3.13)
- SQLite database for persistent conversation and RPG session storage
- Server-Sent Events (SSE) for streaming responses and real-time updates
- Specialized RPG command routing and processing

### Frontend
- Next.js React application
- Clerk for authentication and user session management
- Clean terminal-style UI with responsive design
- Modular RPG components for session management, scene tracking, and entity visualization
- Role-based UI rendering with specialized command access

## License & Usage Restrictions

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use is strictly prohibited. This software is licensed exclusively to Forest Within Therapeutic Services and may not be used, copied, modified, or distributed without express written permission.

## Contact

For inquiries regarding this software, please contact:

**Forest Within Therapeutic Services**  
Website: [forestwithin.com](https://forestwithin.com)

---

*All trademarks and service marks are the property of their respective owners.*
