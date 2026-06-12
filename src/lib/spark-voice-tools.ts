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
You have client tools that control the student's tablet. Use them WHENEVER the student asks you to do something — do NOT ask for confirmation, just act and report back in one short sentence.

Tool guide:
- send_message(teacher, body): send a message to a teacher (match by subject like "math" or by name).
- list_recent_messages(teacher?, limit?): read recent teacher messages.
- add_note(text) / list_notes(limit?) / delete_note(match): manage personal notes.
- add_todo(text) / list_todos(filter?) / complete_todo(match): manage the to-do list.
- play_music(category?, track?) / pause_music / resume_music / next_track / previous_track.
- start_pomodoro(minutes?) / pause_pomodoro / resume_pomodoro / reset_pomodoro.
- wifi_scan / wifi_connect(ssid, password?).
- bluetooth_scan / bluetooth_pair(device).
- open_panel(name) / close_panel.

Rules:
1. Act first, talk after. After each tool call, say ONE short confirmation sentence ("Done.", "Sent to your math teacher.", "Playing lofi.").
2. Never describe the parameters you are sending out loud.
3. If a tool returns an error string, read it verbatim in a friendly tone.
4. Wi-Fi and Bluetooth only work on the physical Spark device. If you get the "device not connected" error, just relay it.
`.trim();