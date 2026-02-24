const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const playerControls = document.getElementById('playerControls');
const metronomeControls = document.getElementById('metronomeControls');
const playlistEmpty = document.getElementById('playlistEmpty');

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    tabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    panels.forEach((p) => {
      p.classList.remove('active');
      p.hidden = true;
    });

    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    const panel = document.getElementById(tab.dataset.tab);
    panel.classList.add('active');
    panel.hidden = false;
    
    // Toggle control sections
    if (tab.dataset.tab === 'player') {
      playerControls.style.display = 'block';
      metronomeControls.style.display = 'none';
    } else {
      playerControls.style.display = 'none';
      metronomeControls.style.display = 'flex';
    }
  });
});

const fileInput = document.getElementById('fileInput');
const playlistEl = document.getElementById('playlist');
const playPauseBtn = document.getElementById('playPauseBtn');
const stopBtn = document.getElementById('stopBtn');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const recordedBpmInput = document.getElementById('recordedBpm');
const targetBpmInput = document.getElementById('targetBpm');
const waveformCanvas = document.getElementById('waveformCanvas');
const playhead = document.getElementById('playhead');
const waveformProgress = document.getElementById('waveformProgress');
const progressPercent = document.getElementById('progressPercent');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const playerStatus = document.getElementById('playerStatus');

// Metronome elements (defined here to avoid initialization errors)
const bpmSlider = document.getElementById('bpmSlider');
const bpmInput = document.getElementById('bpmInput');
const accentSelect = document.getElementById('accentSelect');
const metroToggleBtn = document.getElementById('metroToggleBtn');
const metroStatus = document.getElementById('metroStatus');
const beatCounterEl = document.getElementById('beatCounter');

const audio = new Audio();
audio.preload = 'metadata';
audio.volume = 1.0;

let lastVolume = 1.0;
let waveformCtx = null;
let waveformAnimationId = null;
let currentWaveformGeneration = null;
let isDraggingPlayhead = false;

const DEBUG = true;
function log(...args) {
  if (DEBUG) {
    console.log('[MusicTools]', ...args);
  }
}

// Debug panel functionality
const debugPanel = document.getElementById('debugPanel');
const debugLog = document.getElementById('debugLog');
const clearDebugBtn = document.getElementById('clearDebugBtn');
const toggleDebugBtn = document.getElementById('toggleDebugBtn');

function debugMsg(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: '#0f0',
    warn: '#ff0',
    error: '#f00',
    success: '#0ff'
  };
  const color = colors[type] || colors.info;
  
  const entry = `[${timestamp}] ${message}\n`;
  debugLog.innerHTML += `<span style="color:${color}">${entry}</span>`;
  debugLog.scrollTop = debugLog.scrollHeight;
  
  console.log(`[DEBUG-${type.toUpperCase()}] ${message}`);
}

// Show debug panel on page load
debugPanel.style.display = 'block';
debugMsg('Debug panel initialized', 'success');
debugMsg(`User Agent: ${navigator.userAgent}`, 'info');

clearDebugBtn.addEventListener('click', () => {
  debugLog.innerHTML = '';
  debugMsg('Log cleared', 'info');
});

toggleDebugBtn.addEventListener('click', () => {
  if (debugPanel.style.display === 'none') {
    debugPanel.style.display = 'block';
    toggleDebugBtn.textContent = 'Hide';
  } else {
    debugPanel.style.display = 'none';
    toggleDebugBtn.textContent = 'Show';
  }
});

// Comprehensive audio event logging
audio.addEventListener('loadstart', () => {
  debugMsg('[AUDIO] loadstart - browser started to load', 'info');
});

audio.addEventListener('durationchange', () => {
  debugMsg(`[AUDIO] durationchange - duration: ${audio.duration}`, 'info');
});

audio.addEventListener('loadedmetadata', () => {
  debugMsg(`[AUDIO] loadedmetadata - duration: ${audio.duration}, ready: ${audio.readyState}`, 'success');
});

audio.addEventListener('loadeddata', () => {
  debugMsg(`[AUDIO] loadeddata - ready state: ${audio.readyState}`, 'info');
});

audio.addEventListener('canplay', () => {
  debugMsg('[AUDIO] canplay - enough data to play', 'success');
});

audio.addEventListener('canplaythrough', () => {
  debugMsg('[AUDIO] canplaythrough - can play without buffering', 'success');
});

audio.addEventListener('playing', () => {
  debugMsg('[AUDIO] playing - playback has begun', 'success');
});

audio.addEventListener('waiting', () => {
  debugMsg('[AUDIO] waiting - buffering...', 'warn');
});

audio.addEventListener('seeking', () => {
  debugMsg(`[AUDIO] seeking - to ${audio.currentTime}`, 'info');
});

audio.addEventListener('seeked', () => {
  debugMsg(`[AUDIO] seeked - completed at ${audio.currentTime}`, 'info');
});

audio.addEventListener('ended', () => {
  debugMsg('[AUDIO] ended - playback finished', 'info');
  if (currentTrackIndex < playlist.length - 1) {
    currentTrackIndex += 1;
    loadTrack(currentTrackIndex, true);
  } else {
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcon = playPauseBtn.querySelector('.pause-icon');
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playPauseBtn.setAttribute('aria-label', 'Play');
    playerStatus.textContent = 'Playlist finished.';
  }
});

audio.addEventListener('error', (e) => {
  const error = audio.error;
  let errorMsg = 'Unknown error';
  
  if (error) {
    switch (error.code) {
      case error.MEDIA_ERR_ABORTED:
        errorMsg = 'MEDIA_ERR_ABORTED - playback aborted';
        break;
      case error.MEDIA_ERR_NETWORK:
        errorMsg = 'MEDIA_ERR_NETWORK - network error';
        break;
      case error.MEDIA_ERR_DECODE:
        errorMsg = 'MEDIA_ERR_DECODE - decode error';
        break;
      case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMsg = 'MEDIA_ERR_SRC_NOT_SUPPORTED - format not supported';
        break;
      default:
        errorMsg = `Error code: ${error.code}`;
    }
    
    if (error.message) {
      errorMsg += ` - ${error.message}`;
    }
  }
  
  debugMsg(`[AUDIO] ERROR: ${errorMsg}`, 'error');
  debugMsg(`  src: ${audio.src}`, 'error');
  debugMsg(`  networkState: ${audio.networkState}`, 'error');
  debugMsg(`  readyState: ${audio.readyState}`, 'error');
  
  playerStatus.textContent = `Error: ${errorMsg}`;
});

audio.addEventListener('stalled', () => {
  debugMsg('[AUDIO] stalled - download stalled', 'warn');
});

audio.addEventListener('suspend', () => {
  debugMsg('[AUDIO] suspend - download suspended', 'info');
});

audio.addEventListener('abort', () => {
  debugMsg('[AUDIO] abort - download aborted', 'warn');
});

audio.addEventListener('emptied', () => {
  debugMsg('[AUDIO] emptied - media element reset', 'info');
});

audio.addEventListener('ratechange', () => {
  debugMsg(`[AUDIO] ratechange - playback rate: ${audio.playbackRate}`, 'info');
});

let playlist = [];
let currentTrackIndex = -1;

function cleanupObjectURL(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

function renderPlaylist() {
  playlistEl.innerHTML = '';
  
  if (playlist.length === 0) {
    playlistEmpty.style.display = 'flex';
  } else {
    playlistEmpty.style.display = 'none';
  }
  
  playlist.forEach((track, index) => {
    const li = document.createElement('li');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = track.file.name;
    nameSpan.style.flex = '1';
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-track-btn';
    removeBtn.title = 'Remove track';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeTrack(index);
    };
    
    li.appendChild(nameSpan);
    li.appendChild(removeBtn);
    li.className = index === currentTrackIndex ? 'active' : '';
    li.addEventListener('click', () => {
      currentTrackIndex = index;
      loadTrack(index, false);
    });
    playlistEl.appendChild(li);
  });
}

function removeTrack(index) {
  const track = playlist[index];
  
  if (index === currentTrackIndex) {
    audio.pause();
    audio.src = '';
    cleanupObjectURL(track.url);
    
    playlist.splice(index, 1);
    
    if (playlist.length === 0) {
      currentTrackIndex = -1;
      playPauseBtn.disabled = true;
      stopBtn.disabled = true;
      playerStatus.textContent = 'Playlist empty.';
    } else {
      currentTrackIndex = Math.min(index, playlist.length - 1);
      loadTrack(currentTrackIndex, false);
    }
  } else {
    cleanupObjectURL(track.url);
    playlist.splice(index, 1);
    
    if (index < currentTrackIndex) {
      currentTrackIndex -= 1;
    }
    
    playerStatus.textContent = `Removed. ${playlist.length} track(s) remaining.`;
  }
  
  renderPlaylist();
}

function loadTrack(index, autoplay) {
  debugMsg(`--- LOAD TRACK (index=${index}, autoplay=${autoplay}) ---`, 'info');
  const track = playlist[index];
  if (!track) {
    debugMsg('Track not found in playlist', 'error');
    return;
  }
  
  debugMsg(`Track: ${track.file.name}`, 'info');
  debugMsg(`Object URL: ${track.url}`, 'info');
  
  const playIcon = playPauseBtn.querySelector('.play-icon');
  const pauseIcon = playPauseBtn.querySelector('.pause-icon');
  
  debugMsg(`Setting audio.src to: ${track.url}`, 'info');
  audio.src = track.url;
  
  const playbackRate = Number(speedSlider.value);
  debugMsg(`Setting playbackRate to: ${playbackRate}`, 'info');
  audio.playbackRate = playbackRate;
  
  renderPlaylist();
  playerStatus.textContent = `Selected: ${track.file.name}`;

  if (autoplay) {
    debugMsg('Attempting autoplay...', 'info');
    audio.play().then(() => {
      debugMsg('Autoplay successful', 'success');
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playPauseBtn.setAttribute('aria-label', 'Pause');
      playerStatus.textContent = `Playing: ${track.file.name}`;
    }).catch((err) => {
      debugMsg(`Autoplay failed: ${err.message}`, 'error');
      playerStatus.textContent = `Unable to autoplay ${track.file.name}; tap Play.`;
    });
  } else {
    debugMsg('Not autoplaying, pausing audio', 'info');
    audio.pause();
    audio.currentTime = 0;
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playPauseBtn.setAttribute('aria-label', 'Play');
  }
}

fileInput.addEventListener('change', (event) => {
  debugMsg('=== FILE SELECTION EVENT ===', 'info');
  const files = Array.from(event.target.files || []);
  debugMsg(`Files selected: ${files.length}`, 'info');
  
  if (!files.length) {
    debugMsg('No files selected', 'warn');
    return;
  }

  files.forEach((file, idx) => {
    debugMsg(`File ${idx + 1}: ${file.name}`, 'info');
    debugMsg(`  Size: ${file.size} bytes`, 'info');
    debugMsg(`  Type: "${file.type || '(empty)'}"`, 'info');
    debugMsg(`  Last Modified: ${new Date(file.lastModified).toISOString()}`, 'info');
  });

  // Accept all audio and video files
  // Also accept files without MIME type if they have common audio/video extensions
  const supported = files.filter((file) => {
    const type = file.type;
    const name = file.name.toLowerCase();
    
    // Check MIME type
    if (type && (type.startsWith('audio/') || type.startsWith('video/'))) {
      debugMsg(`✓ ${file.name} accepted (MIME: ${type})`, 'success');
      return true;
    }
    
    // If no MIME type or unrecognized, check common extensions
    const audioVideoExtensions = /\.(mp3|wav|ogg|m4a|aac|flac|wma|aiff|ape|opus|webm|mp4|mov|avi|mkv|wmv|flv|3gp|m4v)$/i;
    const matchResult = audioVideoExtensions.test(name);
    
    if (matchResult) {
      debugMsg(`✓ ${file.name} accepted (extension match, MIME: ${type || 'none'})`, 'success');
      return true;
    }
    
    debugMsg(`✗ ${file.name} rejected (no MIME or extension match)`, 'error');
    return false;
  });
  
  debugMsg(`Supported files: ${supported.length}/${files.length}`, supported.length > 0 ? 'success' : 'error');
  
  if (!supported.length) {
    playerStatus.textContent = 'No supported audio or video files selected.';
    debugMsg('No supported files to add', 'error');
    return;
  }

  supported.forEach((file) => {
    try {
      const url = URL.createObjectURL(file);
      debugMsg(`Created object URL for ${file.name}: ${url.substring(0, 50)}...`, 'success');
      playlist.push({ file, url });
    } catch (err) {
      debugMsg(`Failed to create URL for ${file.name}: ${err.message}`, 'error');
    }
  });

  if (currentTrackIndex === -1 && playlist.length > 0) {
    currentTrackIndex = 0;
    debugMsg(`Loading first track (index 0)`, 'info');
    loadTrack(0, false);
  }

  renderPlaylist();
  playPauseBtn.disabled = false;
  stopBtn.disabled = false;
  playerStatus.textContent = `${supported.length} file(s) added. ${playlist.length} total in playlist.`;
  debugMsg(`=== FILE SELECTION COMPLETE ===`, 'success');
});

playPauseBtn.addEventListener('click', () => {
  if (currentTrackIndex === -1) {
    return;
  }

  const playIcon = playPauseBtn.querySelector('.play-icon');
  const pauseIcon = playPauseBtn.querySelector('.pause-icon');

  if (audio.paused) {
    audio.play().then(() => {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playPauseBtn.setAttribute('aria-label', 'Pause');
      playerStatus.textContent = `Playing: ${playlist[currentTrackIndex].file.name}`;
    }).catch((err) => {
      playerStatus.textContent = `Playback failed: ${err.message}`;
    });
  } else {
    audio.pause();
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    playPauseBtn.setAttribute('aria-label', 'Play');
    playerStatus.textContent = `Paused: ${playlist[currentTrackIndex].file.name}`;
  }
});

stopBtn.addEventListener('click', () => {
  audio.pause();
  audio.currentTime = 0;
  
  const playIcon = playPauseBtn.querySelector('.play-icon');
  const pauseIcon = playPauseBtn.querySelector('.pause-icon');
  playIcon.style.display = 'block';
  pauseIcon.style.display = 'none';
  playPauseBtn.setAttribute('aria-label', 'Play');
  
  if (currentTrackIndex !== -1) {
    playerStatus.textContent = `Stopped: ${playlist[currentTrackIndex].file.name}`;
  }
});

speedSlider.addEventListener('input', () => {
  speedValue.textContent = `${Number(speedSlider.value).toFixed(1)}x`;
  audio.playbackRate = Number(speedSlider.value);
  saveSettings();
});

volumeSlider.addEventListener('input', () => {
  const volume = Number(volumeSlider.value) / 100;
  audio.volume = volume;
  volumeValue.textContent = `${volumeSlider.value}%`;
  saveSettings();
});

function formatTime(seconds) {
  if (!isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function initWaveformCanvas() {
  if (!waveformCtx) {
    waveformCtx = waveformCanvas.getContext('2d');
    resizeCanvas();
  }
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = waveformCanvas.getBoundingClientRect();
  waveformCanvas.width = rect.width * dpr;
  waveformCanvas.height = rect.height * dpr;
  waveformCtx.scale(dpr, dpr);
  
  if (currentTrackIndex !== -1 && playlist[currentTrackIndex].waveformData) {
    drawCompleteWaveform(playlist[currentTrackIndex].waveformData);
  }
}

function drawPlaceholder() {
  if (!waveformCtx) return;
  
  const width = waveformCanvas.width / (window.devicePixelRatio || 1);
  const height = waveformCanvas.height / (window.devicePixelRatio || 1);
  
  waveformCtx.clearRect(0, 0, width, height);
  waveformCtx.fillStyle = '#374151';
  waveformCtx.fillRect(0, height / 2 - 1, width, 2);
}

async function generateWaveformAsync(track, trackIndex) {
  if (currentWaveformGeneration) {
    currentWaveformGeneration.cancelled = true;
  }
  
  const generation = { cancelled: false };
  currentWaveformGeneration = generation;
  
  waveformProgress.style.display = 'block';
  progressPercent.textContent = '0%';
  
  try {
    drawPlaceholder();
    
    ensureAudioContext();
    
    const arrayBuffer = await track.file.arrayBuffer();
    
    if (generation.cancelled || trackIndex !== currentTrackIndex) return;
    
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    if (generation.cancelled || trackIndex !== currentTrackIndex) return;
    
    const totalChunks = 50;
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerChunk = Math.floor(channelData.length / totalChunks);
    const allPeaks = [];
    
    for (let chunk = 0; chunk < totalChunks; chunk++) {
      if (generation.cancelled || trackIndex !== currentTrackIndex) return;
      
      const start = chunk * samplesPerChunk;
      const end = Math.min(start + samplesPerChunk, channelData.length);
      const chunkPeaks = extractPeaks(channelData, start, end, 40);
      
      allPeaks.push(...chunkPeaks);
      
      drawWaveformChunk(allPeaks, chunk + 1, totalChunks);
      
      const progress = Math.round(((chunk + 1) / totalChunks) * 100);
      progressPercent.textContent = `${progress}%`;
      
      if (chunk % 5 === 0) {
        await new Promise(resolve => {
          if ('requestIdleCallback' in window) {
            requestIdleCallback(resolve);
          } else {
            setTimeout(resolve, 0);
          }
        });
      }
    }
    
    if (generation.cancelled || trackIndex !== currentTrackIndex) return;
    
    track.waveformData = allPeaks;
    track.waveformReady = true;
    waveformProgress.style.display = 'none';
    
  } catch (err) {
    console.warn('Waveform generation failed:', err);
    waveformProgress.textContent = 'Waveform unavailable';
    setTimeout(() => {
      waveformProgress.style.display = 'none';
    }, 2000);
  }
}

function extractPeaks(channelData, start, end, barsPerChunk) {
  const peaks = [];
  const samplesPerBar = Math.floor((end - start) / barsPerChunk);
  
  for (let i = 0; i < barsPerChunk; i++) {
    const barStart = start + i * samplesPerBar;
    const barEnd = Math.min(barStart + samplesPerBar, end);
    
    let maxPeak = 0;
    for (let j = barStart; j < barEnd; j++) {
      maxPeak = Math.max(maxPeak, Math.abs(channelData[j]));
    }
    peaks.push(maxPeak);
  }
  
  return peaks;
}

function drawWaveformChunk(peaks, chunksComplete, totalChunks) {
  if (!waveformCtx) return;
  
  const width = waveformCanvas.width / (window.devicePixelRatio || 1);
  const height = waveformCanvas.height / (window.devicePixelRatio || 1);
  const barWidth = width / peaks.length;
  
  waveformCtx.clearRect(0, 0, width, height);
  
  waveformCtx.fillStyle = '#3b82f6';
  
  peaks.forEach((peak, i) => {
    const barHeight = peak * (height / 2) * 0.9;
    const x = i * barWidth;
    
    waveformCtx.fillRect(x, height / 2 - barHeight, Math.max(barWidth - 1, 1), barHeight);
    waveformCtx.fillRect(x, height / 2, Math.max(barWidth - 1, 1), barHeight);
  });
}

function drawCompleteWaveform(peaks) {
  drawWaveformChunk(peaks, 1, 1);
}

function updatePlayhead() {
  if (!audio.duration || audio.paused || isDraggingPlayhead) return;
  
  const progress = audio.currentTime / audio.duration;
  playhead.style.left = `${progress * 100}%`;
  currentTimeEl.textContent = formatTime(audio.currentTime);
  
  waveformAnimationId = requestAnimationFrame(updatePlayhead);
}

function startPlayheadAnimation() {
  if (waveformAnimationId) {
    cancelAnimationFrame(waveformAnimationId);
  }
  updatePlayhead();
}

function stopPlayheadAnimation() {
  if (waveformAnimationId) {
    cancelAnimationFrame(waveformAnimationId);
    waveformAnimationId = null;
  }
}

audio.addEventListener('loadedmetadata', () => {
  durationEl.textContent = formatTime(audio.duration);
  initWaveformCanvas();
  
  if (currentTrackIndex !== -1) {
    const track = playlist[currentTrackIndex];
    if (track.waveformReady) {
      drawCompleteWaveform(track.waveformData);
    } else if (!track.waveformGenerating) {
      track.waveformGenerating = true;
      generateWaveformAsync(track, currentTrackIndex);
    }
  }
});

audio.addEventListener('play', () => {
  startPlayheadAnimation();
});

audio.addEventListener('pause', () => {
  stopPlayheadAnimation();
});

audio.addEventListener('timeupdate', () => {
  if (!isDraggingPlayhead && audio.paused) {
    const progress = audio.currentTime / audio.duration;
    playhead.style.left = `${progress * 100}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
  }
});

waveformCanvas.addEventListener('click', (e) => {
  if (!audio.duration) return;
  
  const wasPlaying = !audio.paused;
  log('Click - wasPlaying:', wasPlaying, 'audio.paused:', audio.paused);
  
  const rect = waveformCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const progress = x / rect.width;
  const newTime = progress * audio.duration;
  
  log('Click - seeking to:', newTime, 'from:', audio.currentTime);
  audio.currentTime = newTime;
  playhead.style.left = `${progress * 100}%`;
  
  setTimeout(() => {
    log('Click - after seek (async), audio.paused:', audio.paused, 'audio.currentTime:', audio.currentTime);
    
    if (wasPlaying) {
      log('Click - resuming playback (wasPlaying=true)');
      audio.pause();
      log('Click - paused before resume, audio.paused:', audio.paused);
      audio.play()
        .then(() => {
          log('Click - playback resumed successfully, paused:', audio.paused);
        })
        .catch(err => {
          log('Click - failed to resume playback:', err);
          console.warn('Failed to resume playback:', err);
        });
    }
  }, 10);
});

waveformCanvas.addEventListener('mousedown', (e) => {
  if (!audio.duration) return;
  isDraggingPlayhead = true;
  const wasPlaying = !audio.paused;
  
  log('Drag start - wasPlaying:', wasPlaying, 'audio.paused:', audio.paused);
  
  const handleMouseMove = (moveEvent) => {
    const rect = waveformCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(moveEvent.clientX - rect.left, rect.width));
    const progress = x / rect.width;
    audio.currentTime = progress * audio.duration;
    playhead.style.left = `${progress * 100}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
  };
  
  const handleMouseUp = () => {
    log('Drag end - wasPlaying:', wasPlaying, 'audio.paused:', audio.paused);
    isDraggingPlayhead = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    setTimeout(() => {
      log('Drag end (async) - audio.paused:', audio.paused, 'audio.currentTime:', audio.currentTime);
      
      if (wasPlaying) {
        log('Drag end - resuming playback (wasPlaying=true)');
        audio.pause();
        log('Drag end - paused before resume, audio.paused:', audio.paused);
        audio.play()
          .then(() => {
            log('Drag end - playback resumed successfully, paused:', audio.paused);
          })
          .catch(err => {
            log('Drag end - failed to resume playback:', err);
            console.warn('Failed to resume playback:', err);
          });
      }
    }, 10);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
});

waveformCanvas.addEventListener('touchstart', (e) => {
  if (!audio.duration) return;
  e.preventDefault();
  isDraggingPlayhead = true;
  const wasPlaying = !audio.paused;
  
  const handleTouchMove = (moveEvent) => {
    const rect = waveformCanvas.getBoundingClientRect();
    const touch = moveEvent.touches[0];
    const x = Math.max(0, Math.min(touch.clientX - rect.left, rect.width));
    const progress = x / rect.width;
    audio.currentTime = progress * audio.duration;
    playhead.style.left = `${progress * 100}%`;
    currentTimeEl.textContent = formatTime(audio.currentTime);
  };
  
  const handleTouchEnd = () => {
    isDraggingPlayhead = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    if (wasPlaying && audio.paused) {
      audio.play().catch(err => {
        console.warn('Failed to resume playback:', err);
      });
    }
  };
  
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
});

window.addEventListener('resize', () => {
  resizeCanvas();
});

initWaveformCanvas();

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
    return;
  }
  
  if (e.code === 'Space' && currentTrackIndex !== -1) {
    e.preventDefault();
    playPauseBtn.click();
  } else if (e.code === 'ArrowLeft' && currentTrackIndex > 0) {
    e.preventDefault();
    currentTrackIndex -= 1;
    loadTrack(currentTrackIndex, !audio.paused);
  } else if (e.code === 'ArrowRight' && currentTrackIndex < playlist.length - 1) {
    e.preventDefault();
    currentTrackIndex += 1;
    loadTrack(currentTrackIndex, !audio.paused);
  }
});

function saveSettings() {
  try {
    localStorage.setItem('musicTools_speed', speedSlider.value);
    localStorage.setItem('musicTools_volume', volumeSlider.value);
    localStorage.setItem('musicTools_bpm', bpmSlider.value);
    localStorage.setItem('musicTools_accent', accentSelect.value);
  } catch (err) {
    console.warn('Failed to save settings:', err);
  }
}

function loadSettings() {
  try {
    const savedSpeed = localStorage.getItem('musicTools_speed');
    const savedVolume = localStorage.getItem('musicTools_volume');
    const savedBpm = localStorage.getItem('musicTools_bpm');
    const savedAccent = localStorage.getItem('musicTools_accent');
    
    if (savedSpeed !== null) {
      speedSlider.value = savedSpeed;
      speedValue.textContent = `${Number(savedSpeed).toFixed(1)}x`;
      audio.playbackRate = Number(savedSpeed);
    }
    
    if (savedVolume !== null) {
      volumeSlider.value = savedVolume;
      const volume = Number(savedVolume) / 100;
      audio.volume = volume;
      volumeValue.textContent = `${savedVolume}%`;
    }
    
    if (savedBpm !== null) {
      bpmSlider.value = savedBpm;
      bpmInput.value = savedBpm;
    }
    
    if (savedAccent !== null) {
      accentSelect.value = savedAccent;
    }
  } catch (err) {
    console.warn('Failed to load settings:', err);
  }
}

loadSettings();

let audioContext;
let metronomeRunning = false;
let beatCounter = 0;
let nextBeatTime = 0;
let schedulerTimer = null;

const TICK_FREQUENCY = 800;
const CLAP_FREQUENCY = 1200;
const SCHEDULE_AHEAD_TIME = 0.1;
const SCHEDULER_INTERVAL = 25;

function ensureAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

function playClick(time, accented) {
  if (accented) {
    // CLAP sound - combination of noise burst and low frequency punch
    
    // Create noise for the clap body
    const bufferSize = audioContext.sampleRate * 0.15; // 150ms
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    // Filter the noise to sound more like a clap (focus midrange frequencies)
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1000;
    bandpass.Q.value = 2;
    
    // Noise envelope for sharp attack and quick decay
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.4, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    
    // Low frequency "thump" for clap body
    const lowOsc = audioContext.createOscillator();
    lowOsc.frequency.value = 150;
    lowOsc.type = 'sine';
    
    const lowGain = audioContext.createGain();
    lowGain.gain.setValueAtTime(0.3, time);
    lowGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
    
    // Connect clap components
    noise.connect(bandpass).connect(noiseGain).connect(audioContext.destination);
    lowOsc.connect(lowGain).connect(audioContext.destination);
    
    noise.start(time);
    noise.stop(time + 0.15);
    lowOsc.start(time);
    lowOsc.stop(time + 0.08);
    
  } else {
    // TAP sound - original simple beep
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'triangle';
    osc.frequency.value = TICK_FREQUENCY;

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.2, time + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);

    osc.connect(gain).connect(audioContext.destination);
    osc.start(time);
    osc.stop(time + 0.09);
  }
}

function scheduleBeats() {
  const bpm = Number(bpmSlider.value);
  const accentInterval = Number(accentSelect.value);
  const beatInterval = 60.0 / bpm;

  while (nextBeatTime < audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
    // Clap on the FIRST beat of each measure (when beatCounter % accentInterval === 0)
    const isAccented = accentInterval !== 0 && beatCounter % accentInterval === 0;
    playClick(nextBeatTime, isAccented);
    
    // Schedule beat counter update to match the actual beat time
    const currentBeatCount = beatCounter;
    const currentIsAccented = isAccented;
    setTimeout(() => {
      updateBeatDisplay(currentBeatCount, currentIsAccented);
    }, (nextBeatTime - audioContext.currentTime) * 1000);
    
    nextBeatTime += beatInterval;
    beatCounter += 1;
  }
}

function startScheduler() {
  if (!metronomeRunning) {
    return;
  }
  scheduleBeats();
  schedulerTimer = setTimeout(startScheduler, SCHEDULER_INTERVAL);
}

function stopMetronome() {
  metronomeRunning = false;
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  metroToggleBtn.textContent = 'Start';
  metroStatus.textContent = 'Stopped.';
}

function startMetronome() {
  ensureAudioContext();
  beatCounter = 0;
  nextBeatTime = audioContext.currentTime;
  metronomeRunning = true;
  startScheduler();
  metroToggleBtn.textContent = 'Stop';
  metroStatus.textContent = `Running at ${bpmSlider.value} BPM.`;
}

// BPM slider updates input
bpmSlider.addEventListener('input', () => {
  bpmInput.value = bpmSlider.value;
  if (metronomeRunning) {
    metroStatus.textContent = `Running at ${bpmSlider.value} BPM.`;
  }
  saveSettings();
});

// BPM input updates slider
bpmInput.addEventListener('input', () => {
  let value = Number(bpmInput.value);
  // Clamp value between 1 and 300
  if (value < 1) value = 1;
  if (value > 300) value = 300;
  
  bpmInput.value = value;
  bpmSlider.value = value;
  
  if (metronomeRunning) {
    metroStatus.textContent = `Running at ${value} BPM.`;
  }
  saveSettings();
});

// Select all text when BPM input is focused
bpmInput.addEventListener('focus', () => {
  bpmInput.select();
});

accentSelect.addEventListener('change', () => {
  beatCounter = 0; // Reset counter when accent changes
  beatCounterEl.textContent = '-';
  beatCounterEl.classList.remove('accent');
  saveSettings();
});

metroToggleBtn.addEventListener('click', () => {
  if (!metronomeRunning) {
    startMetronome();
  } else {
    stopMetronome();
  }
});

// Update beat counter display
function updateBeatDisplay(beatNum, isAccented) {
  const accentInterval = Number(accentSelect.value);
  
  if (accentInterval === 0 || !metronomeRunning) {
    beatCounterEl.textContent = '-';
    beatCounterEl.classList.remove('accent');
    return;
  }
  
  // Calculate which beat number to display (1-based)
  const currentBeat = (beatNum % accentInterval) + 1;
  beatCounterEl.textContent = currentBeat;
  
  // Highlight on first beat (clap)
  if (isAccented) {
    beatCounterEl.classList.add('accent');
    setTimeout(() => {
      beatCounterEl.classList.remove('accent');
    }, 100);
  }
}

// BPM-based speed control
function calculateAndApplyBpmSpeed() {
  const recordedBpm = Number(recordedBpmInput.value);
  const targetBpm = Number(targetBpmInput.value);
  
  // Only calculate if both values are present and valid
  if (recordedBpm > 0 && targetBpm > 0) {
    const timeStretch = targetBpm / recordedBpm;
    // Clamp the result between 0.1 and 2.0 to match slider limits
    const clampedSpeed = Math.max(0.1, Math.min(2.0, timeStretch));
    
    // Update the speed slider and display
    speedSlider.value = clampedSpeed.toFixed(1);
    speedValue.textContent = `${clampedSpeed.toFixed(1)}x`;
    
    // Apply to audio playback
    audio.playbackRate = clampedSpeed;
    
    log(`BPM Speed: recorded=${recordedBpm}, target=${targetBpm}, speed=${clampedSpeed.toFixed(2)}x`);
    saveSettings();
  }
}

// Event listeners for BPM inputs
recordedBpmInput.addEventListener('input', () => {
  calculateAndApplyBpmSpeed();
  saveBpmValues();
});

targetBpmInput.addEventListener('input', () => {
  calculateAndApplyBpmSpeed();
  saveBpmValues();
});

// Select all text when BPM inputs are focused
recordedBpmInput.addEventListener('focus', () => {
  recordedBpmInput.select();
});

targetBpmInput.addEventListener('focus', () => {
  targetBpmInput.select();
});

// Save and load BPM values
function saveBpmValues() {
  try {
    localStorage.setItem('musicTools_recordedBpm', recordedBpmInput.value);
    localStorage.setItem('musicTools_targetBpm', targetBpmInput.value);
  } catch (err) {
    console.warn('Failed to save BPM values:', err);
  }
}

function loadBpmValues() {
  try {
    const savedRecordedBpm = localStorage.getItem('musicTools_recordedBpm');
    const savedTargetBpm = localStorage.getItem('musicTools_targetBpm');
    
    if (savedRecordedBpm !== null && savedRecordedBpm !== '') {
      recordedBpmInput.value = savedRecordedBpm;
    }
    
    if (savedTargetBpm !== null && savedTargetBpm !== '') {
      targetBpmInput.value = savedTargetBpm;
    }
    
    // Only recalculate speed if both values exist and are not empty
    if (savedRecordedBpm && savedRecordedBpm !== '' && savedTargetBpm && savedTargetBpm !== '') {
      calculateAndApplyBpmSpeed();
    }
  } catch (err) {
    console.warn('Failed to load BPM values:', err);
  }
}

// Load BPM values on initialization
loadBpmValues();
