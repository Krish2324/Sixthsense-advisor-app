import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Animated,
  Platform,
  PermissionsAndroid,
  Alert,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Camera } from 'expo-camera';

interface AgoraVideoCallProps {
  channelName: string;
  token: string;
  uid: number;
  appId: string;
  isVideo: boolean;
  remoteName?: string;
  timerText?: string;
  subStatusText?: string;
  onCallEnd: () => void;
  onUserJoined?: () => void;
  onUserLeft?: () => void;
  onError?: (error: string) => void;
}

export default function AgoraVideoCall({
  channelName,
  token,
  uid,
  appId,
  isVideo,
  remoteName = 'Client',
  timerText,
  subStatusText,
  onCallEnd,
  onUserJoined,
  onUserLeft,
  onError,
}: AgoraVideoCallProps) {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(!isVideo);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [isPermissionReady, setIsPermissionReady] = useState(Platform.OS !== 'android');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speakWaveAnim = useRef(new Animated.Value(1)).current;

  // Configure VoIP audio routing & request OS permissions
  useEffect(() => {
    let isMounted = true;
    async function configureAudioAndPermissions() {
      try {
        // Force Android audio manager into VoIP communication mode with loudspeaker output
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });

        if (Platform.OS === 'android') {
          console.log('[Native] Checking RECORD_AUDIO permission...');
          let hasRecord = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
          console.log('[Native] RECORD_AUDIO status:', hasRecord);
          if (!hasRecord) {
            const req = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
              title: 'Microphone Permission',
              message: 'Sixth Sense needs microphone access for voice and video calls.',
              buttonPositive: 'Allow',
            });
            console.log('[Native] PermissionsAndroid.request RECORD_AUDIO result:', req);
            hasRecord = req === PermissionsAndroid.RESULTS.GRANTED;
          }
          const audioPerm = await Audio.requestPermissionsAsync();
          console.log('[Native] Audio.requestPermissionsAsync:', JSON.stringify(audioPerm));

          if (!hasRecord && !audioPerm.granted) {
            Alert.alert(
              'Microphone Permission Required',
              'Please allow Microphone permission in Android Settings -> Apps -> Expo Go -> Permissions to talk during calls.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
              ]
            );
          }

          if (isVideo) {
            const hasCamera = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (!hasCamera) {
              await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            }
          }
          if (isMounted) {
            setIsPermissionReady(true);
          }
        } else {
          const audioPerm = await Audio.requestPermissionsAsync();
          if (!audioPerm.granted) {
            await Audio.requestPermissionsAsync();
          }
          if (isVideo) {
            const camPerm = await Camera.getCameraPermissionsAsync();
            if (!camPerm.granted) {
              await Camera.requestCameraPermissionsAsync();
            }
          }
          if (isMounted) {
            setIsPermissionReady(true);
          }
        }

        // Trigger local mic creation and remote audio play inside WebView once permissions are ready
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(`
            if (window.ensureLocalAudio) window.ensureLocalAudio();
            if (window.ensureRemoteAudio) window.ensureRemoteAudio();
            true;
          `);
        }, 800);

      } catch (err) {
        console.warn('Advisor audio/permission setup warning:', err);
        if (isMounted) {
          setIsPermissionReady(true);
        }
      }
    }

    configureAudioAndPermissions();

    return () => {
      isMounted = false;
    };
  }, [isVideo]);

  // Pulsing animation for avatar
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.18,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    const readyFallback = setTimeout(() => {
      setIsLoading(false);
    }, 4000);

    return () => {
      loop.stop();
      clearTimeout(readyFallback);
    };
  }, [pulseAnim]);

  // Speaking sound wave animation
  useEffect(() => {
    if (isSpeaking) {
      const wave = Animated.loop(
        Animated.sequence([
          Animated.timing(speakWaveAnim, {
            toValue: 1.35,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(speakWaveAnim, {
            toValue: 1.05,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
      wave.start();
      return () => wave.stop();
    } else {
      speakWaveAnim.setValue(1);
    }
  }, [isSpeaking, speakWaveAnim]);

  const triggerAudioResume = () => {
    webViewRef.current?.injectJavaScript(
      `if (window.__forceResumeAudio) window.__forceResumeAudio(); true;`
    );
  };

  const handleReconnectCall = () => {
    setIsLoading(true);
    setHasError(false);
    triggerAudioResume();
    webViewRef.current?.injectJavaScript(`initAgora(); true;`);
  };

  const toggleAudioRoute = async () => {
    const nextSpeaker = !isSpeakerOn;
    setIsSpeakerOn(nextSpeaker);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: !nextSpeaker,
      });
    } catch (e) {}
    triggerAudioResume();
    webViewRef.current?.injectJavaScript(
      `if (window.setAudioRoute) window.setAudioRoute(${nextSpeaker}); true;`
    );
  };

  // WhatsApp-style instant toggle for microphone
  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    triggerAudioResume();
    webViewRef.current?.injectJavaScript(`toggleMute(${newMuted}); true;`);
  };

  const toggleCamera = () => {
    const newCameraOff = !isCameraOff;
    setIsCameraOff(newCameraOff);
    webViewRef.current?.injectJavaScript(`toggleCamera(${newCameraOff}); true;`);
  };

  const flipCamera = () => {
    webViewRef.current?.injectJavaScript(`if (window.switchCamera) window.switchCamera(); true;`);
  };

  const endCall = () => {
    webViewRef.current?.injectJavaScript(`leaveChannel(); true;`);
    onCallEnd();
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type !== 'volume' || data.localVol > 0 || data.remoteVol > 0) {
        console.log('[Advisor Agora]', data.type, data);
      }

      switch (data.type) {
        case 'camera-switched':
          if (data.facingMode) {
            setIsFrontCamera(data.facingMode === 'user');
          }
          break;
        case 'ready':
          setIsLoading(false);
          break;
        case 'connection-state':
          console.log('[Advisor Agora Connection]:', data.revState, '->', data.curState, data.reason || '');
          if (data.curState === 'CONNECTED') {
            setIsLoading(false);
            setIsRemoteConnected(true);
          } else if (data.curState === 'DISCONNECTED' || data.curState === 'FAILED') {
            setIsRemoteConnected(false);
          }
          break;
        case 'user-joined':
          console.log('✅ Remote client joined advisor call:', data.uid);
          setIsLoading(false);
          setIsRemoteConnected(true);
          setIsRemoteMuted(false);
          onUserJoined?.();
          break;
        case 'user-left':
          console.log('❌ Remote client left advisor call:', data.uid);
          setIsRemoteConnected(false);
          onUserLeft?.();
          break;
        case 'remote-audio-status':
          if (data.playing || !data.muted) {
            setIsRemoteConnected(true);
          }
          if (data.muted !== undefined) {
            setIsRemoteMuted(data.muted);
          }
          break;
        case 'volume':
          if (data.remoteVol > 0) {
            setIsRemoteConnected(true);
          }
          if ((data.remoteVol > 12 || data.localVol > 12) && !isMuted) {
            setIsSpeaking(true);
          } else {
            setIsSpeaking(false);
          }
          break;
        case 'mic-track':
          console.log('Agora Advisor Mic Track Status:', data);
          break;
        case 'publish-status':
          console.log('[Advisor Publish Status]:', data);
          if (data.status === 'published') {
            setIsLoading(false);
            setIsRemoteConnected(true);
          }
          break;
        case 'join-status':
          console.log('[Advisor Join Status]:', data);
          if (data.status === 'joined' || data.status === 'joined-fallback') {
            setIsLoading(false);
            setIsRemoteConnected(true);
          } else if (data.status === 'join-failed' || data.status === 'fallback-failed') {
            console.warn('[Agora Join Error]:', data.error);
          }
          break;
        case 'log':
        case 'warn':
          console.log(`[Agora WebView ${data.type}]:`, data.text);
          break;
        case 'error':
        case 'webview-error':
        case 'webview-unhandledrejection':
          console.warn('[Advisor Agora WebView Error]:', data);
          setIsLoading(false);
          onError?.(data.message || data.text || JSON.stringify(data));
          break;
        case 'call-ended':
          onCallEnd();
          break;
      }
    } catch (e) {
      console.error('Error parsing Advisor WebView message:', e);
    }
  };

  const safeAppId =
    appId ||
    process.env.EXPO_PUBLIC_AGORA_APP_ID ||
    'adff706fa53f45529d871c60da335b84';
  const safeChannel = (channelName || 'sixthsense_live').trim().replace(/[^a-zA-Z0-9_-]/g, '') || 'sixthsense_live';
  const safeToken = token && !token.startsWith('mock_token_') ? token : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0B0E14; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #videos { width: 100%; height: 100%; position: relative; }
    #remote-video { width: 100%; height: 100%; object-fit: cover; background: #12151D; }
    #local-video { 
      position: absolute; 
      top: 85px; 
      right: 16px; 
      width: 110px; 
      height: 155px; 
      border-radius: 14px;
      overflow: hidden;
      border: 2px solid rgba(255,255,255,0.85);
      background: #1C2230;
      touch-action: none;
      z-index: 10;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    #local-video video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); transition: transform 0.2s ease; }
    #remote-video video { width: 100%; height: 100%; object-fit: cover; }
    .placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: rgba(255,255,255,0.85);
      font-size: 15px;
      gap: 10px;
    }
    .connecting {
      position: absolute;
      top: 46%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: rgba(255,255,255,0.85);
      text-align: center;
      font-size: 16px;
      font-weight: 600;
    }
  </style>
  <script>
    // Ensure mediaDevices and getUserMedia exist even in Android WebView
    try {
      if (!navigator.mediaDevices) {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {},
          writable: true,
          configurable: true
        });
      }
      if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          var legacy = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;
          if (legacy) {
            return new Promise(function(res, rej) {
              legacy.call(navigator, constraints, res, rej);
            });
          }
          return Promise.reject(new Error("getUserMedia not supported in this WebView"));
        };
      }
    } catch (e) {
      console.warn("Polyfill error:", e);
    }
  </script>
</head>
<body>
  <div id="videos">
    <div id="remote-video">
      <div class="connecting" id="status">${isVideo ? 'Connecting Agora Video HD...' : ''}</div>
    </div>
    <div id="local-video" style="${isVideo ? '' : 'display:none;'}"></div>
    <audio id="agora-remote-audio" autoplay playsinline webkit-playsinline style="position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01;pointer-events:none;"></audio>
  </div>

  <script>
    function sendMessage(type, data = {}) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
      }
    }

    // Forward uncaught errors to React Native
    window.onerror = function(msg, url, line, col, err) {
      sendMessage("webview-error", { message: msg, line, col, stack: err ? err.stack : null });
    };
    window.onunhandledrejection = function(event) {
      sendMessage("webview-unhandledrejection", { reason: String(event.reason) });
    };

    // Safe localStorage fallback to prevent Access Denied SecurityError in Android WebView
    try {
      window.localStorage.getItem("__test");
    } catch (e) {
      var memStorage = {};
      try {
        Object.defineProperty(window, "localStorage", {
          value: {
            getItem: function(k) { return memStorage[k] || null; },
            setItem: function(k, v) { memStorage[k] = String(v); },
            removeItem: function(k) { delete memStorage[k]; },
            clear: function() { memStorage = {}; }
          },
          configurable: true,
          writable: true
        });
      } catch (e2) {}
    }

    // WebRTC getUserMedia standard polyfill
    try {
      if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
      }
      if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          const legacyGetMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
          if (!legacyGetMedia) {
            return Promise.reject(new Error("getUserMedia is not supported"));
          }
          return new Promise(function(res, rej) {
            legacyGetMedia.call(navigator, constraints, res, rej);
          });
        };
      }
    } catch (e) {}
  </script>
  <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js"></script>
  <script>

    function formatLogArg(a) {
      if (a === null || a === undefined) return String(a);
      if (a instanceof Error || (typeof a === 'object' && a.message)) {
        return (a.name ? a.name + ': ' : '') + a.message + (a.stack ? ' | ' + a.stack : '');
      }
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }

    // Forward console logs to React Native with full error details
    const origLog = console.log;
    const origWarn = console.warn;
    const origErr = console.error;
    console.log = function(...args) {
      origLog.apply(console, args);
      sendMessage("log", { text: args.map(formatLogArg).join(' ') });
    };
    console.warn = function(...args) {
      origWarn.apply(console, args);
      sendMessage("warn", { text: args.map(formatLogArg).join(' ') });
    };
    console.error = function(...args) {
      origErr.apply(console, args);
      sendMessage("error", { text: args.map(formatLogArg).join(' ') });
    };

    window.__forceResumeAudio = function() {
      try {
        if (typeof AgoraRTC !== "undefined" && typeof AgoraRTC.resumeAudioContext === "function") {
          AgoraRTC.resumeAudioContext().catch(function() {});
        }
      } catch (e) {}

      try {
        if (client && client.remoteUsers) {
          client.remoteUsers.forEach(function(u) {
            if (u.hasAudio && u.audioTrack && !u.audioTrack.isPlaying) {
              try {
                u.audioTrack.play();
              } catch (pe) {}
            }
          });
        }
      } catch (e) {}
    };

    let isCreatingMic = false;
    let micPublishAttempts = 0;

    async function acquireLocalAudioTrack() {
      console.log("Acquiring local audio track...");

      // Attempt 1: AgoraRTC clean microphone creation
      try {
        console.log("Attempt 1: AgoraRTC.createMicrophoneAudioTrack()...");
        const track = await AgoraRTC.createMicrophoneAudioTrack();
        console.log("Attempt 1 SUCCEEDED: Agora mic track created!");
        return track;
      } catch (err1) {
        console.warn("Attempt 1 failed:", formatLogArg(err1));
      }

      // Attempt 2: Direct browser getUserMedia + AgoraRTC.createCustomAudioTrack fallback
      try {
        console.log("Attempt 2: Direct navigator.mediaDevices.getUserMedia({ audio: true })...");
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log("Direct getUserMedia got stream! Audio tracks:", stream.getAudioTracks().length);
          const rawTrack = stream.getAudioTracks()[0];
          const customTrack = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: rawTrack });
          console.log("Attempt 2 SUCCEEDED: Custom Agora audio track created from native stream!");
          return customTrack;
        }
      } catch (err2) {
        console.warn("Attempt 2 failed:", formatLogArg(err2));
      }

      throw new Error("All local microphone track acquisition attempts failed");
    }

    async function createAndPublishMic() {
      if (localAudioTrack || isCreatingMic || !client || !isJoined) {
        return;
      }
      if (micPublishAttempts >= 4) {
        return;
      }
      isCreatingMic = true;
      micPublishAttempts++;

      try {
        console.log("Advisor creating local microphone track (attempt " + micPublishAttempts + ")...");
        localAudioTrack = await acquireLocalAudioTrack();
        if (localAudioTrack) {
          if (typeof localAudioTrack.setVolume === "function") {
            localAudioTrack.setVolume(120);
          }
          await client.publish([localAudioTrack]);
          console.log("Advisor microphone track published successfully to Agora channel!");
          sendMessage("mic-track", { status: "created-published", trackId: localAudioTrack.getTrackId() });
          sendMessage("publish-status", { status: "published", count: 1 });
        }
      } catch (err) {
        console.warn("Advisor createAndPublishMic error:", formatLogArg(err));
      } finally {
        isCreatingMic = false;
      }
    }

    window.ensureLocalAudio = async function() {
      await createAndPublishMic();
    };

    window.ensureRemoteAudio = function() {
      window.__forceResumeAudio();
    };

    window.addEventListener("touchstart", function() { window.__forceResumeAudio(); }, { passive: true });
    window.addEventListener("click", function() { window.__forceResumeAudio(); }, { passive: true });

    // Periodic keep-alive for audio context, remote tracks & mic reconnect (5s interval, mutex guarded)
    setInterval(function() {
      window.__forceResumeAudio();
      if (!localAudioTrack && isJoined && !isCreatingMic && micPublishAttempts < 4) {
        createAndPublishMic();
      }
    }, 5000);

    const APP_ID = "${safeAppId}";
    const CHANNEL = "${safeChannel}";
    const TOKEN = "${safeToken}" || null;
    const UID = ${uid || 0};
    const IS_VIDEO = ${isVideo};

    let client = null;
    let localAudioTrack = null;
    let localVideoTrack = null;
    let currentFacingMode = "user";
    let isSwitchingCamera = false;

    function applyMirror(facing) {
      try {
        const lv = document.getElementById("local-video");
        if (lv) {
          const v = lv.querySelector("video");
          if (v) {
            v.style.transform = (facing === "environment") ? "scaleX(1)" : "scaleX(-1)";
          }
        }
      } catch (e) {}
    }

    let isInitializing = false;
    let isJoined = false;
    let lastZeroVolSentTime = 0;

    // Handle browser autoplay policy restrictions for audio
    if (typeof AgoraRTC !== "undefined") {
      AgoraRTC.onAudioAutoplayFailed = () => {
        console.log("Audio autoplay restricted. Resuming audio context...");
        window.__forceResumeAudio();
      };
    }

    async function initAgora() {
      if (isInitializing || isJoined) {
        console.log("initAgora already running or joined, ignoring duplicate invocation");
        return;
      }
      isInitializing = true;

      try {
        if (typeof AgoraRTC === "undefined") {
          console.warn("AgoraRTC SDK not loaded yet, retrying in 300ms");
          isInitializing = false;
          setTimeout(initAgora, 300);
          return;
        }

        console.log("Initializing Advisor Agora client for channel:", CHANNEL, "UID:", UID);
        client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        // Connection state monitoring
        client.on("connection-state-change", (curState, revState, reason) => {
          console.log("Advisor Agora connection state:", revState, "->", curState, "reason:", reason);
          sendMessage("connection-state", { curState, revState, reason });
        });

        // Step 1: Enable volume indicator with direct polling and throttled logging
        client.enableAudioVolumeIndicator();
        client.on("volume-indicator", (volumes) => {
          let localVol = 0;
          let remoteVol = 0;
          volumes.forEach((v) => {
            const isLocal = v.uid === 0 || v.uid === UID || (client && v.uid === client.uid);
            if (isLocal) {
              localVol = Math.max(localVol, v.level);
            } else {
              remoteVol = Math.max(remoteVol, v.level);
            }
          });

          // Direct hardware mic input measurement from localAudioTrack
          if (localAudioTrack && typeof localAudioTrack.getVolumeLevel === "function") {
            try {
              const directVol = Math.round(localAudioTrack.getVolumeLevel() * 100);
              localVol = Math.max(localVol, directVol);
            } catch (e) {}
          }

          const now = Date.now();
          if (localVol > 0 || remoteVol > 0 || now - lastZeroVolSentTime > 3000) {
            lastZeroVolSentTime = now;
            sendMessage("volume", { localVol, remoteVol });
          }
        });

        // Remote user published stream
        client.on("user-published", async (user, mediaType) => {
          console.log("user-published event:", user.uid, mediaType);
          try {
            await client.subscribe(user, mediaType);
            console.log("Subscribed to remote user:", user.uid, mediaType);

            if (mediaType === "audio") {
              if (user.audioTrack) {
                if (typeof user.audioTrack.setVolume === "function") {
                  user.audioTrack.setVolume(120);
                }
                user.audioTrack.play();
                console.log("Playing remote audioTrack for user:", user.uid);
              }
              window.__forceResumeAudio();
              sendMessage("remote-audio-status", { muted: false, playing: true, uid: user.uid });
            }

            if (mediaType === "video" && IS_VIDEO) {
              const remoteContainer = document.getElementById("remote-video");
              if (remoteContainer && user.videoTrack) {
                remoteContainer.innerHTML = "";
                user.videoTrack.play(remoteContainer);
              }
            }

            sendMessage("user-joined", { uid: user.uid, mediaType });
            const st = document.getElementById("status");
            if (st) st.remove();
          } catch (pubErr) {
            console.warn("user-published subscribe error:", pubErr);
          }
        });

        // Remote user muted or unpublished stream
        client.on("user-unpublished", (user, mediaType) => {
          console.log("user-unpublished event:", user.uid, mediaType);
          if (mediaType === "audio") {
            if (user.audioTrack) {
              try { user.audioTrack.stop(); } catch (e) {}
            }
            sendMessage("remote-audio-status", { muted: true, playing: false, uid: user.uid });
          }
          if (mediaType === "video") {
            const remoteContainer = document.getElementById("remote-video");
            if (remoteContainer) {
              remoteContainer.innerHTML = '<div class="placeholder">Camera Paused</div>';
            }
          }
        });

        // Remote user joined channel event
        client.on("user-joined", (user) => {
          console.log("Agora remote user-joined event:", user.uid);
          sendMessage("user-joined", { uid: user.uid });
          window.__forceResumeAudio();
        });

        client.on("user-left", (user) => {
          console.log("user-left event:", user.uid);
          sendMessage("user-left", { uid: user.uid });
        });

        // Step 2: Join Agora channel FIRST (Astrology pattern: UID=0 or dynamic)
        const joinUid = (UID && UID !== 0) ? UID : null;
        try {
          console.log("Calling client.join for advisor channel:", CHANNEL, "with UID:", joinUid, "token length:", (TOKEN || "").length);
          await client.join(APP_ID, CHANNEL, TOKEN || null, joinUid);
          isJoined = true;
          console.log("Advisor joined Agora channel successfully:", CHANNEL, "assigned uid:", client.uid);
          sendMessage("join-status", { status: "joined", channel: CHANNEL, uid: client.uid || UID });
        } catch (joinErr) {
          console.warn("Advisor join with token failed:", joinErr);
          if (TOKEN) {
            try {
              await client.join(APP_ID, CHANNEL, null, joinUid);
              isJoined = true;
              sendMessage("join-status", { status: "joined-fallback", channel: CHANNEL, uid: client.uid });
            } catch (e2) {
              sendMessage("join-status", { status: "fallback-failed", error: String(e2) });
              throw e2;
            }
          } else {
            sendMessage("join-status", { status: "join-failed", error: String(joinErr) });
            throw joinErr;
          }
        }

        // Check if remote users already exist in channel & subscribe immediately
        if (client.remoteUsers && client.remoteUsers.length > 0) {
          console.log("Found existing remote users in advisor channel:", client.remoteUsers.length);
          for (let i = 0; i < client.remoteUsers.length; i++) {
            const rUser = client.remoteUsers[i];
            sendMessage("user-joined", { uid: rUser.uid });
            if (rUser.hasAudio) {
              try {
                await client.subscribe(rUser, "audio");
                if (rUser.audioTrack) {
                  if (typeof rUser.audioTrack.setVolume === "function") {
                    rUser.audioTrack.setVolume(120);
                  }
                  rUser.audioTrack.play();
                  sendMessage("remote-audio-status", { muted: false, playing: true, uid: rUser.uid });
                }
              } catch (subErr) {
                console.warn("Error subscribing to existing user audio:", subErr);
              }
            }
            if (rUser.hasVideo && IS_VIDEO) {
              try {
                await client.subscribe(rUser, "video");
                const remoteContainer = document.getElementById("remote-video");
                if (remoteContainer && rUser.videoTrack) {
                  remoteContainer.innerHTML = "";
                  rUser.videoTrack.play(remoteContainer);
                }
              } catch (subErr) {
                console.warn("Error subscribing to existing user video:", subErr);
              }
            }
          }
        }

        // Step 3: Safely create and publish local microphone track
        await createAndPublishMic();

        // Step 4: Create camera track if video call
        if (IS_VIDEO) {
          try {
            localVideoTrack = await AgoraRTC.createCameraVideoTrack({
              facingMode: currentFacingMode,
              encoderConfig: "480p_1",
            });
            const lv = document.getElementById("local-video");
            if (lv) {
              lv.innerHTML = "";
              localVideoTrack.play(lv);
              applyMirror(currentFacingMode);
            }
            await client.publish([localVideoTrack]);
            console.log("Advisor camera track created, published and playing locally");
          } catch (camErr) {
            console.warn("Camera creation error:", camErr);
          }
        } else {
          const lv = document.getElementById("local-video");
          if (lv) lv.style.display = "none";
        }

        // Resume audio context
        window.__forceResumeAudio();

        sendMessage("ready");
        const st = document.getElementById("status");
        if (st && IS_VIDEO) {
          st.textContent = "Waiting for ${remoteName.replace(/"/g, '')} video...";
        }
      } catch (error) {
        console.error("Agora initialization error:", error);
        sendMessage("ready");
        sendMessage("error", { message: String(error) });
      } finally {
        isInitializing = false;
      }
    }

    // Audio route toggle
    window.setAudioRoute = function(speakerOn) {
      const el = document.getElementById("agora-remote-audio");
      if (el) {
        el.volume = speakerOn ? 1.0 : 0.8;
      }
      window.__forceResumeAudio();
    };

    // WhatsApp-style audio mute toggle
    async function toggleMute(muted) {
      console.log("toggleMute invoked:", muted);
      if (localAudioTrack) {
        try {
          await localAudioTrack.setEnabled(!muted);
          if (typeof localAudioTrack.setMuted === "function") {
            await localAudioTrack.setMuted(muted);
          }
          console.log("localAudioTrack setEnabled:", !muted);
        } catch (e) {
          console.error("Failed to set audio enabled:", e);
        }
      }
    }

    // Video camera toggle
    function toggleCamera(off) {
      if (localVideoTrack) {
        localVideoTrack.setEnabled(!off);
        const lv = document.getElementById("local-video");
        if (lv) lv.style.display = off ? "none" : "block";
      }
    }

    // Flip / Switch Camera between Front and Back
    window.switchCamera = async function() {
      if (!IS_VIDEO || isSwitchingCamera) return;
      isSwitchingCamera = true;
      try {
        const nextFacing = (currentFacingMode === "user") ? "environment" : "user";
        console.log("switchCamera invoked, target facing:", nextFacing);

        let switched = false;

        // Method 1: Agora Web SDK 4.19+ native setDevice with facingMode object
        if (localVideoTrack && typeof localVideoTrack.setDevice === "function") {
          try {
            await localVideoTrack.setDevice({ facingMode: nextFacing });
            switched = true;
            console.log("Switched camera via setDevice({ facingMode }):", nextFacing);
          } catch (e1) {
            console.warn("setDevice facingMode failed, will try deviceId:", e1);
          }
        }

        // Method 2: Enumerate devices via AgoraRTC.getCameras()
        if (!switched && localVideoTrack) {
          try {
            const cameras = await AgoraRTC.getCameras();
            console.log("Available cameras:", JSON.stringify(cameras));
            if (cameras && cameras.length > 1) {
              const currentTrack = localVideoTrack.getMediaStreamTrack ? localVideoTrack.getMediaStreamTrack() : null;
              const currentDevId = (currentTrack && currentTrack.getSettings) ? currentTrack.getSettings().deviceId : null;

              let targetCam = cameras.find(c => {
                const lbl = (c.label || "").toLowerCase();
                if (nextFacing === "environment") {
                  return lbl.includes("back") || lbl.includes("rear") || lbl.includes("environment") || lbl.includes("0");
                } else {
                  return lbl.includes("front") || lbl.includes("user") || lbl.includes("selfie") || lbl.includes("1");
                }
              });

              if (!targetCam) {
                targetCam = cameras.find(c => c.deviceId && c.deviceId !== currentDevId) || cameras[1];
              }

              if (targetCam && targetCam.deviceId) {
                await localVideoTrack.setDevice(targetCam.deviceId);
                switched = true;
                console.log("Switched camera via deviceId:", targetCam.deviceId);
              }
            }
          } catch (e2) {
            console.warn("getCameras deviceId switch failed:", e2);
          }
        }

        // Method 3: Cleanly recreate camera track with nextFacing
        if (!switched && client) {
          try {
            console.log("Recreating camera track with facingMode:", nextFacing);
            if (localVideoTrack) {
              try { await client.unpublish([localVideoTrack]); } catch (uErr) {}
              try { localVideoTrack.stop(); } catch (sErr) {}
              try { localVideoTrack.close(); } catch (cErr) {}
            }
            localVideoTrack = await AgoraRTC.createCameraVideoTrack({
              facingMode: nextFacing,
              encoderConfig: "480p_1",
            });
            const lv = document.getElementById("local-video");
            if (lv) {
              lv.innerHTML = "";
              localVideoTrack.play(lv);
            }
            await client.publish([localVideoTrack]);
            switched = true;
            console.log("Successfully recreated and published camera track:", nextFacing);
          } catch (e3) {
            console.error("Failed to recreate camera track:", e3);
          }
        }

        if (switched) {
          currentFacingMode = nextFacing;
          applyMirror(currentFacingMode);
          sendMessage("camera-switched", { facingMode: currentFacingMode });
        }
      } catch (err) {
        console.error("switchCamera error:", err);
      } finally {
        isSwitchingCamera = false;
      }
    };

    // Leave channel safely
    async function leaveChannel() {
      try {
        if (localAudioTrack) {
          localAudioTrack.stop();
          localAudioTrack.close();
        }
        if (localVideoTrack) {
          localVideoTrack.stop();
          localVideoTrack.close();
        }
        if (client) {
          await client.leave();
        }
      } catch (e) {
        console.warn("Error leaving channel:", e);
      }
      isJoined = false;
      sendMessage("call-ended");
    }

    // Single deterministic entry point
    if (document.readyState === "complete" || document.readyState === "interactive") {
      initAgora();
    } else {
      window.addEventListener("DOMContentLoaded", initAgora, { once: true });
    }
  </script>
</body>
</html>
  `;

  return (
    <View style={styles.container}>
      {/* Agora WebRTC Video/Audio WebView */}
      {isPermissionReady ? (
        <WebView
          ref={webViewRef}
          key={safeChannel}
          source={{ html, baseUrl: 'https://sixthsensepsychics.com/' }}
          style={styles.webview}
          onMessage={handleMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          originWhitelist={['*']}
          mediaCapturePermissionGrantType="grant"
          androidLayerType="hardware"
          mixedContentMode="always"
          allowFileAccess={true}
          allowUniversalAccessFromFileURLs={true}
        />
      ) : (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Initializing secure audio...</Text>
        </View>
      )}

      {/* Top Floating WhatsApp Call Info & Mute Status Bar */}
      <View style={styles.topInfoBar} pointerEvents="none">
        <View style={styles.encryptionBadge}>
          <Ionicons name="lock-closed" size={12} color="#10B981" />
          <Text style={styles.encryptionText}>End-to-End Encrypted HD Call</Text>
        </View>

        {/* WhatsApp-Style Muted Status Banner */}
        {isMuted && (
          <View style={styles.mutedPillBanner}>
            <Ionicons name="mic-off" size={14} color="#FFF" />
            <Text style={styles.mutedPillText}>Microphone is Muted</Text>
          </View>
        )}

        {isRemoteMuted && isRemoteConnected && (
          <View style={[styles.mutedPillBanner, { backgroundColor: 'rgba(239, 68, 68, 0.85)' }]}>
            <Ionicons name="mic-off" size={14} color="#FFF" />
            <Text style={styles.mutedPillText}>{remoteName} is muted</Text>
          </View>
        )}
      </View>

      {/* Top Right Floating Flip Camera Button (over local video preview) */}
      {isVideo && !isCameraOff && (
        <TouchableOpacity
          style={styles.previewFlipBtn}
          onPress={flipCamera}
          activeOpacity={0.8}
        >
          <Ionicons name="camera-reverse" size={15} color="#FFF" />
          <Text style={styles.previewFlipText}>
            {isFrontCamera ? 'Back Cam' : 'Front Cam'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Audio Call UI Overlay */}
      {!isVideo && (
        <View style={styles.audioCallOverlay} pointerEvents="none">
          <View style={styles.audioAvatarWrapper}>
            {/* Speaking active soundwave animation */}
            <Animated.View
              style={[
                styles.speakingWaveCircle,
                {
                  transform: [{ scale: isSpeaking ? speakWaveAnim : pulseAnim }],
                  opacity: isSpeaking ? 0.6 : 0.25,
                  borderColor: isSpeaking ? '#22C55E' : '#9C6ADE',
                },
              ]}
            />
            <View
              style={[
                styles.audioAvatar,
                isSpeaking && { borderColor: '#22C55E', borderWidth: 3 },
              ]}
            >
              <Text style={styles.audioAvatarLetter}>
                {remoteName.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Mic muted badge on remote avatar */}
            {isRemoteMuted && (
              <View style={styles.avatarMuteBadge}>
                <Ionicons name="mic-off" size={14} color="#FFF" />
              </View>
            )}
          </View>

          <Text style={styles.remoteNameText}>{remoteName}</Text>

          <View style={styles.liveBadge}>
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isRemoteConnected ? '#22C55E' : '#9C6ADE' },
              ]}
            />
            <Text style={styles.liveBadgeText}>
              {isRemoteConnected ? 'HD Voice Connected' : 'Connecting Audio Call...'}
            </Text>
          </View>

          {timerText ? <Text style={styles.bigTimerText}>{timerText}</Text> : null}
          {subStatusText ? (
            <Text style={styles.subStatusText}>{subStatusText}</Text>
          ) : null}
        </View>
      )}

      {/* Loading Overlay */}
      {isLoading && isVideo && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#9C6ADE" />
          <Text style={styles.loadingText}>Connecting Agora Video Call...</Text>
        </View>
      )}

      {/* Disconnected / Reconnect Overlay */}
      {hasError && (
        <View style={styles.loadingOverlay}>
          <Ionicons name="cloud-offline" size={48} color="#EF4444" />
          <Text
            style={[
              styles.loadingText,
              { marginTop: 12, color: '#EF4444', fontWeight: '700' },
            ]}
          >
            Call Disconnected
          </Text>
          <TouchableOpacity
            style={styles.reconnectBtn}
            onPress={handleReconnectCall}
          >
            <Ionicons name="refresh" size={18} color="#FFF" />
            <Text style={styles.reconnectBtnText}>Reconnect Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Floating WhatsApp-Style Call Controls Bar */}
      <View style={styles.whatsappControlsCard}>
        {/* WhatsApp-Style Mute / Unmute Button */}
        <TouchableOpacity
          style={[
            styles.whatsappControlBtn,
            isMuted && styles.whatsappMuteBtnActive,
          ]}
          onPress={toggleMute}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isMuted ? 'mic-off' : 'mic'}
            size={26}
            color="#FFF"
          />
          <Text style={styles.whatsappControlLabel}>
            {isMuted ? 'Unmute' : 'Mute'}
          </Text>
        </TouchableOpacity>

        {/* WhatsApp-Style Speaker / Earpiece Toggle */}
        <TouchableOpacity
          style={[
            styles.whatsappControlBtn,
            isSpeakerOn && styles.whatsappSpeakerActive,
          ]}
          onPress={toggleAudioRoute}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isSpeakerOn ? 'volume-high' : 'ear'}
            size={26}
            color="#FFF"
          />
          <Text style={styles.whatsappControlLabel}>
            {isSpeakerOn ? 'Speaker' : 'Earpiece'}
          </Text>
        </TouchableOpacity>

        {/* Video Camera Toggle (for video calls) */}
        {isVideo && (
          <TouchableOpacity
            style={[
              styles.whatsappControlBtn,
              isCameraOff && styles.whatsappControlBtnActive,
            ]}
            onPress={toggleCamera}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isCameraOff ? 'videocam-off' : 'videocam'}
              size={24}
              color="#FFF"
            />
            <Text style={styles.whatsappControlLabel}>
              {isCameraOff ? 'Cam Off' : 'Camera'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Flip / Switch Camera (Front <-> Back for video calls) */}
        {isVideo && !isCameraOff && (
          <TouchableOpacity
            style={styles.whatsappControlBtn}
            onPress={flipCamera}
            activeOpacity={0.7}
          >
            <Ionicons
              name="camera-reverse-outline"
              size={24}
              color="#FFF"
            />
            <Text style={styles.whatsappControlLabel}>
              {isFrontCamera ? 'Back Cam' : 'Front Cam'}
            </Text>
          </TouchableOpacity>
        )}

        {/* WhatsApp-Style End Call Red Button */}
        <TouchableOpacity
          style={styles.whatsappEndCallBtn}
          onPress={endCall}
          activeOpacity={0.7}
        >
          <Ionicons
            name="call"
            size={28}
            color="#FFF"
            style={{ transform: [{ rotate: '135deg' }] }}
          />
          <Text style={styles.whatsappControlLabel}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  topInfoBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6,
  },
  encryptionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  mutedPillBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  mutedPillText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  audioCallOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B0E14',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 110,
  },
  audioAvatarWrapper: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  speakingWaveCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  audioAvatar: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: '#E8A0B8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#F472B6',
  },
  avatarMuteBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#EF4444',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0B0E14',
  },
  audioAvatarLetter: {
    color: '#FFF',
    fontSize: 48,
    fontWeight: '800',
  },
  remoteNameText: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  bigTimerText: {
    color: '#FFF',
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  subStatusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginTop: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 14, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFF',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  reconnectBtn: {
    marginTop: 20,
    backgroundColor: '#E8A0B8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reconnectBtnText: {
    color: '#121225',
    fontWeight: '700',
    fontSize: 15,
  },
  previewFlipBtn: {
    position: 'absolute',
    top: 92,
    right: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  previewFlipText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  whatsappControlsCard: {
    position: 'absolute',
    bottom: 34,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(22, 27, 34, 0.92)',
    borderRadius: 36,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 10,
  },
  whatsappControlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whatsappMuteBtnActive: {
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  whatsappSpeakerActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.35)',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  whatsappControlBtnActive: {
    backgroundColor: '#EF4444',
  },
  whatsappEndCallBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#DC2626',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  whatsappControlLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 3,
  },
});
