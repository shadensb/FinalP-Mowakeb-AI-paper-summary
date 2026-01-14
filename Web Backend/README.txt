MOWAKEB Multi-page Site (v5)

What's new in this version:
- Home search form now:
  - Saves the selected field and topic to localStorage.
  - Redirects to a new results page (results.html).
- New "results.html" page:
  - Shows the topic and field from the last search.
  - Contains an example AI-generated summary area (demo text).
  - Provides four main actions:
    - Download summary (PDF)
    - Play audio
    - Discuss with AI (placeholder alert)
    - Send to tracker (links to tracking.html)
  - Shows a placeholder list of "Top 5 papers" for UI demonstration.

Buttons behavior:
- Download summary (PDF):
  - Uses jsPDF (CDN) if available to export the demo summary as a PDF file.
  - If jsPDF is not available, shows a short message explaining this is a future feature.
- Play audio:
  - Uses the browser Speech Synthesis API to read the summary text in English.
  - If not supported, shows a short message.
- Discuss with AI:
  - For now, shows a message describing that this will open a chat with an AI assistant in the future.
- Send to tracker:
  - Simple link to tracking.html so the user can manually add the paper/topic to their favorites.

Other:
- Login and Sign up buttons are hidden in the navbar whenever a user is logged in (localStorage-based).
- Profile and Tracking buttons are visible only when logged in.

Files:
- index.html
- login.html
- signup.html
- profile.html
- tracking.html
- results.html
- styles.css
- script.js
- README.txt

Add your logo:
- Save your logo image in this folder as: logo.png

Deploy:
- Drag and drop the whole folder into Netlify to deploy.
