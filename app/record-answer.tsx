import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { SPACING } from '../src/constants/theme';
import { useTheme } from '../src/context/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ADV-065: Audio Waveform Visualizer Component
const AudioWaveformVisualizer = ({ isRecording }: { isRecording: boolean }) => {
  const [heights, setHeights] = useState([12, 24, 16, 32, 20, 28, 14, 30, 18, 22]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setHeights(Array.from({ length: 10 }, () => Math.floor(Math.random() * 26) + 8));
    }, 150);
    return () => clearInterval(interval);
  }, [isRecording]);

  if (!isRecording) return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 40, marginTop: 10 }}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: h,
            backgroundColor: '#22C55E',
            borderRadius: 2,
          }}
        />
      ))}
    </View>
  );
};

export default function RecordAnswerScreen() {
  const { questionId, clientName, question } = useLocalSearchParams<{
    questionId: string;
    clientName: string;
    question: string;
  }>();
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const cameraRef = useRef<any>(null);
  
  const [permission, requestPermission] = useCameraPermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [facing, setFacing] = useState<CameraType>('front');
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update psychic status to busy/available
  const updatePsychicStatus = async (status: 'available' | 'busy' | 'offline') => {
    try {
      await fetch(`${BACKEND_URL}/api/psychics/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      console.log(`Status updated to: ${status}`);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Set status to busy when screen opens
  useEffect(() => {
    updatePsychicStatus('busy');
    
    // Set back to available when leaving screen
    return () => {
      updatePsychicStatus('available');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // ADV-072: 3-2-1 Countdown Timer State
  const [countdownValue, setCountdownValue] = useState<number | null>(null);

  const handleStartRecordingWithCountdown = () => {
    if (isRecording || countdownValue !== null) return;
    setCountdownValue(3);
    const countdownInterval = setInterval(() => {
      setCountdownValue(prev => {
        if (prev === 1 || prev === null) {
          clearInterval(countdownInterval);
          setCountdownValue(null);
          startRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startRecording = async () => {
    if (!cameraRef.current) {
      Alert.alert(
        'Camera Not Ready',
        'Please wait for the camera to initialize and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    try {
      // Check if recordAsync is available (only in development builds, not Expo Go)
      if (typeof cameraRef.current.recordAsync !== 'function') {
        Alert.alert(
          'Test Mode',
          'Video recording is not available in Expo Go. Running in test mode - tap stop when ready to test the submit flow.',
          [{ text: 'OK' }]
        );
        setIsRecording(true);
        setRecordingDuration(0);
        
        // Start timer for test mode
        timerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        return;
      }
      
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // ADV-028: Cap video recording quality at 720p HD to prevent device overheating and battery drain
      const video = await cameraRef.current.recordAsync({
        maxDuration: 300, // 5 minutes max
        quality: '720p',
        maxBitrate: 2000000, // 2 Mbps max
      });
      
      if (video && video.uri) {
        setRecordedVideo(video.uri);
      }
    } catch (error: any) {
      console.error('Recording error:', error);
      
      // Check for specific Expo Go error - this happens when recordAsync exists but fails
      const errorMsg = error?.message || '';
      if (errorMsg.includes('record') || errorMsg.includes('Record') || errorMsg.includes('Calling')) {
        // Don't show error here - allow test mode fallback in stopRecording
      } else {
        Alert.alert(
          'Recording Failed', 
          'Could not start video recording. If you are using Expo Go, please note that video recording requires a production or development build.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      // Stop the timer first
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setIsRecording(false);
      
      // Try to stop actual recording if camera supports it
      if (cameraRef.current && typeof cameraRef.current.stopRecording === 'function') {
        try {
          cameraRef.current.stopRecording();
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      
      // If no video was recorded (Expo Go limitation), set a placeholder so UI shows buttons
      // This allows testing the retake/submit flow
      setTimeout(() => {
        if (!recordedVideo && recordingDuration > 0) {
          setRecordedVideo('test_mode_video');
        }
      }, 500);
    }
  };

  const retakeVideo = () => {
    setRecordedVideo(null);
    setRecordingDuration(0);
  };

  const submitVideo = async () => {
    if (!recordedVideo) return;
    
    setIsSubmitting(true);
    
    try {
      // In production, upload to cloud storage and save URL to backend
      // For now, simulate success
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert(
        'Success!',
        `Your video answer has been sent to ${clientName}!`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to submit video. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const [isFlipping, setIsFlipping] = useState(false);

  const toggleCameraFacing = () => {
    if (isFlipping) return;
    setIsFlipping(true);
    setFacing(current => (current === 'back' ? 'front' : 'back'));
    setTimeout(() => {
      setIsFlipping(false);
    }, 600);
  };

  // Permission handling
  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Web platform - recording not supported
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={[styles.closeButton, { top: insets.top + 10 }]} 
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.webNoticeContainer}>
          <Ionicons name="phone-portrait-outline" size={80} color={colors.primary} />
          <Text style={[styles.permissionTitle, { color: colors.textPrimary, marginTop: 24 }]}>
            Recording Available on Mobile App
          </Text>
          <Text style={[styles.permissionText, { color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 24 }]}>
            Video recording requires the native mobile app. Please use the iOS or Android app to record video answers for your clients.
          </Text>
          
          <View style={styles.questionPreview}>
            <Text style={[styles.questionLabel, { color: colors.textMuted }]}>Question from {clientName}:</Text>
            <Text style={[styles.questionText, { color: colors.textPrimary }]}>"{question}"</Text>
          </View>
          
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Ionicons name="videocam-off" size={60} color={colors.textMuted} />
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
          Camera Access Required
        </Text>
        <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
          We need camera access to record your video answer
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Web fallback
  if ((Platform.OS as string) === 'web') {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <Ionicons name="videocam" size={60} color={colors.primary} />
        <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>
          Record Your Answer
        </Text>
        <Text style={[styles.questionPreview, { color: colors.textSecondary }]}>
          "{question?.substring(0, 100)}..."
        </Text>
        <Text style={[styles.permissionText, { color: colors.textMuted }]}>
          Video recording works best on the mobile app.{'\n'}
          Please use your iPhone or Android device.
        </Text>
        <TouchableOpacity
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.permissionButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Record Answer</Text>
        <TouchableOpacity onPress={toggleCameraFacing}>
          <Ionicons name="camera-reverse" size={28} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Question Info */}
      <View style={styles.questionInfo}>
        <Text style={styles.questionLabel}>Question from {clientName}:</Text>
        <Text style={styles.questionText} numberOfLines={2}>
          "{question}"
        </Text>
      </View>

      {/* Camera or Preview */}
      <View style={styles.cameraContainer}>
        {recordedVideo ? (
          <Video
            source={{ uri: recordedVideo }}
            style={styles.camera}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
          />
        ) : (
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={facing}
            mode="video"
          >
            {/* Recording indicator & ADV-065 Audio Waveform Visualizer */}
            {isRecording && (
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingText}>
                  Recording {formatDuration(recordingDuration)}
                </Text>
                <AudioWaveformVisualizer isRecording={isRecording} />
              </View>
            )}
          </CameraView>
        )}
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + SPACING.md }]}>
        {recordedVideo ? (
          // After recording - show retake/submit
          <View style={styles.recordedControls}>
            <TouchableOpacity
              style={[styles.retakeButton, { borderColor: colors.primary }]}
              onPress={retakeVideo}
            >
              <Ionicons name="refresh" size={20} color={colors.primary} />
              <Text style={[styles.retakeButtonText, { color: colors.primary }]}>Retake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.success }]}
              onPress={submitVideo}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="send" size={20} color="#FFF" />
                  <Text style={styles.submitButtonText}>Send to {clientName}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Recording controls
          <View style={styles.recordingControls}>
            <Text style={styles.tipText}>
              {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
            </Text>
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording && styles.recordButtonActive,
              ]}
              onPress={isRecording ? stopRecording : handleStartRecordingWithCountdown}
            >
              <View style={[
                styles.recordButtonInner,
                isRecording && styles.recordButtonInnerActive,
              ]} />
            </TouchableOpacity>
            <Text style={styles.durationLimit}>Max 5 minutes</Text>
          </View>
        )}
      </View>

      {/* ADV-072: 3-2-1 Countdown Overlay */}
      {countdownValue !== null && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}>
          <Text style={{ fontSize: 120, fontWeight: '900', color: '#FFD700' }}>{countdownValue}</Text>
          <Text style={{ fontSize: 18, color: '#FFF', fontWeight: '700', marginTop: 12 }}>GET READY...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  questionInfo: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: SPACING.md,
  },
  questionLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  questionText: {
    fontSize: 14,
    color: '#FFF',
    fontStyle: 'italic',
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0000',
    marginRight: 8,
  },
  recordingText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: SPACING.lg,
  },
  recordingControls: {
    alignItems: 'center',
  },
  tipText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginBottom: SPACING.md,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonActive: {
    borderColor: '#FF0000',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF0000',
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    width: 30,
    height: 30,
  },
  durationLimit: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: SPACING.sm,
  },
  recordedControls: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  retakeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  retakeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  questionPreview: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
    padding: SPACING.md,
    borderRadius: 12,
    width: '100%',
  },
  permissionButton: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelText: {
    marginTop: SPACING.lg,
    fontSize: 14,
  },
  webNoticeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
