import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { SPACING } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { psychic, updateProfile } = useAuth();
  const { colors } = useTheme();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  
  // Profile form state
  const [name, setName] = useState(psychic?.name || '');
  const [bio, setBio] = useState(psychic?.bio || '');
  const [profilePicture, setProfilePicture] = useState(psychic?.profile_picture || '');
  
  // Application data (email & phone from signup)
  const [applicationData, setApplicationData] = useState<any>(null);

  useEffect(() => {
    fetchApplicationData();
  }, []);

  const fetchApplicationData = async () => {
    try {
      // Fetch the psychic's application data to get email and phone
      const response = await fetch(`${BACKEND_URL}/api/applications/psychic/${psychic?.id || psychic?.email}`);
      if (response.ok) {
        const data = await response.json();
        setApplicationData(data);
      }
    } catch (error) {
      console.error('Failed to fetch application data:', error);
    }
  };

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
          aspect: [1, 1],
          quality: 0.8,
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
          aspect: [1, 1],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets[0]) {
        setProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // Update profile via API
      const response = await fetch(`${BACKEND_URL}/api/auth/psychic/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psychic_id: psychic?.id,
          name,
          bio,
          profile_picture: profilePicture,
        }),
      });

      if (response.ok) {
        // Update local state
        if (updateProfile) {
          updateProfile({ name, bio, profile_picture: profilePicture });
        }
        
        if (Platform.OS === 'web') {
          alert('Profile updated successfully!');
        } else {
          Alert.alert('Success', 'Profile updated successfully!');
        }
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      if (Platform.OS === 'web') {
        alert('Failed to save profile. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save profile. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Image Options Modal */}
      <Modal
        visible={showImageOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageOptions(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowImageOptions(false)}
        >
          <View style={[styles.imageOptionsModal, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Change Profile Photo</Text>
            
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
              <Ionicons name="images" size={24} color={colors.primary} />
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.backgroundCard }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Profile</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Profile Picture */}
        <View style={styles.profileSection}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={() => setShowImageOptions(true)}
          >
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={[styles.avatar, { borderColor: colors.primary }]} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={styles.avatarText}>{name?.charAt(0).toUpperCase() || 'A'}</Text>
              </View>
            )}
            <View style={[styles.editAvatarBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.changePhotoText, { color: colors.primary }]}>Tap to change photo</Text>
        </View>

        {/* Contact Info from Application (Read-only) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CONTACT INFORMATION</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>From your advisor application</Text>
          
          <View style={[styles.infoCard, { backgroundColor: colors.backgroundCard }]}>
            <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.infoIcon, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="mail" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Email</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {applicationData?.email || psychic?.email || 'Not available'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="call" size={20} color={colors.secondary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Phone</Text>
                <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
                  {applicationData?.phone || psychic?.phone || 'Not available'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Editable Profile Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PROFILE INFORMATION</Text>
          
          <View style={[styles.inputContainer, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Display Name</Text>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Your display name"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          
          <View style={[styles.inputContainer, { backgroundColor: colors.backgroundCard }]}>
            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Bio</Text>
            <TextInput
              style={[styles.textArea, { color: colors.textPrimary, borderColor: colors.border }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell clients about yourself and your abilities..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSaveProfile}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Application Info */}
        {applicationData && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>APPLICATION STATUS</Text>
            <View style={[styles.statusCard, { backgroundColor: colors.backgroundCard }]}>
              <View style={[styles.statusBadge, { 
                backgroundColor: applicationData.status === 'approved' ? colors.success + '20' : colors.warning + '20' 
              }]}>
                <Ionicons 
                  name={applicationData.status === 'approved' ? 'checkmark-circle' : 'time'} 
                  size={20} 
                  color={applicationData.status === 'approved' ? colors.success : colors.warning} 
                />
                <Text style={[styles.statusText, { 
                  color: applicationData.status === 'approved' ? colors.success : colors.warning 
                }]}>
                  {applicationData.status?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
              <Text style={[styles.applicationDate, { color: colors.textSecondary }]}>
                Applied: {applicationData.submitted_at ? new Date(applicationData.submitted_at).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFF',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: SPACING.sm,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: SPACING.md,
  },
  infoCard: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  inputContainer: {
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  input: {
    fontSize: 16,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  textArea: {
    fontSize: 16,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderRadius: 8,
    padding: SPACING.sm,
    minHeight: 100,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 14,
    gap: SPACING.sm,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  statusCard: {
    borderRadius: 14,
    padding: SPACING.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    gap: SPACING.xs,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  applicationDate: {
    fontSize: 13,
    marginTop: SPACING.sm,
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
});
