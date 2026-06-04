Plan to fix the Talk-to-Spark conversation loop

1. Separate the first greeting from real conversation turns
- Keep the initial Spark greeting as a one-time startup message only.
- Prevent the Talk again button from calling the initial greeting request again after Spark has already started.
- If the student wants to continue, the button should start recording/listening, not regenerate the same welcome message.

2. Make the voice UI state clear and hard to misuse
- While Spark is speaking, hide or disable the Talk again action so the student cannot interrupt by restarting the session.
- After Spark finishes speaking, automatically enter listening mode when possible.
- If automatic recording cannot start, show a clear Start listening button instead of Talk again.
- During listening, show Done speaking so the student can submit their voice answer.

3. Fix the repeat-message behavior
- Add a guard so the initial message is appended and spoken only once per opened voice overlay.
- Reset the transcript only when the overlay is closed/reopened, not when the student tries to continue talking.
- Preserve the conversation transcript so each new voice turn is shown as You then Spark.

4. Improve failure handling for microphone/STT/TTS
- If microphone recording fails after Spark’s greeting, show a specific mic error and let the student retry listening.
- If Spark’s audio playback fails, still continue using browser speech fallback and then enter listening mode.
- If speech-to-text returns empty text, ask the student to try again instead of making Spark respond to an empty voice turn.

5. Apply the same state pattern to Quiz mode
- Prevent Start quiz / Restart quiz from being the only available action after Spark asks a question.
- Ensure the quiz flow moves from Spark speaking to listening to Done answering, without restarting the quiz or ending unexpectedly.

6. Validate after implementation
- Open Talk to Spark and confirm Spark greets once, then switches to listening.
- Speak a question, press Done speaking, and confirm Spark responds to that question instead of repeating the welcome.
- Press the continue/listen button after a turn and confirm it records a new answer rather than restarting.
- Start Quiz and confirm it asks question 1, listens for an answer, then continues to the next question.