import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ScrollView } from 'react-native';
import { Text, Card, ActivityIndicator, Surface, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { callApi, endpoints, httpMethods } from '../../utils/axios';
import { colors } from '../../theme/colors';
import { TeamMembersListSkeleton, StatsGridSkeleton } from '../../components/common';

export default function TeamMemberScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    inactiveMembers: 0,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      setError(null);

      // Fetch team member stats
      const statsResponse = await callApi(endpoints.teamMember.getTeamMemberStats, httpMethods.GET);
      if (statsResponse.success) {
        setStats({
          totalMembers: statsResponse.data.totalMembers || 0,
          activeMembers: statsResponse.data.activeMembers || 0,
          inactiveMembers: statsResponse.data.inactiveMembers || 0,
        });

        // If stats includes member list, use it
        if (statsResponse.data.members) {
          setTeamMembers(statsResponse.data.members);
        }
      } else {
        setError(statsResponse.error || 'Failed to load team members');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadTeamMembers();
  };

  const getRoleBadgeColor = (role) => {
    const roleColors = {
      admin: colors.error.main,
      manager: colors.primary.main,
      agent: colors.success.main,
      viewer: colors.info.main,
    };
    return roleColors[role?.toLowerCase()] || colors.grey[500];
  };

  const renderStatsCard = () => (
    <Surface style={styles.statsContainer}>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={styles.statNumber}>
              {stats.totalMembers}
            </Text>
            <Text variant="bodyMedium" style={styles.statLabel}>
              Total Members
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.success.main }]}>
              {stats.activeMembers}
            </Text>
            <Text variant="bodyMedium" style={styles.statLabel}>
              Active
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content>
            <Text variant="headlineMedium" style={[styles.statNumber, { color: colors.grey[500] }]}>
              {stats.inactiveMembers}
            </Text>
            <Text variant="bodyMedium" style={styles.statLabel}>
              Inactive
            </Text>
          </Card.Content>
        </Card>
      </View>
    </Surface>
  );

  const renderMemberItem = ({ item }) => (
    <Card style={styles.memberCard}>
      <Card.Content>
        <View style={styles.memberHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text variant="titleMedium" style={styles.avatarText}>
                {(item.name || item.email || 'U')[0].toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.memberInfo}>
            <Text variant="titleMedium" style={styles.memberName}>
              {item.name || 'No Name'}
            </Text>
            <Text variant="bodyMedium" style={styles.memberEmail}>
              {item.email}
            </Text>

            <View style={styles.badgesRow}>
              <Chip
                mode="flat"
                style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}
                textStyle={styles.badgeText}
              >
                {item.role || 'member'}
              </Chip>

              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'active' ? colors.success.light : colors.grey[400] }
              ]}>
                <Text variant="bodySmall" style={styles.statusText}>
                  {item.status || 'inactive'}
                </Text>
              </View>
            </View>

            {item.accessLevel && (
              <View style={styles.accessContainer}>
                <Text variant="bodySmall" style={styles.accessLabel}>
                  Access Level:
                </Text>
                <Text variant="bodySmall" style={styles.accessValue}>
                  {item.accessLevel}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text variant="headlineSmall" style={styles.emptyTitle}>
        No team members found
      </Text>
      <Text variant="bodyMedium" style={styles.emptyText}>
        No team members have been added yet
      </Text>
    </View>
  );

  const renderError = () => {
    if (!error) return null;

    return (
      <Surface style={styles.errorContainer}>
        <Text variant="bodyMedium" style={styles.errorText}>
          {error}
        </Text>
      </Surface>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.headerTitle}>
            Team Members
          </Text>
          <Text variant="bodyMedium" style={styles.headerSubtitle}>
            Loading...
          </Text>
        </View>
        <ScrollView style={styles.skeletonContainer} contentContainerStyle={styles.skeletonContent}>
          <StatsGridSkeleton />
          <View style={{ marginTop: 16 }}>
            <TeamMembersListSkeleton count={5} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Team Members
        </Text>
        <Text variant="bodyMedium" style={styles.headerSubtitle}>
          {stats.totalMembers} members (View only)
        </Text>
      </View>

      {renderError()}
      {renderStatsCard()}

      <FlatList
        data={teamMembers}
        renderItem={renderMemberItem}
        keyExtractor={(item, index) => item._id || item.email || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.text.secondary,
  },
  skeletonContainer: {
    flex: 1,
  },
  skeletonContent: {
    padding: 16,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    color: colors.text.primary,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: colors.text.secondary,
  },
  statsContainer: {
    backgroundColor: colors.background.paper,
    padding: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.background.neutral,
    borderRadius: 8,
  },
  statNumber: {
    color: colors.primary.main,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: colors.text.secondary,
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  memberCard: {
    backgroundColor: colors.background.paper,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 1,
  },
  memberHeader: {
    flexDirection: 'row',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.common.white,
    fontWeight: '600',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberEmail: {
    color: colors.text.secondary,
    marginBottom: 8,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  roleBadge: {
    height: 24,
  },
  badgeText: {
    color: colors.common.white,
    fontSize: 11,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: colors.common.white,
    textTransform: 'capitalize',
  },
  accessContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  accessLabel: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  accessValue: {
    color: colors.text.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.error.lighter,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  errorText: {
    color: colors.error.main,
  },
});
