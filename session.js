const learners = Array.from({length: 8}, (_, i) => ({id: i + 1, name: `Learner ${String(i + 1).padStart(2, '0')}`, present: false, markedAt: null}));
const $ = (selector) => document.querySelector(selector);
const list = $('#learnerList');
const log = $('#attendanceLog');
const video = $('#video');
const canvas = $('#analysisCanvas');
const context = canvas.getContext('2d', {willReadFrequently: true});
let running = false, starting = false, startedAt = 0, timerInterval = null, sampleInterval = null, poseInterval = null, soundInterval = null;
let videoStream = null, audioStream = null, audioContext = null, analyser = null, audioData = null, poseLandmarker = null;
let previousFrame = null, previousPoseSignature = null, poseLastTimestamp = -1, lastPoseVideoTime = -1, poseCount = 0, latestMotion = null, latestSound = null, samples = [], lowMotionSeconds = 0;
let toastTimer = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function showToast(message) {
  const toast = $('#toast'); toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
function renderLearners() {
  list.innerHTML = learners.map(person => `<li class="learner-row"><span class="student-avatar" style="background:#eeeaff;color:#7568d9">${String(person.id).padStart(2,'0')}</span><span class="learner-name">${escapeHtml(person.name)}</span><button class="check-button ${person.present ? 'present' : ''}" data-id="${person.id}">${person.present ? '✓ Present' : 'Mark present'}</button></li>`).join('');
  $('#attendanceCount').textContent = `${learners.filter(x => x.present).length} / ${learners.length}`;
  list.querySelectorAll('.check-button').forEach(button => button.addEventListener('click', () => markPresent(Number(button.dataset.id))));
}
function renderLog() {
  const marked = learners.filter(x => x.present);
  log.innerHTML = marked.length ? marked.map(x => `<div class="log-row"><span>${escapeHtml(x.name)} <b>· Present</b></span><time>${new Date(x.markedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}</time></div>`).join('') : '<p class="empty-log">No attendance marks yet.</p>';
}
function markPresent(id) {
  const person = learners.find(x => x.id === id); if (!person) return;
  person.present = !person.present; person.markedAt = person.present ? new Date().toISOString() : null;
  renderLearners(); renderLog();
}
function formatTime(seconds) {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0'); return `${mm}:${ss}`;
}
function setMeter(id, value, labelId, label) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  $(`#${id}`).style.width = `${safe}%`; $(`#${labelId}`).textContent = label;
}
function drawMotionSample() {
  if (!videoStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return null;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) gray[p] = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) | 0;
  if (!previousFrame) { previousFrame = gray; return null; }
  let diff = 0;
  for (let i = 0; i < gray.length; i++) diff += Math.abs(gray[i] - previousFrame[i]);
  previousFrame = gray;
  return Math.max(0, Math.min(100, diff / gray.length * 2.8));
}
async function createPoseLandmarker() {
  try {
    const vision = await import('./vendor/mediapipe/vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks('./vendor/mediapipe/wasm');
    poseLandmarker = await vision.PoseLandmarker.createFromOptions(files, {
      baseOptions: {modelAssetPath:'./vendor/mediapipe/pose_landmarker_lite.task'},
      runningMode:'VIDEO', numPoses:8, minPoseDetectionConfidence:.5,
      minPosePresenceConfidence:.5, minTrackingConfidence:.5
    });
    $('#movementLabel').textContent = 'Body-pose movement';
    return true;
  } catch (error) {
    poseLandmarker = null;
    $('#movementLabel').textContent = 'Whole-frame movement';
    $('#poseCount').textContent = 'N/A'; setMeter('presenceMeter',0,'presenceCaption','Pose model unavailable');
    $('#inactivityTime').textContent = 'N/A';
    showToast(`Pose model unavailable; using a rough frame-change signal (${error.message}).`);
    return false;
  }
}
function collectPoseSample() {
  if (!videoStream || !poseLandmarker || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.currentTime === lastPoseVideoTime) return;
  const timestamp = Math.max(Math.round(performance.now()), poseLastTimestamp + 1);
  try {
    const result = poseLandmarker.detectForVideo(video, timestamp); poseLastTimestamp = timestamp; lastPoseVideoTime = video.currentTime;
    const poses = result.landmarks || []; poseCount = poses.length;
    const keypoints = [0, 11, 12, 23, 24];
    const signature = keypoints.map(index => {
      const visible = poses.map(pose => pose[index]).filter(point => point && (point.visibility ?? 1) > .45);
      return visible.length ? [visible.reduce((sum,p)=>sum+p.x,0)/visible.length, visible.reduce((sum,p)=>sum+p.y,0)/visible.length] : null;
    });
    if (previousPoseSignature && signature.some((point,i)=>point && previousPoseSignature[i])) {
      const changes = signature.map((point,i)=>point && previousPoseSignature[i] ? Math.hypot(point[0]-previousPoseSignature[i][0],point[1]-previousPoseSignature[i][1]) : null).filter(Number.isFinite);
      latestMotion = changes.length ? Math.max(0,Math.min(100,changes.reduce((a,b)=>a+b,0)/changes.length*300)) : null;
    } else latestMotion = null;
    previousPoseSignature = signature;
    $('#poseCount').textContent = String(poseCount);
    setMeter('presenceMeter', Math.min(100, poseCount / 8 * 100), 'presenceCaption', poseCount ? `${poseCount} anonymous pose${poseCount===1?'':'s'} visible` : 'No body poses detected in frame');
    if (latestMotion === null) {
      $('#motionValue').textContent = '…'; setMeter('motionMeter',0,'motionCaption','Collecting pose samples');
    } else {
      $('#motionValue').textContent = `${Math.round(latestMotion)}%`;
      setMeter('motionMeter',latestMotion,'motionCaption',latestMotion>12?'Visible pose movement':'Low pose movement');
    }
    const mins = Math.floor(lowMotionSeconds/60).toString().padStart(2,'0'), secs = (lowMotionSeconds%60).toString().padStart(2,'0');
    $('#inactivityTime').textContent = `${mins}:${secs}`;
  } catch (error) { $('#presenceCaption').textContent = `Pose analysis paused: ${error.message}`; }
}
function readSoundSample() {
  if (!analyser || !audioData) return null;
  analyser.getByteTimeDomainData(audioData);
  let sum = 0;
  for (const value of audioData) { const centered = (value - 128) / 128; sum += centered * centered; }
  const rms = Math.sqrt(sum / audioData.length);
  return Math.max(0, Math.min(100, rms * 520));
}
function calculateActivity() {
  const signals = [];
  if (videoStream && latestMotion !== null) signals.push(latestMotion);
  if (audioStream && latestSound !== null) signals.push(latestSound);
  if (!signals.length) return null;
  return Math.round(signals.reduce((a,b) => a + b, 0) / signals.length);
}
function updateSignalReadings() {
  const hasVideo = Boolean(videoStream), hasAudio = Boolean(audioStream);
  if (hasVideo && !poseLandmarker) latestMotion = drawMotionSample();
  if (hasAudio) latestSound = readSoundSample();
  if (!poseLandmarker && (latestMotion === null || !hasVideo)) {
    $('#motionValue').textContent = hasVideo ? '…' : '—';
    setMeter('motionMeter', 0, 'motionCaption', hasVideo ? 'Warming up camera signal' : 'Camera off');
  } else if (!poseLandmarker) {
    $('#motionValue').textContent = `${Math.round(latestMotion)}%`;
    setMeter('motionMeter', latestMotion, 'motionCaption', latestMotion > 18 ? 'Visible frame changes' : 'Low frame change');
  }
  if (latestSound === null || !hasAudio) {
    $('#soundValue').textContent = '—'; setMeter('soundMeter', 0, 'soundCaption', hasAudio ? 'Warming up microphone signal' : 'Microphone off');
  } else {
    $('#soundValue').textContent = `${Math.round(latestSound)}%`;
    setMeter('soundMeter', latestSound, 'soundCaption', latestSound > 12 ? 'Sound energy detected' : 'Low sound energy');
  }
  const activity = calculateActivity();
  $('#activityValue').textContent = activity === null ? '—' : `${activity}%`;
  return activity;
}
function renderTrend() {
  const chart = $('#trendChart');
  chart.querySelectorAll('.trend-bar').forEach(bar => bar.remove());
  const visible = samples.slice(-24);
  $('#sampleCount').textContent = `${samples.length} sample${samples.length === 1 ? '' : 's'}`;
  $('#trendEmpty').hidden = visible.length > 0;
  visible.forEach((sample, i) => {
    const bar = document.createElement('i'); bar.className = 'trend-bar';
    bar.style.height = `${Math.max(5, sample.activity)}%`; bar.dataset.label = i % 4 === 0 ? formatTime(sample.elapsed) : '';
    bar.title = `${formatTime(sample.elapsed)} · activity proxy ${sample.activity}%`; chart.appendChild(bar);
  });
}
function updateSuggestions(final = false) {
  const activities = samples.map(x => x.activity);
  const average = activities.length ? Math.round(activities.reduce((a,b)=>a+b,0) / activities.length) : null;
  const lowRecent = activities.length >= 3 && activities.slice(-3).every(x => x < 12);
  const suggestions = [];
  if (lowRecent) suggestions.push(['↗', 'The recent movement/sound proxy is low. Consider a quick check-in, stretch break, or short poll. Treat this as a prompt to observe the room, not a judgment.']);
  if (average !== null && average > 62) suggestions.push(['✦', 'The activity proxy has been high. If it fits the lesson, pause for a recap or give the class a quiet moment to reset.']);
  if (!suggestions.length) suggestions.push(['✦', final ? 'No rule-based prompt was triggered. Use your own observation and teaching judgment.' : 'Signals are still being collected. Suggestions are optional prompts, not conclusions about learner attention.']);
  $('#suggestionList').innerHTML = suggestions.map(([icon,text]) => `<div class="suggestion"><span>${icon}</span><p>${escapeHtml(text)}</p></div>`).join('');
}
function clockTick() {
  const elapsed = Math.floor((Date.now() - startedAt) / 1000);
  $('#timer').textContent = formatTime(elapsed);
  if (elapsed >= Number($('#duration').value) * 60) endSession(true);
}
function takeSample() {
  if (!running) return;
  const activity = updateSignalReadings();
  if (activity !== null) {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    samples.push({elapsed, activity, motion: latestMotion, sound: latestSound});
    if (poseLandmarker && poseCount > 0 && latestMotion !== null && latestMotion < 12) lowMotionSeconds += 5;
    else if (!poseCount || (latestMotion !== null && latestMotion >= 12)) lowMotionSeconds = 0;
    const mins = Math.floor(lowMotionSeconds/60).toString().padStart(2,'0'), secs = (lowMotionSeconds%60).toString().padStart(2,'0');
    $('#inactivityTime').textContent = poseLandmarker ? `${mins}:${secs}` : 'N/A';
    renderTrend(); updateSuggestions();
  }
}
async function startSession() {
  if (running || starting) return;
  starting = true; $('#startButton').disabled = true;
  const wantsCamera = $('#cameraToggle').checked, wantsMic = $('#micToggle').checked;
  if (wantsCamera || wantsMic) {
    try {
      if (wantsCamera) {
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:360}},audio:false});
          video.srcObject = videoStream; video.hidden = false; $('#videoPlaceholder').hidden = true; $('#previewLabel').hidden = false;
          await video.play();
          $('#poseCount').textContent = '…'; $('#presenceCaption').textContent = 'Loading local pose model';
          await createPoseLandmarker();
        } catch (err) { if (videoStream) videoStream.getTracks().forEach(track=>track.stop()); videoStream = null; video.srcObject = null; video.hidden = true; $('#videoPlaceholder').hidden = false; $('#previewLabel').hidden = true; poseLandmarker = null; showToast(`Camera unavailable (${err.name || 'permission denied'}). Continuing with other enabled signals.`); }
      }
      if (wantsMic) {
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({video:false,audio:true});
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) throw new Error('Audio analysis is not supported by this browser');
          audioContext = new AudioContextClass(); await audioContext.resume();
          analyser = audioContext.createAnalyser(); analyser.fftSize = 1024;
          audioContext.createMediaStreamSource(audioStream).connect(analyser); audioData = new Uint8Array(analyser.fftSize);
        } catch (err) { if (audioStream) audioStream.getTracks().forEach(track=>track.stop()); audioStream = null; analyser = null; audioData = null; showToast(`Microphone unavailable (${err.name || 'permission denied'}). Continuing with other enabled signals.`); }
      }
    } catch (err) { showToast(`Media setup issue: ${err.message}`); }
  }
  starting = false; running = true; startedAt = Date.now(); samples = []; previousFrame = null; previousPoseSignature = null; latestMotion = null; latestSound = null;
  $('#startButton').disabled = true; $('#stopButton').disabled = false; $('#cameraToggle').disabled = true; $('#micToggle').disabled = true; $('#duration').disabled = true; $('#sessionName').readOnly = true;
  $('#sessionStatus').classList.add('running'); $('#sessionStatus').innerHTML = '<i></i> In progress'; $('#liveBadge').textContent = '● Live'; $('#liveBadge').classList.add('on');
  if (!videoStream && !audioStream) showToast('Session running with manual attendance only. Enable a sensor before starting to collect activity signals.');
  timerInterval = setInterval(clockTick, 500); sampleInterval = setInterval(takeSample, 5000);
  if (poseLandmarker) poseInterval = setInterval(collectPoseSample, 900);
  if (analyser) soundInterval = setInterval(() => { latestSound = readSoundSample(); updateSignalReadings(); }, 250);
  clockTick();
}
function releaseMedia() {
  clearInterval(sampleInterval); clearInterval(poseInterval); clearInterval(soundInterval);
  for (const stream of [videoStream, audioStream]) if (stream) stream.getTracks().forEach(track => track.stop());
  if (video) { video.pause(); video.srcObject = null; video.hidden = true; }
  $('#videoPlaceholder').hidden = false; $('#previewLabel').hidden = true;
  if (audioContext) audioContext.close().catch(()=>{});
  if (poseLandmarker) { try { poseLandmarker.close(); } catch {} }
  videoStream = null; audioStream = null; audioContext = null; analyser = null; audioData = null; poseLandmarker = null; previousFrame = null; previousPoseSignature = null; poseLastTimestamp = -1; lastPoseVideoTime = -1; poseCount = 0;
}
function getSavedSessions() {
  try { return JSON.parse(localStorage.getItem('classpulse.sessions') || '[]'); } catch { return []; }
}
function endSession(autoEnded = false) {
  if (!running) return;
  running = false; clearInterval(timerInterval); clearInterval(sampleInterval); clearInterval(poseInterval); clearInterval(soundInterval);
  const elapsed = Math.floor((Date.now() - startedAt) / 1000), present = learners.filter(x => x.present);
  const mean = key => { const values = samples.map(x => x[key]).filter(x => Number.isFinite(x)); return values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length) : null; };
  const result = {name:$('#sessionName').value.trim() || 'Classroom session',endedAt:new Date().toISOString(),durationSeconds:elapsed,attendance:present.length,rosterSize:learners.length,activity:mean('activity'),movement:mean('motion'),sound:mean('sound'),sampleCount:samples.length};
  const saved = getSavedSessions(); saved.unshift(result); try { localStorage.setItem('classpulse.sessions', JSON.stringify(saved.slice(0,20))); } catch { showToast('Browser storage is unavailable; you can still download the session summary.'); }
  releaseMedia(); $('#timer').textContent = formatTime(elapsed); $('#startButton').disabled = false; $('#stopButton').disabled = true;
  $('#cameraToggle').disabled = false; $('#micToggle').disabled = false; $('#duration').disabled = false; $('#sessionName').readOnly = false;
  $('#sessionStatus').classList.remove('running'); $('#sessionStatus').innerHTML = '<i></i> Complete'; $('#liveBadge').textContent = '● Ended'; $('#liveBadge').classList.remove('on');
  $('#summaryText').textContent = `${result.name} · ${new Date(result.endedAt).toLocaleString()}`;
  $('#summaryDuration').textContent = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m`;
  $('#summaryAttendance').textContent = `${present.length}/${learners.length}`; $('#summaryActivity').textContent = result.activity === null ? 'N/A' : `${result.activity}%`;
  $('#exportSummary').disabled = false; updateSuggestions(true);
  $('#exportSummary').onclick = () => download('classpulse-session-summary.json', JSON.stringify({...result,attendanceLog:present.map(p=>({learner:p.name,markedAt:p.markedAt}))},null,2), 'application/json');
  if (autoEnded) showToast('The session reached its selected duration and has ended.');
  else showToast('Session ended. A summary was saved on this device only.');
}
function download(filename, content, type) {
  const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportCsv() {
  const rows = [['Learner','Attendance','Marked at'], ...learners.map(x=>[x.name,x.present?'Present':'Not marked',x.markedAt || ''])];
  const csv = rows.map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
  download('classpulse-attendance.csv', csv, 'text/csv;charset=utf-8');
}
function clearLog() { if (running) { showToast('End the session before clearing attendance marks.'); return; } learners.forEach(x=>{x.present=false;x.markedAt=null}); renderLearners(); renderLog(); }
$('#startButton').addEventListener('click', startSession);
$('#stopButton').addEventListener('click', () => endSession(false));
$('#markAll').addEventListener('click', () => { learners.filter(x=>!x.present).forEach(x=>{x.present=true;x.markedAt=new Date().toISOString()}); renderLearners(); renderLog(); });
$('#exportCsv').addEventListener('click', exportCsv); $('#clearLog').addEventListener('click', clearLog);
$('#menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
renderLearners(); renderLog(); updateSuggestions();
const previous = getSavedSessions()[0];
if (previous) {
  $('#summaryText').textContent = `Last saved on this device · ${new Date(previous.endedAt).toLocaleString()}`;
  $('#summaryDuration').textContent = previous.durationSeconds < 60 ? `${previous.durationSeconds}s` : `${Math.floor(previous.durationSeconds/60)}m`;
  $('#summaryAttendance').textContent = `${previous.attendance}/${previous.rosterSize}`;
  $('#summaryActivity').textContent = previous.activity === null ? 'N/A' : `${previous.activity}%`;
  $('#exportSummary').disabled = false;
  $('#exportSummary').addEventListener('click', () => download('classpulse-session-summary.json', JSON.stringify(previous,null,2), 'application/json'));
}
