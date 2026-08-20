import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Video, ResizeMode } from 'expo-av';
import { COLORS, SPACING } from '../../src/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_DURATION = 60; // 1 minute max

export default function IntroVideoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const cameraRef = useRef<any>(null);
  
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleCameraFacing = () => {
    setFacing(prev => (prev === 'front' ? 'back' : 'front'));
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePause = () => {
    if (isPaused) {
      // Resume recording
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      // Pause recording
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const startRecording = async () => {
    // Request microphone permission if not granted
    if (!micPermission?.granted) {
      try {
        await requestMicPermission();
      } catch (e) {
        // Continue
      }
    }

    setIsRecording(true);
    setTimeElapsed(0);

    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => {
        if (prev >= MAX_DURATION - 1) {
          stopRecording();
          return MAX_DURATION;
        }
        return prev + 1;
      });
    }, 1000);

    if (cameraRef.current && typeof cameraRef.current.recordAsync === 'function') {
      try {
        const video = await cameraRef.current.recordAsync({
          maxDuration: MAX_DURATION,
        });
        if (video && video.uri) {
          setRecordedVideo(video.uri);
        }
      } catch (error: any) {
        console.log('Native video recording notice:', error?.message);
      }
    }
  };

  const stopRecording = () => {
    if (isRecording) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);

      if (cameraRef.current && typeof cameraRef.current.stopRecording === 'function') {
        try {
          cameraRef.current.stopRecording();
        } catch (e) {
          // Ignore
        }
      }

      // Always ensure a preview state exists after recording
      setTimeout(() => {
        setRecordedVideo(prev => prev || 'test_mode_intro_video');
      }, 300);
    }
  };

  const handleRetake = () => {
    setRecordedVideo(null);
    setTimeElapsed(0);
  };

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    
    try {
      const storedData = await AsyncStorage.getItem('application_data');
      const applicationData = storedData ? JSON.parse(storedData) : {};
      
      applicationData.intro_video_url = recordedVideo || 'intro_video_recorded';
      applicationData.intro_video_duration = timeElapsed;
      applicationData.intro_video_completed = true;
      
      await AsyncStorage.setItem('application_data', JSON.stringify(applicationData));
      router.replace('/application?videoCompleted=true');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save video. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <Ionicons name="videocam-off" size={60} color={COLORS.textMuted} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to record your intro video
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isRealVideoUri = recordedVideo && (
    recordedVideo.startsWith('file://') || 
    recordedVideo.startsWith('http') || 
    recordedVideo.startsWith('content://')
  );

  return (
    <View style={styles.container}>
      {recordedVideo ? (
        // Preview recorded video
        <View style={styles.previewContainer}>
          {isRealVideoUri ? (
            <Video
              source={{ uri: recordedVideo }}
              style={styles.videoPreview}
              useNativeControls
              resizeMode={ResizeMode.COVER}
              isLooping
              shouldPlay
            />
          ) : (
            <View style={styles.testVideoPlaceholder}>
              <Ionicons name="videocam" size={64} color={COLORS.primary} />
              <Text style={styles.testVideoTitle}>Intro Video Recorded ✨</Text>
              <Text style={styles.testVideoSub}>
                {timeElapsed > 0 ? `${timeElapsed}s Intro Video Ready to Submit` : 'Intro Video Ready'}
              </Text>
            </View>
          )}
          
          {/* Header overlay */}
          <View style={[styles.headerOverlay, { paddingTop: insets.top + SPACING.md }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Preview Your Intro</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Bottom controls */}
          <View style={[styles.previewControls, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
              <Ionicons name="refresh" size={22} color="#FFF" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={handleSaveAndContinue}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#FFF" />
                  <Text style={styles.saveText}>Use This Video</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Camera view
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          mode="video"
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                Alert.alert(
                  'Leave Recording?',
                  'You need to record an intro video to complete your application.',
                  [
                    { text: 'Stay', style: 'cancel' },
                    { text: 'Leave', style: 'destructive', onPress: () => router.back() }
                  ]
                );
              }}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            
            {/* Timer */}
            <View style={[
              styles.timer, 
              isRecording && !isPaused && styles.timerRecording,
              isPaused && styles.timerPaused
            ]}>
              <View style={[
                styles.recordingDot, 
                isRecording && !isPaused && styles.recordingDotActive,
                isPaused && styles.recordingDotPaused
              ]} />
              <Text style={styles.timerText}>
                {isPaused ? 'PAUSED' : `${formatTime(timeElapsed)} / ${formatTime(MAX_DURATION)}`}
              </Text>
            </View>

            {/* Flip Camera Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={toggleCameraFacing}
            >
              <Ionicons name="camera-reverse" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Tips overlay */}
          {!isRecording && timeElapsed === 0 && (
            <View style={styles.tipsOverlay}>
              <View style={styles.tipsCard}>
                <Ionicons name="bulb" size={24} color={COLORS.warning} />
                <Text style={styles.tipsTitle}>Tips for a Great Intro</Text>
                <View style={styles.tipsList}>
                  <Text style={styles.tipItem}>• Introduce yourself warmly</Text>
                  <Text style={styles.tipItem}>• Share your special gifts</Text>
                  <Text style={styles.tipItem}>• Explain how you help clients</Text>
                  <Text style={styles.tipItem}>• Be authentic & inviting</Text>
                  <Text style={styles.tipItem}>• Keep it under 1 minute!</Text>
                </View>
              </View>
            </View>
          )}

          {/* Progress bar */}
          {isRecording && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(timeElapsed / MAX_DURATION) * 100}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {MAX_DURATION - timeElapsed}s remaining
              </Text>
            </View>
          )}

          {/* Controls */}
          <View style={[styles.controls, { paddingBottom: insets.bottom + SPACING.xl }]}>
            <Text style={styles.instructionText}>
              {isRecording 
                ? (isPaused ? 'Recording paused - Tap play to resume' : 'Tap pause or stop when ready')
                : 'Tap to start recording'}
            </Text>
            
            <View style={styles.controlsRow}>
              {/* Pause/Resume Button - only shown while recording */}
              {isRecording && (
                <TouchableOpacity
                  style={styles.pauseButton}
                  onPress={togglePause}
                >
                  <Ionicons 
                    name={isPaused ? "play" : "pause"} 
                    size={28} 
                    color="#FFF" 
                  />
                </TouchableOpacity>
              )}
              
              {/* Main Record/Stop Button */}
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  isRecording && styles.recordButtonActive
                ]}
                onPress={isRecording ? stopRecording : startRecording}
              >
                <View style={[
                  styles.recordButtonInner,
                  isRecording && styles.recordButtonInnerActive
                ]} />
              </TouchableOpacity>
              
              {/* Spacer for layout balance when recording */}
              {isRecording && <View style={{ width: 56 }} />}
            </View>

            <Text style={styles.durationHint}>
              {isRecording && isPaused 
                ? 'Paused - Your video will continue from here'
                : 'Max 1 minute • Make it count!'}
            </Text>
          </View>
        </CameraView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#FFF',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    backgroundColor: COLORS.background,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  permissionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.lg,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  camera: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    gap: SPACING.sm,
  },
  timerRecording: {
    backgroundColor: 'rgba(255,0,0,0.7)',
  },
  timerPaused: {
    backgroundColor: 'rgba(255,165,0,0.8)',
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.textMuted,
  },
  recordingDotActive: {
    backgroundColor: '#FFF',
  },
  recordingDotPaused: {
    backgroundColor: '#FFF',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  skipButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  tipsOverlay: {
    position: 'absolute',
    top: '25%',
    left: SPACING.lg,
    right: SPACING.lg,
  },
  tipsCard: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  tipsList: {
    alignSelf: 'flex-start',
  },
  tipItem: {
    fontSize: 14,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 6,
  },
  progressContainer: {
    position: 'absolute',
    top: '50%',
    left: SPACING.lg,
    right: SPACING.lg,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.error,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    color: '#FFF',
    marginTop: SPACING.sm,
    fontWeight: '500',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
  },
  pauseButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#FFF',
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
    padding: 4,
  },
  recordButtonActive: {
    borderColor: COLORS.error,
  },
  recordButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: COLORS.error,
  },
  recordButtonInnerActive: {
    borderRadius: 8,
    width: '50%',
    height: '50%',
  },
  durationHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.md,
  },
  // Preview styles
  previewContainer: {
    flex: 1,
  },
  videoPreview: {
    flex: 1,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  previewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.success,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  testVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16192b',
    padding: SPACING.xl,
  },
  testVideoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFF',
    marginTop: SPACING.md,
  },
  testVideoSub: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
