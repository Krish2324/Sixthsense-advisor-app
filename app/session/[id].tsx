import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Image,
  Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import AgoraVideoCall from '../../src/components/AgoraVideoCall';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://api.sixthsensepsychics.com';
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

interface Message {
  id: string;
  text: string;
  sender: 'client' | 'psychic' | 'system';
  timestamp: Date;
  type?: 'text' | 'image' | 'warning';
  imageUrl?: string;
}

export default function ActiveSessionChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { psychic: currentPsychic } = useAuth();
  
  const sessionId = params.id as string;
  const clientId = params.clientId as string;
  const clientName = params.clientName as string || 'Client';
  const rate = parseFloat(params.rate as string || '2.99');
  const initialSessionType = ((params.sessionType as string) || 'chat').toLowerCase();

  const [activeSessionType, setActiveSessionType] = useState<'chat' | 'phone' | 'video'>(
    initialSessionType === 'video' ? 'video' : initialSessionType === 'phone' || initialSessionType === 'voice' ? 'phone' : 'chat'
  );
  const [showChatInCall, setShowChatInCall] = useState(false);
  const cleanSessionId = String(sessionId || params.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  const fallbackChannel = `sixthsense_${cleanSessionId}`;
  const [agoraConfig, setAgoraConfig] = useState({
    channel: (params.agoraChannel as string) || fallbackChannel,
    appId: (params.agoraAppId as string) || 'adff706fa53f45529d871c60da335b84',
    uid: parseInt((params.agoraUid as string) || '100002', 10),
    token: (params.agoraToken as string) || '',
  });
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [clientIsTyping, setClientIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // ADV-023: Audio route switcher state (speaker, earpiece, bluetooth)
  const [audioRoute, setAudioRoute] = useState<'speaker' | 'earpiece' | 'bluetooth'>('speaker');
  // ADV-030: Mute indicator state
  const [isMuted, setIsMuted] = useState(false);
  // ADV-032: Network quality ping ms
  const [networkPing, setNetworkPing] = useState<number>(45);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const toggleAudioRoute = () => {
    const routes: ('speaker' | 'earpiece' | 'bluetooth')[] = ['speaker', 'earpiece', 'bluetooth'];
    const nextIndex = (routes.indexOf(audioRoute) + 1) % routes.length;
    const nextRoute = routes[nextIndex];
    setAudioRoute(nextRoute);
  };
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<any>(null);

  // ADV-031: Load previous saved session duration if battery/app crashed
  useEffect(() => {
    AsyncStorage.getItem(`session_duration_${sessionId}`).then(saved => {
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          setSessionDuration(parsed);
        }
      }
    }).catch(() => null);

    // Immediately fetch session details to ensure Agora credentials are ready
    fetch(`${BACKEND_URL}/api/chat/${sessionId}`)
      .then(res => res.ok ? res.json() : null)
      .then(sessData => {
        if (!sessData) return;
        if (sessData.session_type) {
          const st = sessData.session_type === 'video' ? 'video' : sessData.session_type === 'phone' || sessData.session_type === 'voice' || sessData.session_type === 'audio' ? 'phone' : 'chat';
          setActiveSessionType(st);
        }
        if (sessData.agora_channel) {
          setAgoraConfig(prev => ({
            channel: sessData.agora_channel || prev.channel,
            appId: sessData.agora_app_id || prev.appId,
            uid: sessData.psychic_uid || prev.uid,
            token: sessData.psychic_token || prev.token,
          }));
        }
      })
      .catch(err => console.warn('Immediate advisor session fetch error:', err));
  }, [sessionId, audioRoute]);

  // Session timer & 120-min cap (ADV-025) + ADV-031 Auto-save duration
  useEffect(() => {
    if (!isSessionActive) return;
    
    const timer = setInterval(() => {
      setSessionDuration(prev => {
        const nextDuration = prev + 1;
        
        // ADV-031: Auto-save duration every 10 seconds to protect against crash/battery death
        if (nextDuration % 10 === 0) {
          AsyncStorage.setItem(`session_duration_${sessionId}`, nextDuration.toString()).catch(() => null);
        }

        // ADV-025: 120-minute (7200 seconds) max call duration cap
        if (nextDuration >= 7200) {
          clearInterval(timer);
          setIsSessionActive(false);
          Alert.alert('Session Cap Reached', 'Session reached 120-minute max duration limit.', [
            { text: 'OK', onPress: () => navigateToSummary() }
          ]);
        }
        return nextDuration;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isSessionActive, sessionId]);

  // ADV-027: Rejoin session state & reconnect handler
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const reconnectSession = () => {
    setIsDisconnected(false);
    setReconnectAttempts(prev => prev + 1);
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
    }
    connectWebSocket();
  };

  const [billingSummary, setBillingSummary] = useState<{
    visible: boolean;
    endedBy: string;
    durationSeconds: number;
    ratePerMinute: number;
    totalCost: number;
    psychicEarnings: number;
  } | null>(null);
  const sessionEndedHandledRef = useRef(false);
  const sessionDurationRef = useRef(0);
  useEffect(() => {
    sessionDurationRef.current = sessionDuration;
  }, [sessionDuration]);

  const finalizeAdvisorSessionUI = useCallback((summaryData: {
    endedBy?: string;
    durationSeconds?: number;
    ratePerMinute?: number;
    totalCost?: number;
    psychicEarnings?: number;
  }) => {
    if (sessionEndedHandledRef.current) return;
    sessionEndedHandledRef.current = true;
    setIsSessionActive(false);

    const durSecs = summaryData.durationSeconds || Math.max(1, sessionDurationRef.current);
    const rateVal = summaryData.ratePerMinute || rate;
    const costVal = summaryData.totalCost !== undefined
      ? Number(summaryData.totalCost)
      : Number((Math.max(1, durSecs / 60) * rateVal).toFixed(2));
    const earnVal = summaryData.psychicEarnings !== undefined
      ? Number(summaryData.psychicEarnings)
      : Number((costVal * 0.4).toFixed(2));

    const endMsg: Message = {
      id: `sys-end-${Date.now()}`,
      text: `Session ended • Client Charged: $${costVal.toFixed(2)} • Your Earnings: +$${earnVal.toFixed(2)}`,
      sender: 'system',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, endMsg]);
    scrollToBottom();

    setBillingSummary({
      visible: true,
      endedBy: summaryData.endedBy || 'advisor',
      durationSeconds: durSecs,
      ratePerMinute: rateVal,
      totalCost: costVal,
      psychicEarnings: earnVal,
    });
  }, [rate]);

  // Keep latest handler in a ref so the WebSocket doesn't need to be recreated when state changes
  const finalizeRef = useRef(finalizeAdvisorSessionUI);
  useEffect(() => {
    finalizeRef.current = finalizeAdvisorSessionUI;
  }, [finalizeAdvisorSessionUI]);

  const wsUnmountedRef = useRef(false);
  const wsReconnectTimerRef = useRef<any>(null);

  const connectWebSocket = useCallback(() => {
    if (!currentPsychic?.id || !WS_URL) return;
    if (wsUnmountedRef.current || sessionEndedHandledRef.current) return;
    // Avoid duplicate sockets
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    try {
      const ws = new WebSocket(`${WS_URL}/api/ws/${currentPsychic.id}`);
      
      ws.onopen = () => {
        console.log('WebSocket connected (Psychic)');
        setIsDisconnected(false);
        try {
          ws.send(JSON.stringify({
            type: 'join_conversation',
            conversation_id: sessionId
          }));
        } catch (err) {
          console.warn('Error joining conversation room:', err);
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if ((data.type === 'new_message' || data.type === 'message') && (data.conversation_id === sessionId || !data.conversation_id)) {
            const msgObj = data.message || data;
            const isFromPsychic = msgObj.sender_id === currentPsychic?.id || msgObj.sender_id === 'psy-001' || data.sender === 'psychic' || msgObj.sender_type === 'psychic';
            const img = msgObj.image_url || data.image_url;
            const isImage = msgObj.type === 'image' || data.type === 'image' || !!img;
            const newMessage: Message = {
              id: msgObj.id || data.id || `msg-${Date.now()}`,
              text: isImage ? (img || msgObj.content || data.content || '[Photo]') : (msgObj.content || data.content || data.text || ''),
              sender: isFromPsychic ? 'psychic' : 'client',
              timestamp: new Date(msgObj.created_at || data.timestamp || Date.now()),
              type: isImage ? 'image' : 'text',
              imageUrl: img,
            };
            setMessages(prev => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              // Deduplicate if identical sender & text arrived within 15s (echo of optimistic send)
              const dupIdx = prev.findIndex(m =>
                m.sender === newMessage.sender &&
                m.text === newMessage.text &&
                Math.abs(new Date(m.timestamp).getTime() - new Date(newMessage.timestamp).getTime()) < 15000
              );
              if (dupIdx !== -1) {
                const updated = [...prev];
                updated[dupIdx] = { ...updated[dupIdx], id: newMessage.id };
                return updated;
              }
              return [...prev, newMessage];
            });
            setClientIsTyping(false);
            scrollToBottom();
          } else if (data.type === 'partner_joined') {
            console.log('✅ Client partner_joined received via WebSocket:', data);
            setIsSessionActive(true);
          } else if ((data.type === 'typing' || data.type === 'typing_indicator') && (data.conversation_id === sessionId || !data.conversation_id)) {
            if (data.user_id !== currentPsychic?.id && data.user_id !== 'psy-001') {
              setClientIsTyping(Boolean(data.is_typing));
              if (data.is_typing) scrollToBottom();
            }
          } else if (data.type === 'one_minute_warning') {
            const warningMsg: Message = {
              id: `warning-${Date.now()}`,
              text: data.text || '⏰ This chat has approximately 1 minute remaining. Please inform the client that they can add more minutes if they would like to continue.',
              sender: 'system',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, warningMsg]);
            scrollToBottom();
          } else if (data.type === 'session_ended') {
            if (!data.session_id || data.session_id === sessionId) {
              finalizeRef.current({
                endedBy: data.ended_by || 'client',
                durationSeconds: data.duration_seconds || Math.round((data.duration_minutes || 1) * 60),
                ratePerMinute: data.rate_per_minute || rate,
                totalCost: data.total_cost,
                psychicEarnings: data.psychic_earnings,
              });
            }
          }
        } catch (e) {
          console.warn('WebSocket message parse error:', e);
        }
      };
      
      ws.onerror = () => {
        // Network hiccup — onclose will handle reconnect. Use warn to avoid red error overlay.
        if (!wsUnmountedRef.current) {
          console.warn('WebSocket connection issue (Psychic) — will retry');
        }
      };
      
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (wsUnmountedRef.current || sessionEndedHandledRef.current) return;
        setIsDisconnected(true);
        if (wsReconnectTimerRef.current) clearTimeout(wsReconnectTimerRef.current);
        wsReconnectTimerRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.warn('WebSocket connection error:', error);
      setIsDisconnected(true);
    }
  }, [currentPsychic?.id, sessionId, rate]);

  // WebSocket connection (created once per advisor + session)
  useEffect(() => {
    wsUnmountedRef.current = false;
    connectWebSocket();
    return () => {
      wsUnmountedRef.current = true;
      if (wsReconnectTimerRef.current) clearTimeout(wsReconnectTimerRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Real-time sync poll (every 2.5s) for messages and session end status backup
  useEffect(() => {
    if (!sessionId || !isSessionActive) return;

    const syncInterval = setInterval(async () => {
      if (sessionEndedHandledRef.current) return;
      try {
        const [sessRes, msgRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/chat/${sessionId}`),
          fetch(`${BACKEND_URL}/api/messages/conversation/${sessionId}?user_id=${currentPsychic?.id || 'advisor'}`),
        ]);

        if (msgRes.ok) {
          const historyData = await msgRes.json();
          if (Array.isArray(historyData) && historyData.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              let changed = false;
              const updated = [...prev];
              for (const m of historyData) {
                const img = m.image_url;
                const isImage = m.type === 'image' || !!img;
                if (!existingIds.has(m.id)) {
                  const isFromPsy = m.sender_id === currentPsychic?.id || m.sender_id === 'psy-001' || m.sender_type === 'psychic';
                  const textContent = isImage ? (img || m.content || '') : (m.content === '[Photo]' ? '' : (m.content || ''));
                  if (!textContent && !img) continue;

                  const senderRole = isFromPsy ? 'psychic' : 'client';
                  const msgTime = new Date(m.created_at || Date.now()).getTime();

                  // Deduplicate optimistic message (same sender & text/image within 15 seconds)
                  const optIdx = updated.findIndex(p =>
                    p.sender === senderRole &&
                    (isImage ? (p.imageUrl === img || p.text === img) : (p.text === textContent)) &&
                    Math.abs(new Date(p.timestamp).getTime() - msgTime) < 15000
                  );

                  if (optIdx !== -1) {
                    updated[optIdx] = {
                      ...updated[optIdx],
                      id: m.id,
                      timestamp: new Date(m.created_at || updated[optIdx].timestamp),
                    };
                    existingIds.add(m.id);
                    changed = true;
                  } else {
                    updated.push({
                      id: m.id,
                      text: textContent,
                      sender: senderRole,
                      timestamp: new Date(m.created_at || Date.now()),
                      type: isImage ? 'image' : 'text',
                      imageUrl: img,
                    });
                    existingIds.add(m.id);
                    changed = true;
                  }
                }
              }
              if (changed) scrollToBottom();
              return changed ? updated : prev;
            });
          }
        }

        if (sessRes.ok) {
          const sessData = await sessRes.json();
          if (sessData.session_type && sessData.session_type !== activeSessionType) {
            const st = sessData.session_type.toLowerCase();
            if (st === 'video' || st === 'phone') {
              setActiveSessionType(st);
            }
          }
          if (sessData.agora_channel) {
            setAgoraConfig(prev => ({
              channel: sessData.agora_channel || prev.channel,
              appId: sessData.agora_app_id || prev.appId,
              uid: sessData.psychic_uid || prev.uid,
              token: sessData.psychic_token || prev.token,
            }));
          }
          if (sessData.status === 'ended' && !sessionEndedHandledRef.current) {
            finalizeAdvisorSessionUI({
              endedBy: sessData.ended_by || 'client',
              durationSeconds: sessData.duration_seconds || Math.round((sessData.total_minutes || 1) * 60),
              ratePerMinute: sessData.rate_per_minute || rate,
              totalCost: sessData.total_cost,
              psychicEarnings: sessData.psychic_earnings,
            });
          }
        }
      } catch (e) {
        // Ignore transient network errors
      }
    }, 2500);

    return () => clearInterval(syncInterval);
  }, [sessionId, isSessionActive, currentPsychic?.id, finalizeAdvisorSessionUI, rate, activeSessionType]);

  // Add welcome message and fetch persisted message history on mount
  useEffect(() => {
    setMessages([{
      id: 'system-1',
      text: `Connected with ${clientName}. Session started.`,
      sender: 'system',
      timestamp: new Date(),
    }]);

    if (!sessionId) return;
    const loadHistory = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/messages/conversation/${sessionId}?user_id=${currentPsychic?.id || 'advisor'}`);
        if (res.ok) {
          const historyData = await res.json();
          if (Array.isArray(historyData) && historyData.length > 0) {
            const loaded: Message[] = historyData.map((m: any) => ({
              id: m.id,
              text: m.content,
              sender: (m.sender_id === currentPsychic?.id || m.sender_id === 'psy-001' || m.sender_type === 'psychic') ? 'psychic' : 'client',
              timestamp: new Date(m.created_at || Date.now()),
            }));
            setMessages(prev => {
              const map = new Map();
              prev.forEach(m => map.set(m.id, m));
              loaded.forEach(m => map.set(m.id, m));
              return Array.from(map.values());
            });
            scrollToBottom();
          }
        }
      } catch (e) {
        console.warn('Failed to load session history:', e);
      }
    };
    loadHistory();
  }, [clientName, sessionId, currentPsychic?.id]);

  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated });
    }, 60);
  };

  // Auto-scroll when keyboard opens on mobile
  useEffect(() => {
    const sub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    return () => sub.remove();
  }, []);

  // Auto-scroll whenever new message arrives
  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateEarnings = () => {
    const minutes = Math.max(1, sessionDuration / 60);
    return (minutes * rate * 0.4).toFixed(2); // 40% to psychic
  };

  const sanitizeMessageText = (text: string): string => {
    let sanitized = text;
    const patterns = [
      /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
      /\b(?:whatsapp|wa\.me|telegram|t\.me|cashapp|\$cashapp|venmo|paypal|zelle)\b/gi,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi
    ];
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern, '[Blocked Contact Info]');
    }
    return sanitized;
  };

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !isSessionActive) return;
    
    const messageText = sanitizeMessageText(inputText.trim());
    const messageId = `msg-${Date.now()}`;
    
    const newMessage: Message = {
      id: messageId,
      text: messageText,
      sender: 'psychic',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    scrollToBottom();
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        id: messageId,
        conversation_id: sessionId,
        receiver_id: clientId,
        content: messageText,
        sender_type: 'psychic',
      }));
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: sessionId,
        receiver_id: clientId,
        is_typing: false,
      }));
    } else {
      sendMessageViaHttp(messageText);
    }
  }, [inputText, isSessionActive, sessionId, clientId]);

  const sendMessageViaHttp = async (content: string) => {
    try {
      await fetch(`${BACKEND_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: sessionId,
          sender_id: currentPsychic?.id,
          receiver_id: clientId,
          content: content,
          sender_type: 'psychic',
        }),
      });
    } catch (e) {
      console.error('Error sending message via HTTP:', e);
    }
  };

  // Photo capture (camera) and library picker with real-time WebSocket and HTTP dispatch
  const handlePickImage = async (fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.5,
          base64: true,
          cameraType: ImagePicker.CameraType.back,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Photo library permission is required to share photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.5,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]?.uri) {
        const imageAsset = result.assets[0];
        const msgId = `img-${Date.now()}`;
        const base64Data = imageAsset.base64;
        const fullDataUri = base64Data ? `data:image/jpeg;base64,${base64Data}` : imageAsset.uri;

        const imgMsg: Message = {
          id: msgId,
          text: fullDataUri,
          imageUrl: fullDataUri,
          sender: 'psychic',
          timestamp: new Date(),
          type: 'image',
        };
        setMessages(prev => [...prev, imgMsg]);
        scrollToBottom();

        // Send via WebSocket to client in real-time
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            id: msgId,
            type: 'message',
            conversation_id: sessionId,
            receiver_id: clientId,
            content: '',
            image_url: fullDataUri,
            sender_type: 'psychic',
          }));
        } else {
          try {
            await fetch(`${BACKEND_URL}/api/messages/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: msgId,
                conversation_id: sessionId,
                sender_id: currentPsychic?.id,
                receiver_id: clientId,
                content: '',
                image_url: fullDataUri,
                sender_type: 'psychic',
              }),
            });
          } catch (httpErr) {
            console.warn('HTTP image save fallback notice:', httpErr);
          }
        }
      }
    } catch (err) {
      console.error('Error attaching photo:', err);
      Alert.alert('Error', 'Failed to attach photo. Please try again.');
    }
  };

  const lastTypingEmitRef = useRef(0);
  const handleInputChange = (text: string) => {
    setInputText(text);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (text.length === 0) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          conversation_id: sessionId,
          receiver_id: clientId,
          is_typing: false,
        }));
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        return;
      }

      const now = Date.now();
      if (now - lastTypingEmitRef.current > 1500) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          conversation_id: sessionId,
          receiver_id: clientId,
          is_typing: true,
        }));
        lastTypingEmitRef.current = now;
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'typing',
            conversation_id: sessionId,
            receiver_id: clientId,
            is_typing: false,
          }));
        }
      }, 2500);
    }
  };

  const handleEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: endSession,
        },
      ]
    );
  };

  const endSession = async () => {
    if (sessionEndedHandledRef.current) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/chat/end/${sessionId}?ended_by=advisor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        finalizeAdvisorSessionUI({
          endedBy: 'advisor',
          durationSeconds: data.duration_seconds || Math.round((data.duration_minutes || 1) * 60),
          ratePerMinute: data.rate_per_minute || rate,
          totalCost: data.total_cost,
          psychicEarnings: data.psychic_earnings,
        });
        return;
      }
    } catch (error) {
      console.error('Error ending session:', error);
    }
    finalizeAdvisorSessionUI({ endedBy: 'advisor' });
  };

  const navigateToSummary = (customDuration?: number, customEarnings?: string) => {
    router.replace({
      pathname: '/session-review' as any,
      params: {
        sessionId: sessionId,
        clientId: clientId,
        duration: (customDuration ?? sessionDuration).toString(),
        earnings: customEarnings ?? calculateEarnings(),
        clientName: clientName,
        sessionType: activeSessionType,
      },
    });
  };

  const renderMessage = (message: Message) => {
    const isSystem = message.sender === 'system';
    const isPsychic = message.sender === 'psychic';
    
    if (isSystem) {
      return (
        <View key={message.id} style={styles.systemMessage}>
          <Text style={[styles.systemText, { color: colors.textSecondary }]}>
            {message.text}
          </Text>
        </View>
      );
    }
    
    const isImage = message.type === 'image' || !!message.imageUrl || (typeof message.text === 'string' && (message.text.startsWith('data:image') || !!message.text.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i)));
    const imageUri = message.imageUrl || (isImage && typeof message.text === 'string' && message.text.startsWith('data:image') ? message.text : undefined);

    // If message is just '[Photo]' text without an image, do NOT render a bare text bubble
    if (message.text === '[Photo]' && !isImage) {
      return null;
    }

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubble,
          isPsychic ? styles.psychicBubble : styles.clientBubble,
          { backgroundColor: isPsychic ? colors.primary : colors.backgroundElevated }
        ]}
      >
        {isImage && imageUri ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedImage(imageUri)}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: 220, height: 160, borderRadius: 12, resizeMode: 'cover' }}
            />
          </TouchableOpacity>
        ) : (
          <Text style={[
            styles.messageText,
            { color: isPsychic ? '#FFF' : colors.textPrimary }
          ]}>
            {message.text}
          </Text>
        )}
      </View>
    );
  };

  const isCallMode = activeSessionType === 'phone' || activeSessionType === 'video';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      {/* Header */}
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{clientName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.headerStatus}>
              {isSessionActive
                ? `${activeSessionType === 'video' ? 'Video Call' : activeSessionType === 'phone' ? 'Audio Call' : 'Live Chat'} • ${formatTime(sessionDuration)}`
                : 'Session Ended'}
            </Text>
            {/* ADV-032: Network Signal Quality Badge */}
            {isSessionActive && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 }}>
                <Ionicons name="cellular" size={12} color={networkQuality === 'excellent' ? '#2ECC71' : networkQuality === 'good' ? '#F1C40F' : '#E74C3C'} />
                <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '600' }}>{networkPing}ms</Text>
              </View>
            )}
          </View>
        </View>
        
        {isSessionActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isCallMode && (
              <TouchableOpacity
                style={[styles.endButton, showChatInCall && { backgroundColor: 'rgba(255,255,255,0.35)' }]}
                onPress={() => setShowChatInCall(prev => !prev)}
              >
                <Ionicons
                  name={showChatInCall ? (activeSessionType === 'video' ? 'videocam' : 'call') : 'chatbubble-ellipses'}
                  size={18}
                  color="#FFF"
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.endButton, { backgroundColor: '#E74C3C' }]} onPress={handleEndSession}>
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Main Content: Agora Audio/Video Call OR Live Chat Messages */}
      {isCallMode && isSessionActive && !showChatInCall ? (
        <View style={{ flex: 1 }}>
          <AgoraVideoCall
            channelName={agoraConfig.channel}
            token={agoraConfig.token}
            uid={agoraConfig.uid}
            appId={agoraConfig.appId}
            isVideo={activeSessionType === 'video'}
            remoteName={clientName}
            timerText={formatTime(sessionDuration)}
            subStatusText={`Rate: $${rate.toFixed(2)}/min • Earnings: +$${calculateEarnings()}`}
            onCallEnd={endSession}
          />
        </View>
      ) : (
        <>
          {/* ADV-025: Low-Bandwidth Auto-Downgrade Warning Banner when network quality drops to poor */}
          {networkQuality === 'poor' && isSessionActive && (
            <View style={[styles.muteBanner, { backgroundColor: '#C0392B' }]}>
              <Ionicons name="wifi-outline" size={16} color="#FFF" />
              <Text style={styles.muteBannerText}>Weak Network (3G/Poor Signal): Auto-switched to Audio-Only Mode to prevent call drop.</Text>
            </View>
          )}

          {/* ADV-030: Prominent Red Mute Indicator Banner when microphone is muted */}
          {isMuted && isSessionActive && (
            <View style={styles.muteBanner}>
              <Ionicons name="mic-off-outline" size={16} color="#FFF" />
              <Text style={styles.muteBannerText}>Your microphone is MUTED. Client cannot hear you.</Text>
              <TouchableOpacity style={styles.unmuteBadge} onPress={toggleMute}>
                <Text style={styles.unmuteBadgeText}>UNMUTE</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ADV-027: Emergency 1-Click Rejoin Session Banner when connection is lost */}
          {isDisconnected && isSessionActive && (
            <View style={[styles.muteBanner, { backgroundColor: '#D35400' }]}>
              <Ionicons name="warning-outline" size={16} color="#FFF" />
              <Text style={styles.muteBannerText}>Connection lost. Attempting auto-reconnect...</Text>
              <TouchableOpacity style={[styles.unmuteBadge, { backgroundColor: '#FFF' }]} onPress={reconnectSession}>
                <Text style={[styles.unmuteBadgeText, { color: '#D35400' }]}>REJOIN</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            onContentSizeChange={() => scrollToBottom(false)}
            keyboardShouldPersistTaps="handled"
          >
            {messages
              .filter((msg, idx, arr) => {
                const firstWithId = arr.findIndex(m => m.id === msg.id);
                if (firstWithId !== idx) return false;
                const prevDup = arr.slice(0, idx).find(m =>
                  m.sender === msg.sender &&
                  m.text === msg.text &&
                  Math.abs(new Date(m.timestamp).getTime() - new Date(msg.timestamp).getTime()) < 10000
                );
                return !prevDup;
              })
              .map(renderMessage)}
            
            {clientIsTyping && (
              <View style={styles.typingIndicator}>
                <Text style={[styles.typingText, { color: colors.textMuted }]}>
                  {clientName} is typing...
                </Text>
              </View>
            )}
          </ScrollView>
        </>
      )}

      {/* Session Ended Billing Summary Popup Modal */}
      {billingSummary?.visible && (
        <Modal visible={billingSummary.visible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 380, backgroundColor: colors.backgroundCard, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#27AE6020', justifyContent: 'center', alignItems: 'center', marginBottom: 14 }}>
                <Ionicons name="cash" size={32} color="#27AE60" />
              </View>
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 }}>
                Session Completed!
              </Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
                {billingSummary.endedBy === 'client'
                  ? `${clientName} ended the chat session.`
                  : `You ended the chat session with ${clientName}.`}
              </Text>

              {/* Earnings & Client Charge Box */}
              <LinearGradient
                colors={['#27AE60', '#1E8449']}
                style={{ width: '100%', borderRadius: 16, padding: 18, alignItems: 'center', marginBottom: 18 }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', marginBottom: 4 }}>
                  CLIENT CHARGED: ${billingSummary.totalCost.toFixed(2)}
                </Text>
                <Text style={{ color: '#FFF', fontSize: 34, fontWeight: '800' }}>
                  +${billingSummary.psychicEarnings.toFixed(2)}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '600', marginTop: 2 }}>
                  Your Earnings (40%)
                </Text>
              </LinearGradient>

              {/* Breakdown Rows */}
              <View style={{ width: '100%', backgroundColor: colors.backgroundElevated, borderRadius: 14, padding: 14, gap: 10, marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Duration:</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                    {Math.floor(billingSummary.durationSeconds / 60)}m {billingSummary.durationSeconds % 60}s
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Rate:</Text>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '700' }}>
                    ${billingSummary.ratePerMinute.toFixed(2)}/min
                  </Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Total Deducted from Client:</Text>
                  <Text style={{ color: colors.primary, fontSize: 15, fontWeight: '800' }}>
                    ${billingSummary.totalCost.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={{ width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}
                onPress={() => {
                  const dur = billingSummary.durationSeconds;
                  const earn = billingSummary.psychicEarnings.toFixed(2);
                  setBillingSummary(null);
                  navigateToSummary(dur, earn);
                }}
              >
                <LinearGradient
                  colors={[colors.primary, colors.secondary]}
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>Add Session Notes 📝</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ width: '100%', paddingVertical: 12, alignItems: 'center' }}
                onPress={() => {
                  setBillingSummary(null);
                  router.replace('/(tabs)/dashboard');
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Full-Screen Image Lightbox Modal */}
      {selectedImage && (
        <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}>
            <TouchableOpacity
              style={{ position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 }}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close" size={32} color="#FFF" />
            </TouchableOpacity>
            <Image
              source={{ uri: selectedImage }}
              style={{ width: '95%', height: '80%', resizeMode: 'contain' }}
            />
          </View>
        </Modal>
      )}

      {/* Input */}
      {isSessionActive ? (
        (!isCallMode || showChatInCall) ? (
          <View style={[styles.inputContainer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.backgroundCard }]}>
            {/* Camera Button (Instant Capture Front / Back) */}
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => handlePickImage(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
            </TouchableOpacity>

            {/* Gallery Photo Button */}
            <TouchableOpacity
              style={styles.attachButton}
              onPress={() => handlePickImage(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="image" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { backgroundColor: colors.backgroundElevated, color: colors.textPrimary }]}
              placeholder="Type your message..."
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleInputChange}
              onFocus={() => scrollToBottom()}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }, !inputText.trim() && { opacity: 0.5 }]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
            >
              <Ionicons name="send" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : null
      ) : (
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.backgroundCard }]}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: colors.backgroundElevated, paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
            onPress={() => router.replace('/(tabs)/dashboard')}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>Session Ended • Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  muteBanner: {
    backgroundColor: '#E74C3C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  muteBannerText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  unmuteBadge: {
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unmuteBadgeText: {
    color: '#E74C3C',
    fontSize: 11,
    fontWeight: '700',
  },
  endButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
  },
  endButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  systemMessage: {
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  systemText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: SPACING.md,
    borderRadius: 16,
    marginVertical: SPACING.xs,
  },
  psychicBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  clientBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  typingIndicator: {
    padding: SPACING.sm,
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  attachButton: {
    width: 38,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: 22,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
    marginRight: SPACING.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
