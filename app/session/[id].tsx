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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING } from '../../src/constants/theme';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { Audio } from 'expo-av';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const WS_URL = BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');

interface Message {
  id: string;
  text: string;
  sender: 'client' | 'psychic' | 'system';
  timestamp: Date;
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
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sessionDuration, setSessionDuration] = useState(0);
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [clientIsTyping, setClientIsTyping] = useState(false);
  // ADV-023: Audio route switcher state (speaker, earpiece, bluetooth)
  const [audioRoute, setAudioRoute] = useState<'speaker' | 'earpiece' | 'bluetooth'>('speaker');

  const toggleAudioRoute = async () => {
    const routes: ('speaker' | 'earpiece' | 'bluetooth')[] = ['speaker', 'earpiece', 'bluetooth'];
    const nextIndex = (routes.indexOf(audioRoute) + 1) % routes.length;
    const nextRoute = routes[nextIndex];
    setAudioRoute(nextRoute);

    try {
      if (nextRoute === 'speaker') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });
      } else {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });
      }
    } catch (e) {
      console.error('Failed to change audio route:', e);
    }
  };
  
  const wsRef = useRef<WebSocket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ADV-021: Call Keep & background audio mode
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    }).catch(() => null);
  }, []);

  // Session timer & 120-min cap (ADV-025)
  useEffect(() => {
    if (!isSessionActive) return;
    
    const timer = setInterval(() => {
      setSessionDuration(prev => {
        const nextDuration = prev + 1;
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
  }, [isSessionActive]);

  // WebSocket connection
  useEffect(() => {
    if (!currentPsychic?.id) return;
    
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/api/ws/${currentPsychic.id}`);
        
        ws.onopen = () => {
          console.log('WebSocket connected (Psychic)');
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'message' && data.conversation_id === sessionId) {
              const newMessage: Message = {
                id: data.id || `msg-${Date.now()}`,
                text: data.content,
                sender: 'client',
                timestamp: new Date(data.timestamp || Date.now()),
              };
              setMessages(prev => [...prev, newMessage]);
              scrollToBottom();
            } else if (data.type === 'typing' && data.conversation_id === sessionId) {
              setClientIsTyping(data.is_typing);
            } else if (data.type === 'session_ended') {
              setIsSessionActive(false);
              Alert.alert('Session Ended', 'The client has ended the session.', [
                { text: 'OK', onPress: () => navigateToSummary() }
              ]);
            }
          } catch (e) {
            console.error('WebSocket message parse error:', e);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
          console.log('WebSocket closed, reconnecting...');
          setTimeout(connectWebSocket, 3000);
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentPsychic?.id, sessionId]);

  // Add welcome message on mount
  useEffect(() => {
    setMessages([{
      id: 'system-1',
      text: `Connected with ${clientName}. Session started.`,
      sender: 'system',
      timestamp: new Date(),
    }]);
  }, [clientName]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateEarnings = () => {
    const minutes = sessionDuration / 60;
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
    
    // Add to local state
    const newMessage: Message = {
      id: messageId,
      text: messageText,
      sender: 'psychic',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    scrollToBottom();
    
    // Send via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        conversation_id: sessionId,
        receiver_id: clientId,
        content: messageText,
      }));
    } else {
      // Fallback to HTTP
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

  const handleInputChange = (text: string) => {
    setInputText(text);
    
    // Send typing indicator
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        conversation_id: sessionId,
        receiver_id: clientId,
        is_typing: text.length > 0,
      }));
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
    try {
      await fetch(`${BACKEND_URL}/api/chat/end/${sessionId}`, {
        method: 'POST',
      });
      setIsSessionActive(false);
      navigateToSummary();
    } catch (error) {
      console.error('Error ending session:', error);
      navigateToSummary();
    }
  };

  const navigateToSummary = () => {
    router.replace({
      pathname: '/call-summary',
      params: {
        duration: sessionDuration.toString(),
        earnings: calculateEarnings(),
        clientName: clientName,
        sessionType: 'chat',
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
    
    return (
      <View
        key={message.id}
        style={[
          styles.messageBubble,
          isPsychic ? styles.psychicBubble : styles.clientBubble,
          { backgroundColor: isPsychic ? colors.primary : colors.backgroundElevated }
        ]}
      >
        <Text style={[
          styles.messageText,
          { color: isPsychic ? '#FFF' : colors.textPrimary }
        ]}>
          {message.text}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
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
          <Text style={styles.headerStatus}>
            {isSessionActive ? `Session Active • ${formatTime(sessionDuration)}` : 'Session Ended'}
          </Text>
        </View>
        
        {isSessionActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity style={styles.endButton} onPress={toggleAudioRoute}>
              <Ionicons
                name={audioRoute === 'speaker' ? 'volume-high' : audioRoute === 'bluetooth' ? 'bluetooth' : 'headset'}
                size={18}
                color="#FFF"
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.endButton} onPress={handleEndSession}>
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={scrollToBottom}
      >
        {messages.map(renderMessage)}
        
        {clientIsTyping && (
          <View style={styles.typingIndicator}>
            <Text style={[styles.typingText, { color: colors.textMuted }]}>
              {clientName} is typing...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      {isSessionActive && (
        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + SPACING.sm, backgroundColor: colors.backgroundCard }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundElevated, color: colors.textPrimary }]}
            placeholder="Type your message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={handleInputChange}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color="#FFF" />
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
