# ClassPulse — Local Attendance & Engagement Prototype

ClassPulse is a responsive, offline-first prototype based on the supplied **Multimodal Attendance & Engagement Agent** brief. It contains a dashboard and a live session workspace for a classroom demonstration.

## What works

- Start and end a timed classroom session.
- Optionally request camera permission, show a live preview, and use a locally bundled MediaPipe Pose Landmarker Lite model to estimate visible body poses and movement.
- Optionally request microphone permission and estimate sound energy with the browser Web Audio API.
- View a combined activity proxy, rolling signal samples, and optional rule-based teaching prompts.
- Manually mark sample learners present; the app adds local timestamps and can export an attendance CSV.
- Save aggregate session summaries in this browser's local storage and download a JSON summary.
- Responsive overview, session workspace, searchable sample roster, and mobile navigation.

## Important limitations

This is a working **prototype**, not a production classroom monitoring system. The bundled pose model card says the model is intended for single-person pose estimation and multiple people in an image are out of scope. The pose count is therefore experimental and must not be treated as classroom-wide attendance. It can miss people or return unstable results. The app does not recognize identities or match a detected pose to a learner; the model may internally track landmarks between frames while processing the current session. Attendance is manually checked in. Sound energy cannot tell speech from other sounds. The activity proxy does not measure attention, learning, emotion, or performance. There is no transcription, remote AI service, or cloud sync. Teaching prompts come from simple visible rules, not a generative AI agent.

The sample overview metrics and names are illustrative. Replace them with consented demo data before recording. Do not use these signals to grade, discipline, diagnose, or make decisions about learners.

## Privacy behavior

- No video or audio recording is created.
- Camera preview and signal analysis run in the current browser tab.
- Only aggregate session summaries are saved in that browser's local storage; attendance marks stay in the active page session.
- Nothing is transmitted to a server by this project.
- Camera and microphone access is optional and requested only when **Start session** is clicked after selecting the relevant option.
- Use only with appropriate permission from everyone being recorded or observed. The app does not identify people, but a camera preview is still sensitive.

## Run locally

Camera and microphone access generally require a secure browser context. From this folder run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. All application files, model files and libraries are included in this repository, so analysis runs locally without a network connection. There is no package installation, backend, or cloud service. You can also open `index.html` directly to preview the dashboard, though browser media permissions may not work from a `file://` URL.

On Windows, you can double-click `start-demo.bat` instead. It starts the local server in a console window and opens the live-session page at `http://127.0.0.1:8000/session.html`. Keep the server window open while using or recording the demo; close that window to stop the server. If port 8000 is already in use, close the earlier ClassPulse server window first.

## Screen-recording walkthrough

1. Start the local server and open the overview.
2. Open **Live session**. Explain that all displayed overview numbers are sample data.
3. If your recording setup permits it, select camera and/or microphone and click **Start session**. Approve the browser permission prompt yourself. You can record a short demo with your own camera pointed at an empty area; do not capture students without consent.
4. Mark one or two placeholder learners present, show the timestamp log and activity chart, and end the session.
5. Download the CSV or JSON summary if you want to demonstrate exports. Avoid showing private names or browser permission dialogs in a public recording.

If you do not want to grant camera or microphone access, leave both options off and demonstrate manual check-in and session timing.

## GitHub and GitHub Pages

Create an empty public repository, for example `classpulse-attendance-demo`. In a terminal opened in this folder, run:

```bash
git init
git add .
git commit -m "Build ClassPulse local session prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/classpulse-attendance-demo.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username. To host the static demo, open repository **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. GitHub Pages uses HTTPS, which supports browser camera/microphone permission prompts after the visitor explicitly starts a session.

## Project files

- `index.html`, `styles.css`, `app.js` — overview and sample roster
- `session.html`, `session.css`, `session.js` — local session controls, media signals, attendance and exports
- `vendor/mediapipe/` — bundled WebAssembly runtime, pose model, and third-party notices
- `start-demo.bat` — Windows launcher for the local server and session page
