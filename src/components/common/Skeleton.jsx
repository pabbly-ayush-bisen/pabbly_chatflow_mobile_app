import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

/**
 * Reusable Skeleton loading component with shimmer animation
 * @param {number} width - Width of skeleton (can be number or percentage string)
 * @param {number} height - Height of skeleton
 * @param {number} borderRadius - Border radius (default 8)
 * @param {object} style - Additional styles
 * @param {boolean} circle - Make it a circle (uses height as diameter)
 */
const Skeleton = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  circle = false,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  const skeletonStyle = circle
    ? {
        width: height,
        height: height,
        borderRadius: height / 2,
      }
    : {
        width,
        height,
        borderRadius,
      };

  return (
    <View style={[styles.skeleton, skeletonStyle, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

/**
 * Skeleton for Stats Cards (2x2 grid)
 */
export const StatsCardSkeleton = () => (
  <View style={statsStyles.container}>
    <View style={statsStyles.topRow}>
      <Skeleton width={32} height={32} borderRadius={8} />
      <Skeleton width={60} height={12} />
    </View>
    <Skeleton width={80} height={28} style={{ marginTop: 10 }} />
  </View>
);

export const StatsGridSkeleton = () => (
  <View style={statsStyles.grid}>
    <StatsCardSkeleton />
    <StatsCardSkeleton />
    <StatsCardSkeleton />
    <StatsCardSkeleton />
  </View>
);

/**
 * Skeleton for Folder Pills (horizontal scroll)
 */
export const FolderPillSkeleton = () => (
  <Skeleton width={90} height={36} borderRadius={18} />
);

export const FoldersSkeleton = () => (
  <View style={folderStyles.container}>
    <FolderPillSkeleton />
    <FolderPillSkeleton />
    <FolderPillSkeleton />
    <FolderPillSkeleton />
  </View>
);

/**
 * Skeleton for WhatsApp Number Card
 */
export const WhatsAppNumberCardSkeleton = () => (
  <View style={waCardStyles.container}>
    <View style={waCardStyles.header}>
      <Skeleton width={44} height={44} borderRadius={12} />
      <View style={waCardStyles.info}>
        <Skeleton width={140} height={14} />
        <Skeleton width={100} height={12} style={{ marginTop: 6 }} />
      </View>
      <Skeleton width={70} height={32} borderRadius={8} />
    </View>
    <View style={waCardStyles.statsRow}>
      <Skeleton width={80} height={10} />
      <Skeleton width={60} height={10} />
    </View>
  </View>
);

export const WhatsAppNumbersListSkeleton = ({ count = 3 }) => (
  <View style={waCardStyles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <WhatsAppNumberCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton for Team Member Card
 */
export const TeamMemberCardSkeleton = () => (
  <View style={memberStyles.container}>
    <View style={memberStyles.row}>
      <Skeleton width={36} height={36} borderRadius={10} />
      <View style={memberStyles.info}>
        <Skeleton width={120} height={13} />
        <Skeleton width={150} height={11} style={{ marginTop: 4 }} />
        <View style={memberStyles.badges}>
          <Skeleton width={50} height={20} borderRadius={6} />
          <Skeleton width={50} height={20} borderRadius={6} />
        </View>
      </View>
    </View>
  </View>
);

export const TeamMembersListSkeleton = ({ count = 3 }) => (
  <View style={memberStyles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <TeamMemberCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton for Shared Account Card
 */
export const SharedAccountCardSkeleton = () => (
  <View style={sharedStyles.container}>
    <View style={sharedStyles.row}>
      <Skeleton width={40} height={40} borderRadius={12} />
      <View style={sharedStyles.info}>
        <Skeleton width={130} height={14} />
        <View style={sharedStyles.metaRow}>
          <Skeleton width={100} height={11} />
          <Skeleton width={35} height={16} borderRadius={4} />
        </View>
      </View>
      <Skeleton width={70} height={32} borderRadius={8} />
    </View>
  </View>
);

export const SharedAccountsListSkeleton = ({ count = 3 }) => (
  <View style={sharedStyles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <SharedAccountCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton for Conversation/Chat Item
 */
export const ConversationItemSkeleton = () => (
  <View style={conversationStyles.container}>
    <Skeleton width={48} height={48} circle />
    <View style={conversationStyles.content}>
      <View style={conversationStyles.header}>
        <Skeleton width={120} height={14} />
        <Skeleton width={40} height={10} />
      </View>
      <Skeleton width="90%" height={12} style={{ marginTop: 6 }} />
    </View>
  </View>
);

export const ConversationsListSkeleton = ({ count = 8 }) => (
  <View style={conversationStyles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <ConversationItemSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton for Contact Item
 */
export const ContactItemSkeleton = () => (
  <View style={contactStyles.container}>
    <Skeleton width={44} height={44} circle />
    <View style={contactStyles.info}>
      <Skeleton width={130} height={14} />
      <Skeleton width={100} height={12} style={{ marginTop: 4 }} />
    </View>
    <Skeleton width={24} height={24} borderRadius={12} />
  </View>
);

export const ContactsListSkeleton = ({ count = 10 }) => (
  <View style={contactStyles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <ContactItemSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton for Template Card
 */
export const TemplateCardSkeleton = () => (
  <View style={templateStyles.container}>
    {/* Top Row: Name and Status */}
    <View style={templateStyles.topRow}>
      <Skeleton width={180} height={15} />
      <Skeleton width={70} height={24} borderRadius={6} />
    </View>
    {/* Bottom Row: Tags */}
    <View style={templateStyles.bottomRow}>
      <View style={templateStyles.tags}>
        <Skeleton width={65} height={22} borderRadius={6} />
        <Skeleton width={55} height={22} borderRadius={6} />
        <Skeleton width={35} height={22} borderRadius={6} />
      </View>
      <Skeleton width={32} height={28} borderRadius={8} />
    </View>
  </View>
);

export const TemplatesListSkeleton = ({ count = 6 }) => (
  <View style={templateStyles.list}>
    {Array.from({ length: count }).map((_, index) => (
      <TemplateCardSkeleton key={index} />
    ))}
  </View>
);

/**
 * Skeleton for Section Header
 */
export const SectionHeaderSkeleton = () => (
  <View style={sectionStyles.container}>
    <Skeleton width={28} height={28} borderRadius={8} />
    <Skeleton width={100} height={16} />
    <Skeleton width={28} height={22} borderRadius={12} />
  </View>
);

/**
 * Skeleton for Welcome Card
 */
export const WelcomeCardSkeleton = () => (
  <View style={welcomeStyles.container}>
    <Skeleton width={40} height={40} borderRadius={12} />
    <View style={welcomeStyles.content}>
      <Skeleton width={100} height={13} />
      <Skeleton width={140} height={17} style={{ marginTop: 4 }} />
    </View>
    <Skeleton width={36} height={36} borderRadius={10} />
  </View>
);

/**
 * Full Dashboard Skeleton
 */
export const DashboardSkeleton = () => (
  <View style={dashboardStyles.container}>
    <WelcomeCardSkeleton />

    {/* Stats Section */}
    <View style={dashboardStyles.section}>
      <SectionHeaderSkeleton />
      <StatsGridSkeleton />
    </View>

    {/* Folders Section */}
    <View style={dashboardStyles.section}>
      <SectionHeaderSkeleton />
      <FoldersSkeleton />
    </View>

    {/* WhatsApp Numbers Section */}
    <View style={dashboardStyles.section}>
      <SectionHeaderSkeleton />
      <WhatsAppNumbersListSkeleton count={2} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    width: '50%',
  },
});

const statsStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  container: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

const folderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
  },
});

const waCardStyles = StyleSheet.create({
  list: {
    gap: 10,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  info: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
});

const memberStyles = StyleSheet.create({
  list: {
    gap: 10,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
});

const sharedStyles = StyleSheet.create({
  list: {
    gap: 10,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
});

const conversationStyles = StyleSheet.create({
  list: {
    gap: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

const contactStyles = StyleSheet.create({
  list: {
    gap: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  info: {
    flex: 1,
  },
});

const sectionStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
});

const welcomeStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  content: {
    flex: 1,
  },
});

const dashboardStyles = StyleSheet.create({
  container: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
});

const templateStyles = StyleSheet.create({
  list: {
    gap: 10,
    paddingHorizontal: 16,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default Skeleton;
