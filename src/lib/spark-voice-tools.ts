// JSON-Schema-style definitions for the ElevenLabs client tools that let
// Spark control the student tablet's apps by voice. The same catalog drives
// (a) the PATCH sent to the agent so it KNOWS the tool names + parameters,
// and (b) the handler names mounted by the React client.

export type VoiceToolDef = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<
      string,
      {
        type: "string" | "number" | "boolean";
        description?: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
};

export const SPARK_VOICE_TOOLS: VoiceToolDef[] = [
  // ----- Messages -----
  {
    name: "send_message",
    description:
      "Send a message from the student to one of their teachers. The teacher is identified by their name or the subject they teach.",
    parameters: {
      type: "object",
      properties: {
        teacher: {
          type: "string",
          description:
            "Teacher's name or the subject they teach, e.g. 'math', 'science teacher', 'Mrs Sharma'.",
        },
        body: { type: "string", description: "The message body to send." },
      },
      required: ["teacher", "body"],
    },
  },
  {
    name: "list_recent_messages",
    description:
      "Read back the most recent messages with a teacher. Use to answer questions like 'what did my teacher say?'.",
    parameters: {
      type: "object",
      properties: {
        teacher: {
          type: "string",
          description:
            "Teacher name or subject. Leave empty to list latest unread across all teachers.",
        },
        limit: { type: "number", description: "How many messages to read back (default 3)." },
      },
    },
  },

  // ----- Notes -----
  {
    name: "add_note",
    description: "Save a quick note on the student tablet.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Note content." },
      },
      required: ["text"],
    },
  },
  {
    name: "list_notes",
    description: "Read the student's most recent notes.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "How many notes to read (default 5)." },
      },
    },
  },
  {
    name: "delete_note",
    description:
      "Delete a note. Pass match='last' for the most recent note, or any text fragment that appears in the note.",
    parameters: {
      type: "object",
      properties: {
        match: { type: "string", description: "'last' or a substring of the note." },
      },
      required: ["match"],
    },
  },

  // ----- To-do -----
  {
    name: "add_todo",
    description: "Add a task to the student's to-do list.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Task description." },
      },
      required: ["text"],
    },
  },
  {
    name: "list_todos",
    description: "Read the student's to-do list.",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          enum: ["all", "open", "done"],
          description: "Which tasks to read (default 'open').",
        },
      },
    },
  },
  {
    name: "complete_todo",
    description: "Mark a to-do task as done. Pass a substring of the task text.",
    parameters: {
      type: "object",
      properties: {
        match: { type: "string", description: "Substring of the task text." },
      },
      required: ["match"],
    },
  },

  // ----- Music -----
  {
    name: "play_music",
    description:
      "Open the music player and start playing. Optionally hint a category (lofi, focus, chill, classical, nature) or a track name.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["lofi", "focus", "chill", "classical", "nature"],
        },
        track: { type: "string", description: "Optional track name fragment." },
      },
    },
  },
  {
    name: "pause_music",
    description: "Pause music playback.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "resume_music",
    description: "Resume music playback.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "next_track",
    description: "Skip to the next track.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "previous_track",
    description: "Go back to the previous track.",
    parameters: { type: "object", properties: {} },
  },

  // ----- Pomodoro -----
  {
    name: "start_pomodoro",
    description: "Open the Pomodoro timer and start a focus session.",
    parameters: {
      type: "object",
      properties: {
        minutes: {
          type: "number",
          description: "Length in minutes (default 25).",
        },
      },
    },
  },
  {
    name: "pause_pomodoro",
    description: "Pause the running Pomodoro timer.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "resume_pomodoro",
    description: "Resume a paused Pomodoro timer.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "reset_pomodoro",
    description: "Reset the Pomodoro timer.",
    parameters: { type: "object", properties: {} },
  },

  // ----- Wi-Fi -----
  {
    name: "wifi_scan",
    description:
      "Scan for nearby Wi-Fi networks. Only works on the Spark device hardware.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "wifi_connect",
    description: "Connect to a Wi-Fi network by SSID. Optional password.",
    parameters: {
      type: "object",
      properties: {
        ssid: { type: "string", description: "Network SSID." },
        password: { type: "string", description: "Network password if required." },
      },
      required: ["ssid"],
    },
  },

  // ----- Bluetooth -----
  {
    name: "bluetooth_scan",
    description:
      "Scan for nearby Bluetooth devices. Only works on the Spark device hardware.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "bluetooth_pair",
    description: "Pair and connect to a Bluetooth device by name fragment.",
    parameters: {
      type: "object",
      properties: {
        device: { type: "string", description: "Device name fragment, e.g. 'AirPods'." },
      },
      required: ["device"],
    },
  },

  // ----- Generic panel control -----
  {
    name: "open_panel",
    description: "Open one of the tablet's panels.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["messages", "notes", "todo", "music", "pomodoro", "wifi", "bt"],
        },
      },
      required: ["name"],
    },
  },
  {
    name: "close_panel",
    description: "Close any open panel.",
    parameters: { type: "object", properties: {} },
  },
];

export const VOICE_TOOL_USAGE_PROMPT = `
You CONTROL the student's tablet through client tools. Your default behaviour is to CALL A TOOL on the very first user turn that hints at an intent — DO NOT ask clarifying questions before acting, DO NOT ask for confirmation, DO NOT say "sure, what would you like to add". Open the relevant panel IMMEDIATELY so the user can see what's happening, then ask follow-up questions only if a REQUIRED parameter is truly missing.

Decision table (match the user's intent → call this tool FIRST, before saying anything):
- "notes", "take a note", "write this down", "save this", "create a note"           → open_panel({name:"notes"}). If they already said WHAT to note, call add_note(text) instead.
- "to-do", "todo", "task list", "add to my list", "remind me to X"                    → open_panel({name:"todo"}). If a task is given, call add_todo(text).
- "message", "text", "tell my teacher", "send to <teacher>"                           → if body is clear, call send_message(teacher, body). Else open_panel({name:"messages"}) and ask for the body.
- "music", "play <genre>", "lofi", "focus music", "pause/skip/next/previous"          → play_music / pause_music / next_track / previous_track. Pass category if implied.
- "pomodoro", "focus session", "timer for N minutes", "start studying"                → start_pomodoro({minutes}). Default 25 if not specified.
- "wifi", "connect to <ssid>"                                                         → wifi_scan or wifi_connect.
- "bluetooth", "pair my <device>"                                                     → bluetooth_scan or bluetooth_pair.
- "open notes/todo/music/pomodoro/messages/wifi/bluetooth"                            → open_panel({name:...}).
- "close this", "hide", "go back"                                                     → close_panel.

Hard rules:
1. ACT FIRST, TALK AFTER. The first action of every relevant turn is a tool call. Then say ONE short confirmation: "Done.", "Saved.", "Added.", "Sent to your math teacher.", "Playing lofi.", "Starting a 25 minute focus session.".
2. NEVER reply with "Sure, what do you want to add?" — instead open the panel and ask while it's visible. Example: user says "create a to-do list" → call open_panel({name:"todo"}) FIRST, then say "Opened your to-do list — what's the first task?".
3. Do NOT ask for confirmation before acting on a clear command ("start pomodoro" → just start it).
4. Do NOT describe the parameters you are sending out loud.
5. If a tool returns an error string, read it verbatim in a friendly tone.
6. Wi-Fi and Bluetooth only work on the physical Spark device. If you get the "device not connected" error, just relay it.
7. Reply in Hinglish (Hindi + English mix) by default, matching the user's language.
`.trim();