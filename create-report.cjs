const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, AlignmentType, PageNumber, BorderStyle, WidthType, ShadingType, HeadingLevel } = require('docx');
const fs = require('fs');

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function cell(text, width, opts = {}) {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold || false, size: opts.size || 22 })] })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun(text)],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun(text)],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun(text)],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, bold: opts.bold || false, size: opts.size || 22 })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, size: 22 })],
  });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 200, after: 140 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets",
        levels: [{ level: 0, format: "bullet", text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "Spark Classroom Tablet \u2014 Technical Brief", bold: true, size: 20 })] })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Page ", size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })]
      })] })
    },
    children: [
      h1("Spark Classroom Tablet \u2014 Technical Brief"),
      p("This document provides a comprehensive overview of the technology stack, architecture, and implementation challenges faced during the development of the Spark Classroom Tablet solution. It covers the full-stack web application, the AI-powered tutoring system, and the Raspberry Pi kiosk deployment.", { size: 22 }),

      h2("1. Project Overview"),
      p("Spark is an AI-powered classroom tablet designed for students. It provides a distraction-free, touch-optimized interface for accessing homework, receiving teacher notices, and interacting with an AI tutor (Spark) via voice and text. The system is deployed as a single-purpose kiosk on a Raspberry Pi with a 7-inch touchscreen display."),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2800, 6560],
        rows: [
          new TableRow({ children: [cell("Project Name", 2800, { bold: true, shading: "E8F4FD" }), cell("Spark Classroom Tablet", 6560)] }),
          new TableRow({ children: [cell("Primary Platform", 2800, { bold: true, shading: "E8F4FD" }), cell("Raspberry Pi 4B + Raspberry Pi Touch Display 2", 6560)] }),
          new TableRow({ children: [cell("OS", 2800, { bold: true, shading: "E8F4FD" }), cell("Raspberry Pi OS Bookworm (32/64-bit)", 6560)] }),
          new TableRow({ children: [cell("Browser", 2800, { bold: true, shading: "E8F4FD" }), cell("Chromium (Kiosk Mode)", 6560)] }),
          new TableRow({ children: [cell("Web App URL", 2800, { bold: true, shading: "E8F4FD" }), cell("https://sparkmtp.lovable.app/student", 6560)] }),
        ]
      }),

      h2("2. Technology Stack"),

      h3("2.1 Frontend"),
      bullet("Framework: TanStack Start v1 (full-stack React with SSR/SSG support)"),
      bullet("Build Tool: Vite 7"),
      bullet("UI Library: React 19 with TypeScript"),
      bullet("Styling: Tailwind CSS v4 with CSS theme variables (oklch-based design tokens)"),
      bullet("Component Primitives: Radix UI (shadcn/ui pattern)"),
      bullet("Icons: Lucide React"),
      bullet("State Management: React hooks + TanStack Query"),
      bullet("Forms: React Hook Form with Zod validation"),
      bullet("PWA: vite-plugin-pwa with Workbox for offline capability"),

      h3("2.2 Backend & Database"),
      bullet("Database: PostgreSQL (via Lovable Cloud / Supabase)"),
      bullet("Auth: Supabase Auth with Row Level Security (RLS) policies"),
      bullet("Server Functions: TanStack createServerFn (typed RPC)"),
      bullet("Admin Client: Service-role key for trusted server operations"),
      bullet("Real-time: Supabase Realtime for live updates"),

      h3("2.3 AI & Voice"),
      bullet("AI Gateway: Lovable AI Gateway (Google Gemini 3 Flash Preview, OpenAI GPT models)"),
      bullet("Voice AI: ElevenLabs (Text-to-Speech, Speech-to-Text, Conversational AI agent)"),
      bullet("Default Voice: \"Sarah\" (EXAVITQu4vr4xnSDxMaL)"),
      bullet("Emotion System: AI replies prefixed with emotion tags [emotion:friendly], [emotion:happy], etc."),

      h3("2.4 Raspberry Pi Kiosk Stack"),
      bullet("Display Server: Xorg (startx from console autologin)"),
      bullet("Local API: Python 3 + Flask + flask-cors on port 8765"),
      bullet("Network: NetworkManager (nmcli) for Wi-Fi control"),
      bullet("Bluetooth: BlueZ (bluetoothctl) for device management"),
      bullet("Systemd: Custom spark-device.service"),
      bullet("Boot Flow: Console autologin -> startx -> .xinitrc -> Chromium --kiosk"),

      h2("3. System Architecture"),
      p("The Spark tablet operates in three layers:"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 7160],
        rows: [
          new TableRow({ children: [cell("Layer", 2200, { bold: true, shading: "E8F4FD" }), cell("Description", 7160, { bold: true, shading: "E8F4FD" })] }),
          new TableRow({ children: [cell("Hardware", 2200), cell("Raspberry Pi 4B + 7\" Touch Display 2. Boots into console autologin, no desktop environment.", 7160)] }),
          new TableRow({ children: [cell("Kiosk Layer", 2200), cell("Xorg + Chromium --kiosk. No cursor, no address bar, no desktop. Runs full-screen web app.", 7160)] }),
          new TableRow({ children: [cell("Device Service", 2200), cell("Flask API on :8765. Bridges browser JavaScript to system Wi-Fi/Bluetooth via NetworkManager/BlueZ.", 7160)] }),
          new TableRow({ children: [cell("Web App", 2200), cell("TanStack Start app at /student. Device-token auth. Calls server functions + local device API.", 7160)] }),
          new TableRow({ children: [cell("Cloud Backend", 2200), cell("Supabase PostgreSQL with RLS. Stores students, homework, notices, devices, interaction logs.", 7160)] }),
        ]
      }),

      h2("4. Major Problems Faced & Solutions"),

      h3("4.1 No Physical Keyboard on Touch Screen"),
      p("Problem: The Raspberry Pi kiosk has no physical keyboard. When students tapped on a chat input field, there was no way to type.", { bold: true }),
      p("Solution: Built a custom virtual keyboard component (VirtualKeyboard) using react-simple-keyboard. It auto-detects focus on any input or textarea element and slides up from the bottom. The keyboard supports all standard characters, backspace, enter, and space."),
      bullet("File: src/components/student/virtual-keyboard.tsx"),
      bullet("Library: react-simple-keyboard"),

      h3("4.2 Keyboard Covers Chat Input"),
      p("Problem: When the virtual keyboard opened, it covered the chat input field and the lower part of the conversation, making it impossible to see what was being typed.", { bold: true }),
      p("Solution: Implemented a ResizeObserver to measure the keyboard height in real time. The height is written to a CSS variable (--osk-height) on the document root. All overlay panels and the main chat container use this variable to shift content upward dynamically. A smooth transition animation ensures the UI never jumps abruptly."),
      bullet("CSS Variable: --osk-height updates dynamically"),
      bullet("Effect: Chat input and messages remain visible above the keyboard"),

      h3("4.3 Screen Only Showing on Half the Display"),
      p("Problem: On the 7-inch Touch Display 2 mounted in portrait orientation, Chromium rendered only on the left half of the screen. The display panel is natively landscape, so without explicit rotation, the framebuffer remained landscape while the physical panel was upright.", { bold: true }),
      p("Solution: Added a configurable display rotation system via the setup.sh installer. It writes a display rotation block to /boot/firmware/config.txt using display_lcd_rotate and display_hdmi_rotate. By default, it sets rotation=1 (portrait, 90 degrees clockwise). This ensures the kernel rotates the framebuffer before Xorg starts, so Chromium captures the correct dimensions."),
      bullet("Config: /boot/firmware/config.txt (# >>> spark-display >>> block)"),
      bullet("Env Var: SPARK_DISPLAY_ROTATE (0=landscape, 1=portrait CW, 2=180, 3=portrait CCW)"),

      h3("4.4 Mouse Cursor Visible on Touch Kiosk"),
      p("Problem: A mouse cursor was visible on the touch-only kiosk, which was unnecessary and distracting for students.", { bold: true }),
      p("Solution: Created ~/.xserverrc to launch the X server with the -nocursor flag. This prevents the cursor from ever being drawn. As a fallback, unclutter -idle 0 is also launched to hide any cursor that might appear."),
      bullet("Method: ~/.xserverrc with X -nocursor"),
      bullet("Fallback: unclutter -idle 0"),

      h3("4.5 Touch Axes Reversed (Horizontal vs Vertical)"),
      p("Problem: When swiping vertically with a finger, the screen scrolled horizontally. Touch coordinates did not match the visible screen orientation.", { bold: true }),
      p("Solution: Implemented a Coordinate Transformation Matrix applied via xinput in .xinitrc. The installer detects the touchscreen device and applies the correct 3x3 matrix based on SPARK_DISPLAY_ROTATE. For the official Raspberry Pi Touch Display 2, the kernel auto-rotates touch together with the display, so we default to the identity matrix. For third-party displays, SPARK_TOUCH_MATRIX=match applies the matching rotation matrix."),
      bullet("Tool: xinput set-prop <device> \"Coordinate Transformation Matrix\""),
      bullet("Auto-detection: Matches device names containing Touch, Touchscreen, FT5, Goodix, Raspberry Pi"),

      h3("4.6 Touch Registering Wrong Buttons"),
      p("Problem: Even after axis fixes, tapping on one button triggered a different button. Tapping on blank areas also registered as button presses. The root cause was applying both firmware rotation AND xrandr rotation, which double-rotated the display while only rotating touch once.", { bold: true }),
      p("Solution: Redesigned the rotation logic so firmware rotation is the single source of truth. Added SPARK_XRANDR_ROTATE env variable: auto (default, no extra X rotation) and match (apply xrandr for third-party HDMI panels that ignore firmware rotation). This ensures touch and video stay perfectly aligned."),
      bullet("Default: SPARK_XRANDR_ROTATE=auto (no xrandr, kernel handles everything)"),
      bullet("Third-party: SPARK_XRANDR_ROTATE=match (applies xrandr rotation)"),

      h3("4.7 Wi-Fi and Bluetooth Panels Not Working"),
      p("Problem: The Wi-Fi and Bluetooth control panels in the web app showed \"device service unavailable\" even though the Flask service was running. The browser console showed CORS errors.", { bold: true }),
      p("Solution: Updated ALLOWED_ORIGINS in spark-device-service.py to include the correct published URLs (https://sparkmtp.lovable.app, https://spark.brightstudio.io) and preview URLs. Also made it overridable via the SPARK_ALLOWED_ORIGINS environment variable, so future URL changes require no code edits."),
      bullet("Fix: Updated DEFAULT_ALLOWED_ORIGINS list in Python service"),
      bullet("Override: SPARK_ALLOWED_ORIGINS env var for custom domains"),

      h3("4.8 Voice Mode Disconnecting Immediately"),
      p("Problem: When pressing the Start button in voice mode, it would disconnect automatically without saying anything.", { bold: true }),
      p("Solution: Integrated ElevenLabs Conversational AI agent properly. The startVoiceConversation server function fetches a conversation token from ElevenLabs, builds a dynamic system prompt based on the student's AI config and current homework, and injects it as an override. If ELEVENLABS_AGENT_ID is not configured, the UI shows a graceful warning instead of crashing."),
      bullet("Integration: ElevenLabs Conversational AI SDK"),
      bullet("Dynamic Prompts: Homework context injected per session"),

      h3("4.9 UI Elements Too Small for Touch"),
      p("Problem: Icons, buttons, and text were too small for comfortable touch interaction on a 7-inch display.", { bold: true }),
      p("Solution: Enlarged all interactive elements across the student page. Tool icons increased from 28px to 48-80px. Tool tiles use larger padding (p-4 to p-5), rounded-2xl corners, and text-lg labels. The homework section cards were enlarged with p-5 padding. The overall grid switched from 3 columns to 2 columns on small screens for bigger tap targets."),
      bullet("Tool Icons: h-7 w-7 -> h-12 w-12 -> h-20 w-20"),
      bullet("Grid: grid-cols-3 -> grid-cols-2 (sm:grid-cols-3)"),

      h3("4.10 Clock Removed from Navigation Bar"),
      p("Problem: During UI refactoring, the Clock component was accidentally removed from the header navigation bar.", { bold: true }),
      p("Solution: Re-inserted the <Clock /> component into the header's right-side control area, next to the notices bell button."),

      h2("5. Key Features Implemented"),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2400, 6960],
        rows: [
          new TableRow({ children: [cell("Feature", 2400, { bold: true, shading: "E8F4FD" }), cell("Description", 6960, { bold: true, shading: "E8F4FD" })] }),
          new TableRow({ children: [cell("Voice Tutor", 2400), cell("Live voice conversation with Spark AI using ElevenLabs. Emotion-aware avatar animations.", 6960)] }),
          new TableRow({ children: [cell("Chat Tutor", 2400), cell("Text-based AI tutoring with the same smart prompts. Works offline with local context.", 6960)] }),
          new TableRow({ children: [cell("Homework", 2400), cell("View assigned homework, tap to start AI-guided work session, mark as done.", 6960)] }),
          new TableRow({ children: [cell("Notices", 2400), cell("Teacher announcements with dismissible cards. Unread badge on bell icon.", 6960)] }),
          new TableRow({ children: [cell("Daily Goal", 2400), cell("Auto-generated daily learning goal. Mark done to maintain streak.", 6960)] }),
          new TableRow({ children: [cell("Streak", 2400), cell("Gamified streak counter (flame icon) showing consecutive active days.", 6960)] }),
          new TableRow({ children: [cell("Music", 2400), cell("Built-in music player with curated focus/study tracks.", 6960)] }),
          new TableRow({ children: [cell("Pomodoro", 2400), cell("Focus timer with configurable work/break intervals.", 6960)] }),
          new TableRow({ children: [cell("Wi-Fi", 2400), cell("Scan and connect to Wi-Fi networks directly from the tablet UI.", 6960)] }),
          new TableRow({ children: [cell("Bluetooth", 2400), cell("Scan and pair Bluetooth devices from the tablet UI.", 6960)] }),
          new TableRow({ children: [cell("Notes", 2400), cell("Quick note-taking panel with localStorage persistence.", 6960)] }),
          new TableRow({ children: [cell("To-Do", 2400), cell("Simple task list with add/toggle/remove. Persisted in localStorage.", 6960)] }),
          new TableRow({ children: [cell("Clock", 2400), cell("Live digital clock in the top navigation bar.", 6960)] }),
          new TableRow({ children: [cell("Quiz", 2400), cell("Oral quiz mode. AI asks 5 questions; scores and stores results.", 6960)] }),
        ]
      }),

      h2("6. Deployment & Boot Flow"),
      p("The Raspberry Pi kiosk boots with zero manual intervention:"),
      bullet("Power On -> Console autologin on tty1"),
      bullet("~/.bash_profile detects tty1 and runs startx"),
      bullet("~/.xinitrc sets up display rotation, touch matrix, and launches Chromium"),
      bullet("Chromium opens in --kiosk --app mode pointing to /student route"),
      bullet("spark-device.service starts the Flask helper API on port 8765"),
      bullet("SSH remains active for remote recovery and updates"),

      h2("7. Security Considerations"),
      bullet("Device Authentication: Long-lived device tokens stored in localStorage. Pairing via short alphanumeric codes."),
      bullet("RLS Policies: Every database table has Row Level Security. Students only see their own homework and notices."),
      bullet("Service Role: Admin client (supabaseAdmin) used only in server functions, never exposed to browser."),
      bullet("CORS: Flask device service restricts origins to known Spark URLs."),
      bullet("Recovery Mode: SPARK_DISABLE_KIOSK env var or Ctrl+Alt+F2 for shell access."),

      h2("8. Conclusion"),
      p("The Spark Classroom Tablet demonstrates a complete full-stack to hardware deployment pipeline. By combining a modern React web app with a purpose-built Raspberry Pi kiosk layer, we created a dedicated learning device that is both powerful and simple to use. The iterative problem-solving process\u2014from touch calibration to CORS fixes to UI resizing\u2014resulted in a robust, student-friendly tablet experience that boots straight into learning."),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/mnt/documents/Spark_Technical_Brief.docx", buffer);
  console.log("Document created successfully at /mnt/documents/Spark_Technical_Brief.docx");
});
