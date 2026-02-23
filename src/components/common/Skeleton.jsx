import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { cardStyles } from '../../theme/cardStyles';

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
 * Matches: StatsCard.jsx — iconBox 32x32, label fontSize 12, value fontSize 26
 */
export const StatsCardSkeleton = () => (
  <View style={statsStyles.container}>
    <View style={statsStyles.topRow}>
      <Skeleton width={32} height={32} borderRadius={8} />
      <Skeleton width={60} height={12} />
    </View>
    <Skeleton width={70} height={26} style={{ marginTop: 10 }} />
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
 * Matches: FolderPill.jsx — icon 26x26, text, count badge, borderRadius 24, border 1.5
 */
export const FolderPillSkeleton = () => (
  <View style={folderStyles.pill}>
    <Skeleton width={26} height={26} circle />
    <Skeleton width={45} height={12} />
    <Skeleton width={22} height={18} borderRadius={10} />
  </View>
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
 * Matches: WhatsAppNumberCard.jsx — avatar 48x48, badges row, credits section, action button
 */
export const WhatsAppNumberCardSkeleton = () => (
  <View style={waCardStyles.container}>
    {/* Header: Avatar + Name/Phone */}
    <View style={waCardStyles.header}>
      <Skeleton width={48} height={48} circle />
      <View style={waCardStyles.info}>
        <Skeleton width={140} height={14} />
        <Skeleton width={120} height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
    {/* Badges Row */}
    <View style={waCardStyles.badgesRow}>
      <Skeleton width={60} height={22} borderRadius={20} />
      <Skeleton width={55} height={22} borderRadius={20} />
      <Skeleton width={50} height={22} borderRadius={20} />
    </View>
    {/* Credits Section */}
    <View style={waCardStyles.creditsSection}>
      <Skeleton width="100%" height={8} borderRadius={4} />
      <View style={waCardStyles.creditsStats}>
        <View style={waCardStyles.creditStat}>
          <Skeleton width={32} height={32} borderRadius={10} />
          <View>
            <Skeleton width={45} height={10} />
            <Skeleton width={35} height={14} style={{ marginTop: 3 }} />
          </View>
        </View>
        <View style={waCardStyles.creditStat}>
          <Skeleton width={32} height={32} borderRadius={10} />
          <View>
            <Skeleton width={45} height={10} />
            <Skeleton width={35} height={14} style={{ marginTop: 3 }} />
          </View>
        </View>
        <View style={waCardStyles.creditStat}>
          <Skeleton width={32} height={32} borderRadius={10} />
          <View>
            <Skeleton width={45} height={10} />
            <Skeleton width={35} height={14} style={{ marginTop: 3 }} />
          </View>
        </View>
      </View>
    </View>
    {/* Action Button */}
    <Skeleton width="100%" height={42} borderRadius={14} />
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
 * Matches: DashboardScreen memberPreviewCard — avatar 36x36, name fontSize 13, email fontSize 11, 1 role pill
 */
export const TeamMemberCardSkeleton = () => (
  <View style={memberStyles.container}>
    <View style={memberStyles.row}>
      <Skeleton width={36} height={36} borderRadius={10} />
      <View style={memberStyles.info}>
        <Skeleton width={120} height={13} />
        <Skeleton width={130} height={11} style={{ marginTop: 2 }} />
      </View>
      <Skeleton width={50} height={20} borderRadius={6} />
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
 * Matches: DashboardScreen sharedCard — icon 40x40, number, email, permission pill, access button
 */
export const SharedAccountCardSkeleton = () => (
  <View style={sharedStyles.container}>
    <View style={sharedStyles.row}>
      <Skeleton width={40} height={40} borderRadius={12} />
      <View style={sharedStyles.info}>
        <Skeleton width={150} height={14} />
        <Skeleton width={120} height={11} style={{ marginTop: 2 }} />
        <Skeleton width={55} height={16} borderRadius={4} style={{ marginTop: 4 }} />
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
 * Matches: ChatListItem.jsx — avatar 55x55, paddingH 16, paddingV 14, marginRight 14
 */
export const ConversationItemSkeleton = () => (
  <View style={conversationStyles.container}>
    <Skeleton width={55} height={55} circle style={conversationStyles.avatar} />
    <View style={conversationStyles.content}>
      <View style={conversationStyles.header}>
        <Skeleton width={140} height={16} />
        <Skeleton width={45} height={12} />
      </View>
      <Skeleton width="80%" height={13} style={{ marginTop: 6 }} />
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
 * Matches: ContactsScreen contactCard — avatar 52x52, name+lastActive, phone detail row, messageButton 44x44
 */
export const ContactItemSkeleton = () => (
  <View style={contactStyles.container}>
    <Skeleton width={52} height={52} circle style={contactStyles.avatar} />
    <View style={contactStyles.info}>
      <View style={contactStyles.header}>
        <Skeleton width={140} height={15} />
        <Skeleton width={50} height={11} />
      </View>
      <View style={contactStyles.detailRow}>
        <Skeleton width={14} height={14} borderRadius={4} />
        <Skeleton width={120} height={12} />
      </View>
    </View>
    <Skeleton width={44} height={44} circle />
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
 * Matches: TemplatesScreen templateCard — ShadowCard, cardContent padding 14, name+status, tags+preview
 */
export const TemplateCardSkeleton = () => (
  <View style={templateStyles.container}>
    {/* Top Row: Name and Status */}
    <View style={templateStyles.topRow}>
      <Skeleton width="60%" height={15} />
      <Skeleton width={72} height={24} borderRadius={6} />
    </View>
    {/* Bottom Row: Tags */}
    <View style={templateStyles.bottomRow}>
      <View style={templateStyles.tags}>
        <Skeleton width={70} height={22} borderRadius={6} />
        <Skeleton width={60} height={22} borderRadius={6} />
        <Skeleton width={35} height={22} borderRadius={6} />
      </View>
      <Skeleton width={40} height={28} borderRadius={8} />
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
 * Matches: SectionHeader.jsx — iconBox 28x28, title fontSize 16, badge
 */
export const SectionHeaderSkeleton = () => (
  <View style={sectionStyles.container}>
    <Skeleton width={28} height={28} borderRadius={8} />
    <Skeleton width={120} height={16} />
    <Skeleton width={28} height={22} borderRadius={12} />
  </View>
);

/**
 * Skeleton for Welcome Card
 * Matches: DashboardScreen welcomeCard — iconBox 40x40, greeting+name, quickAction 36x36
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
 * Matches: DashboardScreen — welcome + stats + folders + WA numbers + team members + shared accounts
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

    {/* Team Members Section */}
    <View style={dashboardStyles.section}>
      <SectionHeaderSkeleton />
      <TeamMembersListSkeleton count={2} />
    </View>

    {/* Shared Accounts Section */}
    <View style={dashboardStyles.section}>
      <SectionHeaderSkeleton />
      <SharedAccountsListSkeleton count={2} />
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
    ...cardStyles.cardFlat,
    width: '48%',
    padding: 14,
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 5,
  },
});

const waCardStyles = StyleSheet.create({
  list: {
    gap: 10,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  creditsSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  creditsStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  creditStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});

const memberStyles = StyleSheet.create({
  list: {
    gap: 10,
  },
  container: {
    ...cardStyles.cardFlat,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: {
    flex: 1,
  },
});

const sharedStyles = StyleSheet.create({
  list: {
    gap: 10,
  },
  container: {
    ...cardStyles.cardFlat,
    padding: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: {
    flex: 1,
  },
});

const conversationStyles = StyleSheet.create({
  list: {
    gap: 0,
  },
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    marginRight: 14,
  },
  content: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    paddingBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
});

const contactStyles = StyleSheet.create({
  list: {
    gap: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  avatar: {
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
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
    ...cardStyles.cardFlat,
    padding: 14,
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
