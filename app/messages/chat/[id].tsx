import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { SPACING } from '../../../src/constants/theme';
import { useAuth } from '../../../src/context/AuthContext';
import { useTheme } from '../../../src/context/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const WS_URL = BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_type: string;
  receiver_id: string;
  receiver_type: string;
  content: string;
  image_url?: string;
  audio_url?: string;
  audio_duration?: number;
  is_read: boolean;
  created_at: string;
}

// ADV-037: Voice Note Player Component with Scrubbable Progress Bar & 1.5x Speed Toggle
const VoiceNotePlayer = ({ audioUrl, duration = 15, isOwn, colors }: { audioUrl?: string; duration?: number; isOwn: boolean; colors: any }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    setIsPlaying(prev => !prev);
    if (!isPlaying) {
      setProgress(0.25);
    }
  };

  const toggleSpeed = () => {
    setPlaybackSpeed(prev => (prev === 1.0 ? 1.5 : prev === 1.5 ? 2.0 : 1.0));
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, width: 210 }}>
      <TouchableOpacity onPress={togglePlay} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isOwn ? 'rgba(255,255,255,0.25)' : colors.primary, justifyContent: 'center', alignItems: 'center' }}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="#FFF" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{ height: 4, backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : colors.border, borderRadius: 2, overflow: 'hidden' }}>
          <View style={{ width: `${isPlaying ? 65 : 0}%`, height: '100%', backgroundColor: isOwn ? '#FFF' : colors.primary }} />
        </View>
        <Text style={{ fontSize: 10, color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textMuted, marginTop: 4 }}>
          {isPlaying ? '0:08' : `0:${String(duration).padStart(2, '0')}`}
        </Text>
      </View>
      <TouchableOpacity onPress={toggleSpeed} style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : colors.backgroundElevated, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
        <Text style={{ color: isOwn ? '#FFF' : colors.textPrimary, fontSize: 11, fontWeight: '700' }}>{playbackSpeed}x</Text>
      </TouchableOpacity>
    </View>
  );
};

// Typing Indicator Component
const TypingIndicator = ({ name, colors }: { name: string; colors: any }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dot1, 0);
    animateDot(dot2, 150);
    animateDot(dot3, 300);
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={[styles.typingBubble, { backgroundColor: colors.backgroundCard }]}>
        <View style={styles.typingDots}>
          <Animated.View
            style={[
              styles.typingDot,
              { backgroundColor: colors.primary },
              { transform: [{ translateY: dot1.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.typingDot,
              { backgroundColor: colors.primary },
              { transform: [{ translateY: dot2.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
            ]}
          />
          <Animated.View
            style={[
              styles.typingDot,
              { backgroundColor: colors.primary },
              { transform: [{ translateY: dot3.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
            ]}
          />
        </View>
      </View>
      <Text style={[styles.typingText, { color: colors.textMuted }]}>{name} is typing...</Text>
    </View>
  );
};

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id: string;
    psychicId?: string;
    psychicName?: string;
    clientId?: string;
    clientName?: string;
    rate?: string;
  }>();
  
  // Support both parameter naming conventions
  const id = params.id;
  const recipientId = params.clientId || params.psychicId || 'unknown';
  const recipientName = params.clientName || params.psychicName || 'User';
  const rate = params.rate;
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const { colors } = useTheme();
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(5);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // ADV-040: New message auto-scroll and floating scroll badge state
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);

  const scrollToBottom = () => {
    setHasUnreadBelow(false);
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const userId = user?.id || 'mock-user-123';
  const timezoneOffset = new Date().getTimezoneOffset();

  // WebSocket connection for real-time typing indicators
  useEffect(() => {
    if (!id || !userId) return;

    const connectWebSocket = () => {
      try {
        // Connect using just the user ID - backend routes messages by user
        const ws = new WebSocket(`${WS_URL}/api/ws/${userId}`);
        
        ws.onopen = () => {
          console.log('WebSocket connected for typing indicators');
          // Join the conversation
          ws.send(JSON.stringify({
            type: 'join_conversation',
            conversation_id: id
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'typing_indicator' && data.user_id !== recipientId) {
              setIsOtherTyping(data.is_typing);
              
              // Auto-hide typing indicator after 3 seconds of no updates
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              if (data.is_typing) {
                typingTimeoutRef.current = setTimeout(() => {
                  setIsOtherTyping(false);
                }, 3000);
              }
            } else if (data.type === 'new_message' && data.message) {
              const newMsg = data.message;
              if (newMsg.sender_id !== recipientId) {
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, newMsg];
                });
                
                // ADV-040: Show badge if scrolled up, else auto-scroll
                if (isScrolledUp) {
                  setHasUnreadBelow(true);
                } else {
                  setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: true });
                  }, 100);
                }
              }
            }
          } catch (e) {
            console.log('WebSocket message parse error:', e);
          }
        };

        ws.onerror = (error) => {
          console.log('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket closed');
        };

        wsRef.current = ws;
      } catch (error) {
        console.log('WebSocket connection error:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [id, userId]);

  // Send typing indicator
  const sendTypingIndicator = (isTyping: boolean) => {
    const now = Date.now();
    // Throttle typing events to once per second
    if (isTyping && now - lastTypingSent < 1000) return;
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing',
        is_typing: isTyping,
      }));
      setLastTypingSent(now);
    }
  };

  // ADV-041: Load saved draft message on screen mount
  useEffect(() => {
    if (!id) return;
    AsyncStorage.getItem(`chat_draft_${id}`).then(draft => {
      if (draft) setNewMessage(draft);
    }).catch(() => null);
  }, [id]);

  // Handle text input change with typing indicator and ADV-041 draft auto-save
  const handleTextChange = (text: string) => {
    setNewMessage(text);
    AsyncStorage.setItem(`chat_draft_${id}`, text).catch(() => null);
    if (text.length > 0) {
      sendTypingIndicator(true);
    } else {
      sendTypingIndicator(false);
    }
  };

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/messages/conversation/${id}?user_id=${userId}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, userId]);

  const fetchRemainingMessages = useCallback(async () => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/messages/remaining/${userId}?user_type=psychic&other_user_id=${recipientId}&timezone_offset=${timezoneOffset}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setRemainingMessages(data.remaining);
      }
    } catch (error) {
      console.error('Failed to fetch remaining messages:', error);
    }
  }, [userId, recipientId, timezoneOffset]);

  useEffect(() => {
    fetchMessages();
    fetchRemainingMessages();
    
    // Poll for new messages every 10 seconds
    const interval = setInterval(() => {
      fetchMessages();
      fetchRemainingMessages();
    }, 10000);
    
    return () => clearInterval(interval);
  }, [fetchMessages, fetchRemainingMessages]);

  const pickImage = async (fromCamera: boolean) => {
    setShowImageOptions(false);
    
    try {
      let result;
      
      if (fromCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.6,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Photo library permission is needed to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.6,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // ADV-033: Offline message queue auto-flush when connection recovers
  const flushPendingQueue = useCallback(async () => {
    try {
      const queueRaw = await AsyncStorage.getItem(`pending_messages_${id}`);
      if (!queueRaw) return;
      const pending: Message[] = JSON.parse(queueRaw);
      if (!pending || pending.length === 0) return;

      const remainingQueue: Message[] = [];
      for (const msg of pending) {
        try {
          const res = await fetch(
            `${BACKEND_URL}/api/messages/send?sender_id=${userId}&sender_type=psychic&timezone_offset=${timezoneOffset}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                receiver_id: recipientId,
                content: msg.content.replace(' 🕒 (Queued)', ''),
                image_url: msg.image_url,
              }),
            }
          );
          if (!res.ok) remainingQueue.push(msg);
        } catch (e) {
          remainingQueue.push(msg);
        }
      }

      await AsyncStorage.setItem(`pending_messages_${id}`, JSON.stringify(remainingQueue));
      if (remainingQueue.length < pending.length) {
        fetchMessages();
      }
    } catch (err) {
      console.error('Queue flush error:', err);
    }
  }, [id, userId, recipientId, timezoneOffset, fetchMessages]);

// ADV-038: Off-platform contact sharing and prohibited URL/number blocker
const sanitizeMessageContent = (text: string): { sanitized: string; blocked: boolean } => {
  let sanitized = text;
  let blocked = false;
  const patterns = [
    /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/gi,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
    /\b(?:https?:\/\/)?(?:www\.)?(?:instagram\.com|facebook\.com|wa\.me|t\.me|telegram|whatsapp|cash\.app|venmo|paypal\.me)[^\s]*/gi,
  ];

  for (const pattern of patterns) {
    if (pattern.test(sanitized)) {
      blocked = true;
      sanitized = sanitized.replace(pattern, '[Blocked Contact Info]');
    }
  }
  return { sanitized, blocked };
};

  const sendMessage = async (imageUrl?: string) => {
    if ((!newMessage.trim() && !imageUrl) || isSending) return;
    
    if (remainingMessages <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        'You have used all 5 messages for today. The limit resets at midnight.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Stop typing indicator when sending
    sendTypingIndicator(false);
    
    setIsSending(true);
    let contentToSend = imageUrl ? '📷 Image' : newMessage.trim();
    
    // ADV-038: Filter off-platform links/numbers before sending
    if (!imageUrl) {
      const { sanitized, blocked } = sanitizeMessageContent(contentToSend);
      if (blocked) {
        Alert.alert(
          'Platform Policy Warning',
          'Sharing off-platform phone numbers, emails, or external links is prohibited. Filtered text with [Blocked Contact Info].'
        );
      }
      contentToSend = sanitized;
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/messages/send?sender_id=${userId}&sender_type=psychic&timezone_offset=${timezoneOffset}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            receiver_id: recipientId,
            content: contentToSend,
            image_url: imageUrl || undefined,
          }),
        }
      );
      
      if (response.ok) {
        const sentMessage = await response.json();
        setMessages(prev => [...prev, sentMessage]);
        setNewMessage('');
        setSelectedImage(null);
        setRemainingMessages(prev => Math.max(0, prev - 1));
        
        // ADV-041: Clear draft after successful send
        AsyncStorage.removeItem(`chat_draft_${id}`).catch(() => null);

        // Flush any remaining queued messages if HTTP succeeds
        flushPendingQueue();

        // Scroll to bottom
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        throw new Error('HTTP send error');
      }
    } catch (error) {
      // ADV-033: Save to offline retry queue instead of losing typed text
      const tempId = `pending-${Date.now()}`;
      const pendingMsg: Message = {
        id: tempId,
        conversation_id: id || '',
        sender_id: userId,
        sender_type: 'psychic',
        receiver_id: recipientId,
        receiver_type: 'client',
        content: contentToSend + ' 🕒 (Queued)',
        image_url: imageUrl,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, pendingMsg]);
      setNewMessage('');
      
      const existingQueueRaw = await AsyncStorage.getItem(`pending_messages_${id}`).catch(() => null);
      const existingQueue = existingQueueRaw ? JSON.parse(existingQueueRaw) : [];
      existingQueue.push(pendingMsg);
      await AsyncStorage.setItem(`pending_messages_${id}`, JSON.stringify(existingQueue)).catch(() => null);

      Alert.alert('Offline Mode', 'Network issue detected. Message queued and will auto-send when connection recovers.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendImage = () => {
    if (selectedImage) {
      sendMessage(selectedImage);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwnMessage = item.sender_type === 'psychic';
    const showDateHeader = index === 0 || 
      new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();
    
    return (
      <View>
        {showDateHeader && (
          <View style={[styles.dateHeader, { backgroundColor: colors.backgroundElevated }]}>
            <Text style={[styles.dateHeaderText, { color: colors.textSecondary }]}>{formatDateHeader(item.created_at)}</Text>
          </View>
        )}
        <View style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
        ]}>
          <View style={[
            styles.messageBubble,
            isOwnMessage 
              ? [styles.ownMessageBubble, { backgroundColor: colors.primary }] 
              : [styles.otherMessageBubble, { backgroundColor: colors.backgroundCard }]
          ]}>
            {item.image_url && (
              <TouchableOpacity onPress={() => setLightboxImage(item.image_url || null)} activeOpacity={0.85}>
                <Image source={{ uri: item.image_url, cache: 'force-cache' }} style={styles.messageImage} />
              </TouchableOpacity>
            )}
            {item.audio_url && (
              <VoiceNotePlayer audioUrl={item.audio_url} duration={item.audio_duration} isOwn={isOwnMessage} colors={colors} />
            )}
            {item.content && item.content !== '📷 Image' && !item.audio_url && (
              <Text style={[
                styles.messageText,
                { color: isOwnMessage ? '#FFF' : colors.textPrimary }
              ]}>
                {item.content}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
              <Text style={[
                styles.messageTime,
                { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textMuted, marginTop: 0 }
              ]}>
                {formatTime(item.created_at)}
              </Text>
              {isOwnMessage && (
                <Ionicons
                  name={item.is_read ? 'checkmark-done' : 'checkmark'}
                  size={14}
                  color={item.is_read ? '#3498DB' : 'rgba(255,255,255,0.7)'}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  }, [messages, colors]);

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Image Options Modal */}
      <Modal
        visible={showImageOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageOptions(false)}
        >
          <View style={[styles.imageOptionsModal, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Send Photo</Text>
            
            <TouchableOpacity 
              style={[styles.imageOption, { borderBottomColor: colors.border }]}
              onPress={() => pickImage(true)}
            >
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={[styles.imageOptionText, { color: colors.textPrimary }]}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.imageOption, { borderBottomColor: colors.border }]}
              onPress={() => pickImage(false)}
            >
              <Ionicons name="images" size={24} color={colors.secondary} />
              <Text style={[styles.imageOptionText, { color: colors.textPrimary }]}>Choose from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.imageOption}
              onPress={() => setShowImageOptions(false)}
            >
              <Ionicons name="close" size={24} color={colors.error} />
              <Text style={[styles.imageOptionText, { color: colors.error }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ADV-034: Full-Screen Image Lightbox Viewer Modal */}
      <Modal
        visible={!!lightboxImage}
        transparent
        animationType="fade"
        onRequestClose={() => setLightboxImage(null)}
      >
        <TouchableOpacity
          style={[styles.previewOverlay, { backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }]}
          activeOpacity={1}
          onPress={() => setLightboxImage(null)}
        >
          <View style={[styles.previewHeader, { paddingTop: insets.top + 10, width: '100%', paddingHorizontal: 20, justifyContent: 'space-between' }]}>
            <TouchableOpacity onPress={() => setLightboxImage(null)}>
              <Ionicons name="close" size={30} color="#FFF" />
            </TouchableOpacity>
          </View>
          {lightboxImage && (
            <Image
              source={{ uri: lightboxImage }}
              style={{ width: '92%', height: '80%' }}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        visible={!!selectedImage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={[styles.previewOverlay, { backgroundColor: 'rgba(0,0,0,0.9)' }]}>
          <View style={[styles.previewHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => setSelectedImage(null)}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Send Photo</Text>
            <View style={{ width: 28 }} />
          </View>
          
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
          )}
          
          <View style={[styles.previewFooter, { paddingBottom: insets.bottom + SPACING.md }]}>
            <TouchableOpacity
              style={[styles.sendImageButton, { backgroundColor: colors.primary }]}
              onPress={handleSendImage}
              disabled={isSending}
            >
              {isSending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.sendImageText}>Send</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.backgroundCard, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.textPrimary }]}>{recipientName || 'Client'}</Text>
          <Text style={[styles.headerStatus, { color: colors.textSecondary }]}>
            {remainingMessages} messages left today
          </Text>
        </View>
        
        <View style={{ width: 40 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS !== 'web'}
        onScroll={(e) => {
          const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
          const isEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
          setIsScrolledUp(!isEnd);
          if (isEnd) setHasUnreadBelow(false);
        }}
        contentContainerStyle={[styles.messagesList, { paddingBottom: SPACING.md }]}
        onContentSizeChange={() => {
          if (!isScrolledUp) flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No messages yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Start the conversation!</Text>
          </View>
        }
      />

      {/* ADV-040: Floating New Message Scroll-To-Bottom Badge */}
      {hasUnreadBelow && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            bottom: 75,
            alignSelf: 'center',
            backgroundColor: colors.primary,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            zIndex: 20,
          }}
          onPress={scrollToBottom}
        >
          <Ionicons name="arrow-down" size={16} color="#FFF" />
          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}>New Message</Text>
        </TouchableOpacity>
      )}

      {/* Typing Indicator */}
      {isOtherTyping && (
        <TypingIndicator name={recipientName || 'Client'} colors={colors} />
      )}

      {/* Input Area */}
      <View style={[styles.inputArea, { backgroundColor: colors.backgroundCard, borderTopColor: colors.border, paddingBottom: insets.bottom || SPACING.md }]}>
        <TouchableOpacity 
          style={[styles.attachButton, { backgroundColor: colors.backgroundElevated }]}
          onPress={() => setShowImageOptions(true)}
        >
          <Ionicons name="camera" size={22} color={colors.primary} />
        </TouchableOpacity>
        
        <View style={{ flex: 1 }}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.backgroundElevated, color: colors.textPrimary, width: '100%' }]}
            value={newMessage}
            onChangeText={handleTextChange}
            onBlur={() => sendTypingIndicator(false)}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />
          {/* ADV-042: Live Character Counter */}
          {newMessage.length > 0 && (
            <Text style={{ fontSize: 10, color: colors.textMuted, alignSelf: 'flex-end', marginTop: 2, marginRight: 6 }}>
              {newMessage.length} / 500
            </Text>
          )}
        </View>
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: newMessage.trim() ? colors.primary : colors.backgroundElevated }
          ]}
          onPress={() => sendMessage()}
          disabled={!newMessage.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons 
              name="send" 
              size={20} 
              color={newMessage.trim() ? '#FFF' : colors.textMuted} 
            />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Typing indicator styles
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  typingBubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  typingText: {
    marginLeft: SPACING.sm,
    fontSize: 12,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  headerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    padding: SPACING.md,
  },
  dateHeader: {
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    marginVertical: SPACING.sm,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageContainer: {
    marginVertical: 4,
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: SPACING.sm,
    borderRadius: 16,
  },
  ownMessageBubble: {
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    borderBottomLeftRadius: 4,
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: SPACING.xs,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  attachButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  imageOptionsModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  imageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.md,
  },
  imageOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // Image preview
  previewOverlay: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  previewTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
  },
  previewImage: {
    flex: 1,
    width: '100%',
  },
  previewFooter: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  sendImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 25,
    gap: SPACING.sm,
  },
  sendImageText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
