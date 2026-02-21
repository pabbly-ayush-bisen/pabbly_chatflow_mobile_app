import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Snackbar } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { cardStyles } from '../theme/cardStyles';
import ChatflowLogo from '../components/ChatflowLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const HORIZONTAL_PADDING = 16;
const VIDEO_CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

// Tab bar height constant for bottom spacing
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 90 : 70;

export default function GetHelpScreen() {
  const appVersion = '1.0.0';
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const insets = useSafeAreaInsets();

  // Video tutorials with actual thumbnails
  const videoTutorials = [
    {
      id: 1,
      title: 'Create WhatsApp Cloud API Account',
      thumbnail: require('../../assets/thumbnails/whatsapp-cloud-api.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=-GAYCaqIHeI',
    },
    {
      id: 2,
      title: 'Pabbly Chatflow Inbox Overview',
      thumbnail: require('../../assets/thumbnails/inbox-overview.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=JE0f2lwFNMI',
    },
    {
      id: 3,
      title: 'Contact Management Overview',
      thumbnail: require('../../assets/thumbnails/contact-overview.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=j919a9bIi4w',
    },
    {
      id: 4,
      title: 'Team Member Overview',
      thumbnail: require('../../assets/thumbnails/team-member-overview.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=EnB4Ju1tTN8',
    },
    {
      id: 5,
      title: 'Create Templates in Chatflow',
      thumbnail: require('../../assets/thumbnails/create-templates.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=lmXyI79aENQ',
    },
    {
      id: 6,
      title: 'WhatsApp Chatbot with Flow Builder',
      thumbnail: require('../../assets/thumbnails/flow-builder.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=NXIbDhxXKF0',
    },
    {
      id: 7,
      title: 'Broadcast Messages & API Campaigns',
      thumbnail: require('../../assets/thumbnails/broadcast-api.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=b1g9QbrP9jU',
    },
    {
      id: 8,
      title: 'Explore Settings Section',
      thumbnail: require('../../assets/thumbnails/settings-explore.png'),
      youtubeUrl: 'https://www.youtube.com/watch?v=zqv2ggtzq8M',
    },
  ];

  // Quick actions with descriptions
  const quickActions = [
    {
      title: 'Documentation',
      description: 'Browse guides & tutorials',
      icon: 'book-open-page-variant-outline',
      color: '#2196F3',
      bgColor: '#E3F2FD',
      onPress: () => handleOpenWebsite('https://www.pabbly.com/connect/docs/chatflow/'),
    },
    {
      title: 'Community',
      description: 'Join discussions & forums',
      icon: 'forum-outline',
      color: '#9C27B0',
      bgColor: '#F3E5F5',
      onPress: () => handleOpenWebsite('https://forum.pabbly.com'),
    },
    {
      title: 'YouTube',
      description: 'Watch video tutorials',
      icon: 'youtube',
      color: '#FF0000',
      bgColor: '#FFEBEE',
      onPress: () => handleOpenWebsite('https://youtube.com/@pabbly'),
    },
    {
      title: 'Support',
      description: 'Contact our team',
      icon: 'headset',
      color: '#4CAF50',
      bgColor: '#E8F5E9',
      onPress: () => handleEmailSupport(),
    },
  ];

  const handleEmailSupport = () => {
    const email = 'support@pabbly.com';
    const subject = 'Pabbly Chatflow Mobile App Support';
    const body = `App Version: ${appVersion}\nPlatform: ${Platform.OS}\n\nDescribe your issue:\n\n`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          showSnackbar('Unable to open email client');
        }
      })
      .catch(() => showSnackbar('Failed to open email'));
  };

  const handleOpenWebsite = (url) => {
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          showSnackbar('Unable to open link');
        }
      })
      .catch(() => showSnackbar('Failed to open link'));
  };

  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Render video cards in pairs (2 per row)
  const renderVideoGrid = () => {
    const rows = [];
    for (let i = 0; i < videoTutorials.length; i += 2) {
      const video1 = videoTutorials[i];
      const video2 = videoTutorials[i + 1];
      rows.push(
        <View key={i} style={styles.videoRow}>
          <TouchableOpacity
            style={styles.videoCard}
            onPress={() => handleOpenWebsite(video1.youtubeUrl)}
            activeOpacity={0.8}
          >
            <View style={styles.thumbnailContainer}>
              <Image source={video1.thumbnail} style={styles.thumbnailImage} resizeMode="cover" />
              <View style={styles.playOverlay}>
                <View style={styles.playButton}>
                  <Icon name="play" size={20} color={colors.common.white} />
                </View>
              </View>
            </View>
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle} numberOfLines={2}>{video1.title}</Text>
            </View>
          </TouchableOpacity>

          {video2 && (
            <TouchableOpacity
              style={styles.videoCard}
              onPress={() => handleOpenWebsite(video2.youtubeUrl)}
              activeOpacity={0.8}
            >
              <View style={styles.thumbnailContainer}>
                <Image source={video2.thumbnail} style={styles.thumbnailImage} resizeMode="cover" />
                <View style={styles.playOverlay}>
                  <View style={styles.playButton}>
                    <Icon name="play" size={20} color={colors.common.white} />
                  </View>
                </View>
              </View>
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={2}>{video2.title}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconCircle}>
            <Icon name="lifebuoy" size={28} color={colors.primary.main} />
          </View>
          <View style={styles.heroTextBox}>
            <Text style={styles.heroTitle}>How can we help?</Text>
            <Text style={styles.heroSubtitle}>
              Watch tutorials and get support
            </Text>
          </View>
        </View>

        {/* Video Tutorials Section - 2 column grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Video Tutorials</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => handleOpenWebsite('https://youtube.com/@pabbly')}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Icon name="arrow-right" size={16} color={colors.primary.main} />
            </TouchableOpacity>
          </View>

          <View style={styles.videoGrid}>
            {renderVideoGrid()}
          </View>
        </View>

        {/* Quick Actions - 2x2 Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.quickActionCard}
                onPress={action.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIconBox, { backgroundColor: action.bgColor }]}>
                  <Icon name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={styles.quickActionTitle}>{action.title}</Text>
                <Text style={styles.quickActionDesc}>{action.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Support - Compact */}
        <View style={styles.section}>
          <View style={styles.contactCard}>
            <View style={styles.contactLeft}>
              <View style={styles.contactIconBox}>
                <Icon name="email-outline" size={22} color={colors.common.white} />
              </View>
              <View style={styles.contactText}>
                <Text style={styles.contactTitle}>Need More Help?</Text>
                <Text style={styles.contactSubtitle}>support@pabbly.com</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={handleEmailSupport}
              activeOpacity={0.8}
            >
              <Text style={styles.contactButtonText}>Email Us</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info Footer */}
        <View style={styles.appInfoSection}>
          <View style={styles.appInfoDivider} />
          <View style={styles.appInfoRow}>
            <ChatflowLogo width={80} showText={true} showIcon={true} />
            <View style={styles.appInfoDot} />
            <Text style={styles.appInfoText}>v{appVersion}</Text>
            <View style={styles.appInfoDot} />
            <Text style={styles.appInfoText}>{Platform.OS === 'ios' ? 'iOS' : 'Android'}</Text>
            <View style={styles.appInfoDot} />
            <Text style={styles.appInfoText}>Made with care by Pabbly</Text>
          </View>
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  scrollContent: {
    // paddingBottom is set dynamically in component to account for tab bar
  },

  // Compact Hero Section
  heroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.lighter,
    marginHorizontal: HORIZONTAL_PADDING,
    marginTop: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 14,
    gap: 14,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.common.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary.main,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  heroTextBox: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary.darker,
    marginBottom: 2,
  },
  heroSubtitle: {
    fontSize: 13,
    color: colors.primary.dark,
    opacity: 0.85,
  },

  // Section
  section: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // Video Grid
  videoGrid: {
    gap: CARD_GAP,
  },
  videoRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
  },
  videoCard: {
    ...cardStyles.cardFlat,
    width: VIDEO_CARD_WIDTH,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: '100%',
    height: VIDEO_CARD_WIDTH * 0.56, // 16:9 aspect ratio
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoInfo: {
    padding: 10,
  },
  videoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 16,
  },

  // Quick Actions - 2x2 Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  quickActionCard: {
    ...cardStyles.cardFlat,
    width: VIDEO_CARD_WIDTH,
    padding: 14,
    alignItems: 'flex-start',
  },
  quickActionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  quickActionDesc: {
    fontSize: 11,
    color: colors.text.tertiary,
    lineHeight: 14,
  },

  // Contact Card - Compact
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primary.main,
    borderRadius: 12,
    padding: 14,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  contactIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.common.white,
    marginBottom: 1,
  },
  contactSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  contactButton: {
    backgroundColor: colors.common.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary.main,
  },

  // App Info Footer
  appInfoSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    marginTop: 12,
  },
  appInfoDivider: {
    height: 1,
    backgroundColor: colors.grey[200],
    marginBottom: 20,
  },
  appInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  appInfoText: {
    fontSize: 11,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  appInfoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey[300],
  },
});
